#!/usr/bin/env python3
"""
rq2_full_runner.py
Merged runner: original fatigue experiments + instrumented RQ2 probes + plotting + Hotpot sample fallback.

Configuration per paper:
- Model: Falcon-7B-Instruct quantized to 4-bit NF4 with eager attention
- Decoding: top-p=0.95, T=1.0, max_new=120
- Probes: attention-to-prompt (At), embedding drift (Dt), next-token entropy (Et)
- Fatigue Index: entropy healthy band [1.5, 3.0] with hysteresis

Context length rule (to avoid eviction):
- If max_context (B) = 1024 and max_new (G) = 120, usable = 904
- Short = 0.1 × 904 = 90 tokens
- Medium = 0.5 × 904 = 452 tokens
- Long = 0.75 × 904 = 678 tokens
This ensures we never exceed B and trigger trimming/eviction during generation.

Run example:
    python rq2_full_runner.py --run_context --use_4bit --subset_size 1

For 8GB GPU memory issues:
- Set PROBE_INTERVAL = 8 (probe every 8 tokens instead of every token)
- Reduce MAX_NEW_TOKENS to 80
- Use --subset_size 1

"""
import os
import sys

# FIX: Set CUDA memory allocator config BEFORE importing torch
# Note: expandable_segments may not be supported on all CUDA versions
# Alternative: max_split_size_mb helps with fragmentation
os.environ['PYTORCH_ALLOC_CONF'] = 'max_split_size_mb:128'
import time, json, math, random, argparse, gc, re
from typing import List, Optional, Tuple, Dict
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import scipy
import torch
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
from datasets import load_dataset
import matplotlib
matplotlib.use("Agg")
from collections import defaultdict
import math

# ---------- Utilities ----------
def cleanup():
    try:
        torch.cuda.empty_cache()
    except Exception:
        pass
    gc.collect()


def cleanup_model(model):
    """Properly cleanup a model from memory"""
    if model is not None:
        try:
            # Remove model from GPU
            model.cpu()
            del model
        except Exception:
            pass
    cleanup()


def _norm_tokens(s):
    s = s.lower()
    s = re.sub(r"[^\w\s]", "", s)
    return s.split()


def em_f1(pred, gold):
    p, g = _norm_tokens(pred), _norm_tokens(gold)
    em = int(p == g)
    if len(p) == 0 or len(g) == 0:
        return em, 0.0
    common = set(p) & set(g)
    match = sum(min(p.count(w), g.count(w)) for w in common)
    if match == 0:
        return em, 0.0
    prec, rec = match / len(p), match / len(g)
    return em, 2 * prec * rec / (prec + rec)


def best_span_f1(pred_text, gold_text, max_len=8):
    gold_norm = " ".join(_norm_tokens(gold_text))
    if not gold_norm:
        return 0.0
    toks = _norm_tokens(pred_text)
    best = 0.0
    for L in range(1, min(max_len, len(toks)) + 1):
        for i in range(0, len(toks) - L + 1):
            span = " ".join(toks[i:i + L])
            _, f1 = em_f1(span, gold_norm)
            if f1 > best:
                best = f1
    return best


def entropy_from_logits(logits: torch.Tensor) -> float:
    # last-token entropy (nats)
    if logits.ndim == 3:
        last = logits[0, -1, :].float()
    elif logits.ndim == 2:
        last = logits[0].float()
    else:
        last = logits.view(-1, logits.shape[-1])[0].float()
    probs = F.softmax(last, dim=-1).clamp(min=1e-12)
    return float(-(probs * probs.log()).sum().item())


def repetition_ratio(text: str, n: int = 3) -> float:
    toks = text.split()
    if len(toks) < n:
        return 0.0
    seen = set()
    repeats = 0
    total = 0
    for i in range(len(toks) - n + 1):
        ng = ' '.join(toks[i:i + n])
        total += 1
        if ng in seen:
            repeats += 1
        else:
            seen.add(ng)
    return repeats / total if total > 0 else 0.0


def compute_embedding_drift(hidden_states, prompt_len: int) -> float:
    """
    Compute embedding drift Dt: cosine distance between current hidden state
    and mean of prompt hidden states.
    """
    if hidden_states is None or len(hidden_states) == 0:
        return 0.0
    try:
        # Get last layer hidden states: (batch, seq_len, hidden_dim)
        last_layer = hidden_states[-1][0]  # [seq_len, hidden_dim]

        # Mean of prompt embeddings (first prompt_len tokens)
        if prompt_len > 0 and prompt_len <= last_layer.shape[0]:
            prompt_mean = last_layer[:prompt_len].mean(dim=0)  # [hidden_dim]
            current = last_layer[-1]  # Last token [hidden_dim]

            # Cosine distance = 1 - cosine similarity
            cos_sim = F.cosine_similarity(prompt_mean.unsqueeze(0), current.unsqueeze(0))
            drift = 1.0 - cos_sim.item()
            return drift
    except Exception as e:
        print(f"Warning: drift calculation failed: {e}")
    return 0.0


def compute_fatigue_index(entropy: float, prev_fatigue: float = 0.0) -> float:
    """
    Compute Fatigue Index with entropy healthy band [1.5, 3.0] and hysteresis.
    Returns 1.0 if fatigued, 0.0 if healthy.
    """
    # Check if entropy is outside healthy band
    if entropy < ENTROPY_HEALTHY_MIN or entropy > ENTROPY_HEALTHY_MAX:
        fatigue = 1.0
    else:
        fatigue = 0.0

    # Apply hysteresis for stability
    if abs(fatigue - prev_fatigue) < HYSTERESIS_THRESHOLD:
        fatigue = prev_fatigue

    return fatigue


def find_sublist(hay: List[int], needle: List[int]) -> Optional[int]:
    if not needle:
        return None
    for i in range(len(hay) - len(needle) + 1):
        if hay[i:i + len(needle)] == needle:
            return i
    return None


# layer/head attention to span
def layer_head_attention_to_span(attentions, query_pos: int, span_indices: List[int]):
    import numpy as _np
    res = {}
    if attentions is None:
        return res
    for li, layer in enumerate(attentions):
        tensor = layer
        if tensor.ndim == 4:
            mat = tensor[0]  # (heads,S,S)
        else:
            continue
        H, S, _ = mat.shape
        valid = [i for i in span_indices if 0 <= i < S]
        if len(valid) == 0:
            per_head = _np.full((H,), _np.nan)
        else:
            per_head = mat[:, query_pos, valid].mean(axis=1).cpu().numpy()
        res[li] = {"per_head": per_head, "layer_mean": float(_np.nanmean(per_head))}
    return res


def fit_exponential_decay(attn_weights: np.ndarray, distances: np.ndarray):
    from scipy.optimize import curve_fit
    if np.isnan(attn_weights).all():
        return {"a": np.nan, "b": np.nan, "c": np.nan, "tau": np.nan, "r2": np.nan}

    def f(x, a, b, c):
        return a * np.exp(-b * x) + c

    mask = np.isfinite(attn_weights) & np.isfinite(distances)
    if mask.sum() < 3:
        return {"a": np.nan, "b": np.nan, "c": np.nan, "tau": np.nan, "r2": np.nan}
    x = distances[mask];
    y = attn_weights[mask]
    try:
        p, _ = curve_fit(f, x, y, p0=[y.max() - y.min() + 1e-6, 0.01, y.min()])
        a, b, c = p
        # FIX: Check for zero before division
        tau = 1.0 / b if b > 1e-10 else np.inf
        ypred = f(x, *p)
        ss_res = ((y - ypred) ** 2).sum();
        ss_tot = ((y - y.mean()) ** 2).sum()
        r2 = 1 - ss_res / ss_tot if ss_tot > 0 else np.nan
        return {"a": float(a), "b": float(b), "c": float(c), "tau": float(tau), "r2": float(r2)}
    except Exception:
        return {"a": np.nan, "b": np.nan, "c": np.nan, "tau": np.nan, "r2": np.nan}


def kl_per_token_logits(logits_p: torch.Tensor, logits_q: torch.Tensor) -> np.ndarray:
    with torch.no_grad():
        logp = F.log_softmax(logits_p, dim=-1)
        logq = F.log_softmax(logits_q, dim=-1)
        p = logp.exp()
        kl = (p * (logp - logq)).sum(dim=-1)  # (batch, seq_len)
        return kl.mean(dim=0).cpu().numpy()


def attach_residual_norm_hooks(model, prefix="resnorm"):
    norms = {}
    handles = []
    candidates = []
    for name, module in model.named_modules():
        if "mlp" in name.lower() or "ffn" in name.lower() or name.endswith("mlp"):
            candidates.append((name, module))
    for idx, (name, mod) in enumerate(candidates):
        key = f"{prefix}_{idx}_{name.replace('.', '_')}"

        def make_hook(k):
            def hook(module, inp, out):
                try:
                    t = out if torch.is_tensor(out) else (out[0] if isinstance(out, (list, tuple)) else None)
                    if t is None: return
                    val = t.detach().norm(dim=-1).mean().item()
                    norms.setdefault(k, []).append(val)
                except Exception:
                    pass

            return hook

        try:
            h = mod.register_forward_hook(make_hook(key))
            handles.append(h)
        except Exception:
            pass
    return norms, handles

# ------- CONFIG -------
MODEL_NAME = "tiiuae/falcon-7b-instruct"
DATA_PATH = "data/hotpot_sample_50.jsonl"
OUTDIR = "rq2_outputs"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
SEEDS = [42, 43, 44]
TOP_P = 0.95
TEMPERATURE = 1.0  # Changed from 0.2 to match paper
MAX_NEW_TOKENS = 120  # G - max new tokens to generate (was 128)
BATCH_SIZE = 1

# Context window configuration
# Falcon-7B has 2048 max context, but for 8GB GPU we use smaller window
MAX_CONTEXT_TOKENS = 1024  # B - max context window (reduced for 8GB VRAM)
# Rule: context_lengths = [0.1x, 0.5x, 0.75x] * (B - G) to leave headroom
USABLE_CONTEXT = MAX_CONTEXT_TOKENS - MAX_NEW_TOKENS  # B - G = 1024 - 120 = 904
CONTEXT_SHORT = int(0.1 * USABLE_CONTEXT)  # ~90 tokens
CONTEXT_MEDIUM = int(0.5 * USABLE_CONTEXT)  # ~452 tokens
CONTEXT_LONG = int(0.75 * USABLE_CONTEXT)  # ~678 tokens

# Fatigue Index parameters (from paper)
ENTROPY_HEALTHY_MIN = 1.5
ENTROPY_HEALTHY_MAX = 3.0
HYSTERESIS_THRESHOLD = 0.1  # For stability in fatigue detection
PROBE_INTERVAL = 1  # Probe every N tokens (set to 8 if memory issues)
# --------------------------------

os.makedirs(OUTDIR, exist_ok=True)
os.makedirs(os.path.dirname(DATA_PATH) or ".", exist_ok=True)
random.seed(123)
np.random.seed(123)
torch.manual_seed(123)

# ---------- Data helper: HF dataset fallback -> jsonl ----------
def create_hotpot_sample_from_hf(out_path=DATA_PATH, n=50, seed=42):
    ds = load_dataset("hotpot_qa", "fullwiki")
    # choose validation/train if available
    if isinstance(ds, dict) or hasattr(ds, "keys"):
        if "validation" in ds:
            dsplit = ds["validation"]
        elif "train" in ds:
            dsplit = ds["train"]
        else:
            dsplit = ds[list(ds.keys())[0]]
    else:
        dsplit = ds
    rng = random.Random(seed)
    n = min(n, len(dsplit))
    idxs = rng.sample(list(range(len(dsplit))), n)
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    out = []
    for ii, i in enumerate(idxs):
        item = dsplit[int(i)]
        q = item.get("question") or item.get("query") or ""
        ans = item.get("answer") or ""
        # context approx
        ctx = ""
        if "context" in item and item["context"]:
            if isinstance(item["context"], list):
                try:
                    ctx = " ".join([" ".join(x) if isinstance(x, (list, tuple)) else str(x) for x in item["context"]])
                except Exception:
                    ctx = " ".join(map(str, item["context"]))
            else:
                ctx = str(item["context"])
        evidence = ""
        if "supporting_facts" in item and item["supporting_facts"]:
            try:
                evidence = " ".join(
                    [" ".join(x) if isinstance(x, (list, tuple)) else str(x) for x in item["supporting_facts"]])
            except Exception:
                evidence = str(item["supporting_facts"])
        if not evidence and ctx and ans:
            sents = [s.strip() for s in re.split(r'(?<=[.!?])\s+', ctx) if s.strip()]
            found = ""
            for s in sents:
                if any(t.lower() in s.lower() for t in ans.split()):
                    found = s;
                    break
            evidence = found or (sents[0] if sents else ctx[:200])
        rec = {"id": str(ii), "question": q, "context": ctx, "evidence": evidence, "answer": ans}
        out.append(rec)
    with open(out_path, "w", encoding="utf-8") as f:
        for r in out:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"Created sample {out_path} with {len(out)} examples.")
    return out_path


# ---------- Model loader ----------
def load_model_and_tokenizer(model_name: str, use_4bit: bool = False, device: str = DEVICE):
    print(f"Loading {model_name} use_4bit={use_4bit}")
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    # Ensure tokenizer has a pad token (must be a string token, not an id)
    if tokenizer.pad_token is None:
        # Prefer the EOS token string if present
        if getattr(tokenizer, "eos_token", None):
            tokenizer.pad_token = tokenizer.eos_token
        # Otherwise, convert eos_token_id -> token string
        elif getattr(tokenizer, "eos_token_id", None) is not None:
            tokenizer.pad_token = tokenizer.convert_ids_to_tokens(int(tokenizer.eos_token_id))
        else:
            # Add an explicit pad token
            tokenizer.add_special_tokens({"pad_token": "<|pad|>"})

    # Ensure pad_token_id exists (some tokenizers set this automatically)
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token_id = tokenizer.convert_tokens_to_ids(tokenizer.pad_token)

    model = None
    if use_4bit:
        try:
            bnb = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_use_double_quant=True,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_compute_dtype=torch.float16
                )
            model = AutoModelForCausalLM.from_pretrained(
                model_name,
                quantization_config=bnb,
                device_map="auto",
                attn_implementation="eager"
            )  # Force eager attention
            print("Loaded 4-bit model with eager attention")
        except Exception as e:
            print("4-bit load failed:", e)
            model = None
    if model is None:
        kwargs = {"attn_implementation": "eager"}  # Force eager attention
        if device == "cuda":
            kwargs.update({"dtype": torch.float16, "device_map": "auto"})
        model = AutoModelForCausalLM.from_pretrained(model_name, **kwargs)
        print("Loaded FP16/FP32 model with eager attention")
    model.eval()
    return model, tokenizer


# ---------- Forward instrumentation ----------
def analyze_forward_instrumented(model, tokenizer, prompt: str, evidence: str, attach_hooks: bool = False,
                                 device: str = DEVICE, output_attentions: bool = True):
    enc = tokenizer(prompt, return_tensors="pt", add_special_tokens=False)
    input_ids = enc["input_ids"].to(device)

    # Truncate if too long to save memory - more aggressive for 8GB cards
    max_length = 1024  # Reduced from 2048 for RTX 3070
    if input_ids.shape[1] > max_length:
        print(f"Warning: Truncating input from {input_ids.shape[1]} to {max_length} tokens")
        input_ids = input_ids[:, :max_length]

    attention_mask = enc.get("attention_mask", None)
    if attention_mask is not None:
        attention_mask = attention_mask.to(device)
        if attention_mask.shape[1] > max_length:
            attention_mask = attention_mask[:, :max_length]

    ev_ids = tokenizer(evidence, return_tensors="pt", add_special_tokens=False)["input_ids"][0].tolist()
    start = find_sublist(input_ids[0].tolist(), ev_ids)
    evidence_span = list(range(start, start + len(ev_ids))) if start is not None else []
    residual_norms = {}
    handles = []
    if attach_hooks:
        residual_norms, handles = attach_residual_norm_hooks(model, prefix="resnorm")

    # For 8GB cards, disable attentions by default to save memory
    # Only enable if sequence is short enough
    if input_ids.shape[1] > 512:
        #output_attentions = False
        print(f"  Consider disabling attentions for sequence length {input_ids.shape[1]} to save memory at line 440")

    with torch.no_grad():
        try:
            out = model(input_ids=input_ids, attention_mask=attention_mask, output_attentions=output_attentions,
                        return_dict=True)
        except torch.cuda.OutOfMemoryError:
            print("  OOM with attentions=True, retrying without attentions...")
            # Clean up and retry without attentions
            cleanup()
            out = model(input_ids=input_ids, attention_mask=attention_mask, output_attentions=False, return_dict=True)
            output_attentions = False

    logits = out.logits
    ent = entropy_from_logits(logits)
    query_pos = input_ids.shape[1] - 1

    lh = {}
    layer_decay = {}

    if output_attentions and out.attentions is not None:
        lh = layer_head_attention_to_span(out.attentions, query_pos=query_pos, span_indices=evidence_span)

        for li, layer in enumerate(out.attentions):
            mat = layer[0] if layer.ndim == 4 else layer
            vec = mat[:, query_pos, :].mean(axis=0).cpu().numpy()
            distances = np.arange(vec.shape[0])
            fit = fit_exponential_decay(vec, distances)
            layer_decay[li] = {"attn_vec": vec.tolist(), "decay_fit": fit}

            # Free memory immediately after processing each layer
            del mat, vec

        # Clear attention tensors from memory
        del out.attentions

    for h in handles:
        try:
            h.remove()
        except Exception:
            pass

    # Clean up
    del out, logits, input_ids
    if attention_mask is not None:
        del attention_mask
    cleanup()

    return {"entropy": ent, "evidence_span": evidence_span,
            "layer_head_attn": {k: {"layer_mean": v["layer_mean"], "per_head": v["per_head"].tolist()} for k, v in
                                lh.items()}, "layer_decay": layer_decay, "residual_norms": residual_norms}


# ---------- Generation + scoring ----------
def generate_and_score(model, tokenizer, prompt: str, gold: [str], seed: int, device: str = DEVICE):
    """
  we generate the prompot and measure
    """
    # Prepare RNG, inputs
    gen = torch.Generator(device=device).manual_seed(seed)
    enc = tokenizer(prompt, return_tensors="pt", truncation=True, padding=True)
    enc = {k: v.to(device) for k, v in enc.items()}
    input_ids = enc["input_ids"]
    input_len = input_ids.shape[1]


    out = None
    # generate and print if fails
    try:
        out = model.generate(**enc,
                             max_new_tokens=MAX_NEW_TOKENS,
                             do_sample=True,
                             top_p=TOP_P,
                             temperature=TEMPERATURE,
                             pad_token_id=tokenizer.eos_token_id,
                             eos_token_id=tokenizer.eos_token_id,
                             return_dict_in_generate=True,
                             output_scores=True)
    except Exception as e:
        print("Error: Something is wrong with generation ", repr(e))

    # Raw decoded full sequence (skip special tokens)
    try:
        raw_seq = tokenizer.batch_decode(out.sequences, skip_special_tokens=True)[0]
    except Exception as e:
        raw_seq = "<decode_failed>"
        print("DEBUG: failed to decode out.sequences:", e)

    # Collect debug info
    dbg = {}
    dbg["input_len_tokens"] = int(input_len)
    dbg["out_sequences_type"] = str(type(out.sequences))
    try:
        dbg["out_sequences_shape"] = tuple(out.sequences.shape)
    except Exception:
        dbg["out_sequences_shape"] = "unknown"

    # Safe extraction of generated ids:
    gen_ids = []
    try:
        seq_tensor = out.sequences  # often tensor shape (batch, seq_len)
        # handle tensor or list
        if isinstance(seq_tensor, torch.Tensor):
            if seq_tensor.dim() == 1:
                # shape weird: treat as 1D
                seq_tensor = seq_tensor.unsqueeze(0)
            seq0 = seq_tensor[0]  # first batch
            seq0 = seq0.cpu()
            total_len = seq0.shape[0]
            dbg["total_seq_len"] = int(total_len)
            # If total_len < input_len, generation truncated; handle gracefully
            if total_len <= input_len:
                gen_ids = []
                dbg["gen_ids_len"] = 0
                dbg["gen_truncation"] = True
            else:
                gen_ids = seq0[input_len:].tolist()
                dbg["gen_ids_len"] = len(gen_ids)
                dbg["gen_truncation"] = False
    except Exception as e:
        print("error in extraction ")

    # Compute per-token entropy from out.scores, which should be a list with one tensor per generated token
    pred = ""
    entropy_per_token = []
    entropy_gen = None
    try:
        scores = getattr(out, "scores", None)
        dbg["scores_present"] = bool(scores)
        if scores:
            dbg["scores_len"] = len(scores)
            # Each s is usually shape (batch, vocab) or (vocab,)
            for idx, s in enumerate(scores):
                try:
                    s_t = s
                    if isinstance(s_t, torch.Tensor):
                        if s_t.ndim == 2:
                            s_in = s_t[0].unsqueeze(0)
                        elif s_t.ndim == 1:
                            s_in = s_t.unsqueeze(0)
                        else:
                            s_in = s_t.reshape(-1, s_t.shape[-1])
                        ent = entropy_from_logits(s_in)
                        entropy_per_token.append(float(ent))
                    else:
                        entropy_per_token.append(float("nan"))
                except Exception as e:
                    print(f"DEBUG: entropy calc failed on score idx {idx}: {e}")
                    entropy_per_token.append(float("nan"))
            if len(entropy_per_token) > 0:
                entropy_gen = float(entropy_per_token[-1])
        else:
            dbg["scores_len"] = 0
    except Exception as e:
        print("DEBUG: problem iterating scores:", e)
        dbg["scores_len"] = "error"

    # Compute metrics
    rep3 = repetition_ratio(pred, n=3)
    try:
        em, f1 = em_f1(pred, gold)
    except Exception as e:
        print("DEBUG: em_f1 failed:", e)

    # Save debug JSON to OUTDIR for inspection
    debug_fn = os.path.join(OUTDIR, f"generate_debug_seed{seed}.json")
    try:
        dbg_write = {
            "seed": seed,
            "input_len": dbg.get("input_len_tokens"),
            "out_sequences_shape": dbg.get("out_sequences_shape"),
            "total_seq_len": dbg.get("total_seq_len", None),
            "gen_ids_len": dbg.get("gen_ids_len"),
            "gen_ids_sample": dbg.get("gen_ids_sample"),
            "scores_present": dbg.get("scores_present"),
            "scores_len": dbg.get("scores_len"),
            "raw_seq_preview": dbg.get("raw_seq_preview"),
            "prompt_preview": dbg.get("prompt_preview"),
            "pred_preview": pred[:400],
            "em": em,
            "f1": f1,
        }
        with open(debug_fn, "w", encoding="utf-8") as df:
            json.dump(dbg_write, df, indent=2)
        print("Saved generation debug to", debug_fn)
    except Exception as junk:
        print("junk is cooked", junk)
    # Return results
    result = {
        "pred": pred,
        "entropy_per_token": entropy_per_token,
        "entropy_gen": entropy_gen,
        "repetition3": rep3,
        "em": em,
        "f1": f1,
        "raw_seq": raw_seq,
        "debug": dbg
    }
    return result

# ---------- High-level experiments ----------
# FIX: Removed unused tokenizer parameter
def build_prompt_with_filler(question, evidence, filler_token, filler_len_tokens, evidence_pos):
    """
    Build prompt with filler tokens (not words) to reach specific context lengths.
    filler_len_tokens: number of filler tokens to add
    """
    # Create filler as repeated tokens (rough approximation: 1 word ≈ 1.3 tokens)
    filler_words = max(1, int(filler_len_tokens / 1.3))
    filler = " ".join([filler_token] * filler_words)

    if evidence_pos == "front":
        prompt = f"{evidence}\n\n{filler}\n\nQuestion: {question}\nAnswer:"
    elif evidence_pos == "middle":
        prompt = f"{filler}\n\n{evidence}\n\n{filler}\n\nQuestion: {question}\nAnswer:"
    elif evidence_pos == "end":
        prompt = f"{filler}\n\nQuestion: {question}\n\n{evidence}\n\nAnswer:"
    else:
        raise ValueError(evidence_pos)
    return prompt


# FIX: Added tokenizer parameter
def run_context_length_experiment(model, tokenizer, ex, lengths_tokens, seeds, out_prefix="hotpot"):
    """
    Run context length experiment with specific token counts.
    lengths_tokens: list of context lengths in tokens (not words)
    """
    results = []
    for L in lengths_tokens: # iterate over context lengths
        print(f"  Processing context length={L} tokens...")
        prompt = build_prompt_with_filler(ex["question"], ex["evidence"], "filler", L * 0.7, "middle")

        # Verify actual token count and adjust if needed
        enc_test = tokenizer(prompt, return_tensors="pt", add_special_tokens=False)
        actual_len = enc_test["input_ids"].shape[1]
        print(actual_len)

        fw = analyze_forward_instrumented(model, tokenizer, prompt, ex["evidence"], attach_hooks=False, device=DEVICE)
        cleanup()

        gens = []
        for sd in seeds:
            gen = generate_and_score(model, tokenizer, prompt, ex.get("answer"), sd, device=DEVICE)
            gens.append(gen)
            cleanup()

        results.append({"length_tokens": L, "forward": fw, "generations": gens})
        cleanup()

    path = os.path.join(OUTDIR, f"{out_prefix}_context_length.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print("Saved", path)
    return results


# FIX: Added tokenizer parameter
def run_positional_experiment(model, tokenizer, ex, total_context_words, seeds, out_prefix="hotpot"):
    positions = ["front", "middle", "end"]
    results = []
    filler_len = max(1, min(total_context_words // 2, 200))  # Cap at 200 words for 8GB

    for pos in positions:
        print(f"  Processing position={pos}...")
        prompt = build_prompt_with_filler(ex["question"], ex["evidence"], "filler", filler_len, pos)
        fw = analyze_forward_instrumented(model, tokenizer, prompt, ex["evidence"], attach_hooks=False, device=DEVICE)
        cleanup()

        gens = []
        for sd in seeds:
            gen = generate_and_score(model, tokenizer, prompt, ex.get("answer"), sd, device=DEVICE)
            gens.append(gen)
            cleanup()

        results.append({"position": pos, "forward": fw, "generations": gens})
        cleanup()

    path = os.path.join(OUTDIR, f"{out_prefix}_positional.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print("Saved", path)
    return results


def run_precision_ablation(model_loader, ex_list, seeds, out_prefix="hotpot"):
    # Load FP16 model
    fp_model, fp_tok = model_loader(use_4bit=False)
    out = {"fp16": [], "4bit": []}

    # Process FP16 first
    print("Processing FP16 model...")
    for ex in ex_list:
        prompt = build_prompt_with_filler(ex["question"], ex["evidence"], "filler", 200, "middle")
        fw_fp = analyze_forward_instrumented(fp_model, fp_tok, prompt, ex["evidence"], attach_hooks=False,
                                             device=DEVICE)
        cleanup()

        gens_fp = []
        for sd in seeds:
            gen = generate_and_score(fp_model, fp_tok, prompt, ex.get("answer"), sd, device=DEVICE)
            gens_fp.append(gen)
            cleanup()

        out["fp16"].append({"id": ex.get("id"), "forward": fw_fp, "generations": gens_fp})
        cleanup()

    # Clean up FP16 model before loading 4-bit
    print("Cleaning up FP16 model...")
    cleanup_model(fp_model)
    fp_model = None
    fp_tok = None

    # Now load and process 4-bit model
    try:
        print("Loading 4-bit model...")
        model_4b, tok_4b = model_loader(use_4bit=True)
        print("Processing 4-bit model...")
        for ex in ex_list:
            prompt = build_prompt_with_filler(ex["question"], ex["evidence"], "filler", 200, "middle")
            fw_4b = analyze_forward_instrumented(model_4b, tok_4b, prompt, ex["evidence"], attach_hooks=False,
                                                 device=DEVICE)
            cleanup()

            gens_4b = []
            for sd in seeds:
                gen = generate_and_score(model_4b, tok_4b, prompt, ex.get("answer"), sd, device=DEVICE)
                gens_4b.append(gen)
                cleanup()

            out["4bit"].append({"id": ex.get("id"), "forward": fw_4b, "generations": gens_4b})
            cleanup()

        # Clean up 4-bit model
        cleanup_model(model_4b)
        model_4b = None
        tok_4b = None
    except Exception as e:
        print("4-bit processing failed:", e)

    path = os.path.join(OUTDIR, f"{out_prefix}_precision_ablation.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
    print("Saved", path)
    return out



# --- Robust plotting & aggregation helpers ---
def _safe_makedirs_for(path):
    d = os.path.dirname(path) or "."
    os.makedirs(d, exist_ok=True)

def plot_em_f1_bar(agg_dict: Dict[str, Tuple[float, float]], out_png: str, figsize=(8,4), dpi=160):
    """
    agg_dict: mapping like "len_90" -> (mean_em, mean_f1)
    Writes out_png and prints a short summary.
    """
    if not agg_dict:
        print("plot_em_f1_bar: empty dict, skipping")
        return
    # sort by numeric part when possible
    def keynum(k):
        m = re.search(r'(\d+)', k)
        return int(m.group(1)) if m else float('inf')

    items = sorted(agg_dict.items(), key=lambda kv: keynum(kv[0]))
    labels = [k for k,_ in items]
    ems = np.array([v[0] for _,v in items], dtype=float)
    f1s = np.array([v[1] for _,v in items], dtype=float)

    L = len(labels)
    x = np.arange(L)
    w = 0.35

    # Replace NaN with 0 for plotting but annotate
    em_plot = np.nan_to_num(ems, nan=0.0)
    f1_plot = np.nan_to_num(f1s, nan=0.0)
    em_nan = np.isnan(ems)
    f1_nan = np.isnan(f1s)

    _safe_makedirs_for(out_png)
    plt.figure(figsize=figsize)
    plt.bar(x - w/2, em_plot, w, label='EM')
    plt.bar(x + w/2, f1_plot, w, label='F1')
    for i in range(L):
        if em_nan[i]:
            plt.text(x[i] - w/2, 0.01, "n/a", ha='center', va='bottom', fontsize=8)
        else:
            plt.text(x[i] - w/2, em_plot[i] + 1e-6, f"{em_plot[i]:.3f}", ha='center', va='bottom', fontsize=8)
        if f1_nan[i]:
            plt.text(x[i] + w/2, 0.01, "n/a", ha='center', va='bottom', fontsize=8)
        else:
            plt.text(x[i] + w/2, f1_plot[i] + 1e-6, f"{f1_plot[i]:.3f}", ha='center', va='bottom', fontsize=8)

    plt.xticks(x, labels, rotation=45, ha='right')
    plt.ylabel("score")
    plt.title("EM and F1 by condition")
    plt.legend()
    plt.tight_layout()
    plt.savefig(out_png, dpi=dpi)
    plt.close()
    print(f"Saved EM/F1 plot to {out_png} — groups={L}")

def plot_entropy_series(entropy_series: List[float], out_png: str, label="entropy", figsize=(8,3), dpi=160):
    """
    Simple line plot for entropy over tokens/time.
    entropy_series: list of floats (one per token or probe)
    """
    if not entropy_series:
        print("plot_entropy_series: empty series, skipping", out_png)
        return
    arr = np.array(entropy_series, dtype=float)
    # handle degenerate constant arrays
    if np.all(np.isclose(arr, arr[0])):
        ylim = (arr[0] - 0.1 * max(1.0, abs(arr[0])), arr[0] + 0.1 * max(1.0, abs(arr[0])))
    else:
        ylim = None

    _safe_makedirs_for(out_png)
    plt.figure(figsize=figsize)
    plt.plot(arr, marker='o', linewidth=1)
    plt.xlabel("step (token index or probe)")
    plt.ylabel("entropy (nats)")
    plt.title(label)
    if ylim:
        plt.ylim(ylim)
    plt.tight_layout()
    plt.savefig(out_png, dpi=dpi)
    plt.close()
    print(f"Saved entropy series to {out_png} (len={len(arr)})")

def plot_tau_by_layer(decay_maps: List[Dict], labels: List[str], out_png: str, figsize=(10,4), dpi=160):
    """
    Decay maps: list of dicts mapping layer->{"decay_fit": {"tau": ...}}
    labels: labels for each map (e.g. 'short', 'long')
    """
    taus_list = []
    # collect consistent layer range across maps
    layer_set = set()
    for m in decay_maps:
        layer_set.update([int(k) for k in m.keys()])
    layers = sorted(layer_set)
    for m in decay_maps:
        tlist = []
        for li in layers:
            key = str(li) if str(li) in m else li
            if key in m:
                tlist.append(m[key].get("decay_fit", {}).get("tau", np.nan))
            else:
                tlist.append(np.nan)
        taus_list.append(tlist)

    _safe_makedirs_for(out_png)
    plt.figure(figsize=figsize)
    for t, lab in zip(taus_list, labels):
        plt.plot(layers, t, marker='o', label=lab)
    plt.xlabel("layer")
    plt.ylabel("tau (1/b)")
    plt.title("Distance-decay tau by layer")
    plt.legend()
    plt.tight_layout()
    plt.savefig(out_png, dpi=dpi)
    plt.close()
    print(f"Saved tau-by-layer to {out_png}")

def plot_attention_decay_layer(vecs: List[np.ndarray], labels: List[str], layer_idx: int, out_png: str, figsize=(10,4), dpi=160):
    _safe_makedirs_for(out_png)
    plt.figure(figsize=figsize)
    for v, l in zip(vecs, labels):
        arr = np.array(v, dtype=float)
        plt.plot(arr, marker='o', label=l)
    plt.xlabel("token position")
    plt.ylabel("attention weight")
    plt.title(f"Attention decay (layer {layer_idx})")
    plt.legend()
    plt.tight_layout()
    plt.savefig(out_png, dpi=dpi)
    plt.close()
    print(f"Saved attn decay layer {layer_idx} to {out_png}")

def plot_precision_ablation_summary(precision_out: Dict, out_prefix: str):
    """
    precision_out expected format from run_precision_ablation: {"fp16": [...], "4bit": [...]}
    Each entry is {"id":..., "forward":..., "generations":[{em,f1,entropy_gen,repetition3, ...}, ...]}
    This routine produces:
      - em/f1 bar averaged per-precision
      - entropy distribution per-precision (across generations)
      - repetition scatter per-precision
    """
    # Aggregate EM/F1 across examples & seeds
    for tag in ["fp16", "4bit"]:
        entries = precision_out.get(tag, [])
        agg = {}
        all_entropy = []
        all_reps = []
        for e in entries:
            gens = e.get("generations", [])
            ems = [g.get("em") for g in gens if g.get("em") is not None]
            f1s = [g.get("f1") for g in gens if g.get("f1") is not None]
            # example-level means
            if ems or f1s:
                agg[e.get("id", "0")] = (np.nanmean(ems) if ems else np.nan, np.nanmean(f1s) if f1s else np.nan)
            for g in gens:
                if g.get("entropy_gen") is not None:
                    all_entropy.append(g.get("entropy_gen"))
                if g.get("repetition3") is not None:
                    all_reps.append(g.get("repetition3"))
        # plot per-precision EM/F1 aggregated across examples (as bar)
        if agg:
            out_png = os.path.join(OUTDIR, f"{out_prefix}_{tag}_emf1.png")
            plot_em_f1_bar(agg, out_png)
        # entropy histogram
        if len(all_entropy) > 0:
            out_png = os.path.join(OUTDIR, f"{out_prefix}_{tag}_entropy_hist.png")
            _safe_makedirs_for(out_png)
            plt.figure(figsize=(6,3))
            plt.hist(np.array(all_entropy), bins=30)
            plt.xlabel("entropy (nats)")
            plt.ylabel("count")
            plt.title(f"Entropy distribution ({tag})")
            plt.tight_layout()
            plt.savefig(out_png)
            plt.close()
            print(f"Saved entropy hist for {tag} to {out_png}")
        # repetition scatter
        if len(all_reps) > 0:
            out_png = os.path.join(OUTDIR, f"{out_prefix}_{tag}_repetition_hist.png")
            _safe_makedirs_for(out_png)
            plt.figure(figsize=(6,3))
            plt.hist(np.array(all_reps), bins=20)
            plt.xlabel("repetition ratio (3-grams)")
            plt.ylabel("count")
            plt.title(f"Repetition distribution ({tag})")
            plt.tight_layout()
            plt.savefig(out_png)
            plt.close()
            print(f"Saved repetition hist for {tag} to {out_png}")

def plot_positional_sensitivity(pos_file: str, out_prefix="positional"):
    """
    Read the positional JSON created by run_positional_experiment and produce:
      - EM/F1 bar across positions
      - attention-to-evidence (layer0 mean) vs position
      - forward entropy per position
    """
    if not os.path.exists(pos_file):
        print("plot_positional_sensitivity: file missing", pos_file)
        return

    with open(pos_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    # data is list of {"position": pos, "forward": {...}, "generations": [...]}
    em_by_pos = {}
    f1_by_pos = {}
    attn_by_pos = {}
    entropy_by_pos = {}

    for rec in data:
        pos = rec.get("position", "unknown")
        gens = rec.get("generations", [])
        ems = [g.get("em") for g in gens if g.get("em") is not None]
        f1s = [g.get("f1") for g in gens if g.get("f1") is not None]
        em_by_pos[pos] = np.nanmean(ems) if ems else np.nan
        f1_by_pos[pos] = np.nanmean(f1s) if f1s else np.nan

        # forward attention: take layer 0 mean if available, else mean over layers
        fw = rec.get("forward", {})
        layer_head = fw.get("layer_head_attn", {})
        if layer_head:
            # prefer layer '0' or 0
            if '0' in layer_head:
                m = layer_head['0']['layer_mean']
            elif 0 in layer_head:
                m = layer_head[0]['layer_mean']
            else:
                # average across first available layer means
                try:
                    m = np.nanmean([v['layer_mean'] for v in layer_head.values()])
                except Exception:
                    m = np.nan
        else:
            m = np.nan
        attn_by_pos[pos] = m
        entropy_by_pos[pos] = rec.get("forward", {}).get("entropy", np.nan)

    # EM/F1 bar
    combined = {p:(em_by_pos.get(p, np.nan), f1_by_pos.get(p, np.nan)) for p in em_by_pos.keys()}
    plot_em_f1_bar(combined, os.path.join(OUTDIR, f"{out_prefix}_emf1_by_pos.png"))

    # attention per pos (bar)
    positions = sorted(list(attn_by_pos.keys()))
    attn_vals = [attn_by_pos[p] for p in positions]
    out_png = os.path.join(OUTDIR, f"{out_prefix}_attn_by_pos.png")
    _safe_makedirs_for(out_png)
    plt.figure(figsize=(6,3))
    plt.bar(positions, np.nan_to_num(attn_vals, nan=0.0))
    plt.ylabel("mean attention to evidence (layer0)")
    plt.xlabel("position")
    plt.title("Attention-to-evidence by evidence position")
    plt.tight_layout()
    plt.savefig(out_png)
    plt.close()
    print(f"Saved {out_png}")

    # forward entropy by pos (line)
    ent_vals = [entropy_by_pos[p] for p in positions]
    plot_entropy_series(ent_vals, os.path.join(OUTDIR, f"{out_prefix}_entropy_by_pos.png"), label="forward entropy by position")

# --- High-level aggregator that you can call at the end of main() ---
def aggregate_and_plot_all(outdir: str = OUTDIR):
    """
    Look for context, positional, and precision files and create several summary plots.
    """
    # Context-length summary
    ctxt_file = os.path.join(outdir, "hotpot_context_length.json")
    if os.path.exists(ctxt_file):
        with open(ctxt_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        # data is list of {"length_tokens":..., "forward":..., "generations":[...]}
        agg = {}
        taus_maps = []
        tau_labels = []
        for r in data:
            key = f"len_{r.get('length_tokens')}"
            gens = r.get("generations", [])
            ems = [g.get("em") for g in gens if g.get("em") is not None]
            f1s = [g.get("f1") for g in gens if g.get("f1") is not None]
            agg[key] = (np.nanmean(ems) if ems else np.nan, np.nanmean(f1s) if f1s else np.nan)

            fw = r.get("forward", {})
            ld = fw.get("layer_decay", {})
            if ld:
                taus_maps.append(ld)
                tau_labels.append(key)
        if agg:
            plot_em_f1_bar(agg, os.path.join(outdir, "em_f1_by_context_length.png"))

        if taus_maps:
            plot_tau_by_layer(taus_maps, tau_labels, os.path.join(outdir, "tau_by_layer_context.png"))

    # Positional summary
    pos_file = os.path.join(outdir, "hotpot_positional.json")
    if os.path.exists(pos_file):
        plot_positional_sensitivity(pos_file, out_prefix="positional")

    # Precision ablation summary
    prec_file = os.path.join(outdir, "hotpot_precision_ablation.json")
    if os.path.exists(prec_file):
        with open(prec_file, "r", encoding="utf-8") as f:
            prec = json.load(f)
        plot_precision_ablation_summary(prec, out_prefix="precision_ablation")

    print("aggregate_and_plot_all: finished plotting. See", outdir)

# ---------- CLI ----------
def main(argv):
    p = argparse.ArgumentParser()
    p.add_argument("--model", default=MODEL_NAME)
    p.add_argument("--data", default=DATA_PATH)
    p.add_argument("--outdir", default=OUTDIR)
    p.add_argument("--run_context", action="store_true")
    p.add_argument("--run_positional", action="store_true")
    p.add_argument("--run_precision", action="store_true")
    p.add_argument("--use_4bit", action="store_true")
    p.add_argument("--seeds", nargs="+", type=int, default=SEEDS)
    p.add_argument("--subset_size", type=int, default=2,
                   help="Number of examples to process (default: 2 for memory safety)")
    p.add_argument("--hotpot")
    args = p.parse_args(argv)

    # ensure sample exists (create from HF if not)
    if not os.path.exists(args.data):
        print(f"{args.data} not found — creating sample from HotpotQA (fullwiki). This may take a minute.")
        create_hotpot_sample_from_hf(out_path=args.data, n=50, seed=42)

    # load examples
    examples = []
    with open(args.data, "r", encoding="utf-8") as f:
        for line in f:
            examples.append(json.loads(line))
    if len(examples) == 0:
        print("No examples found; aborting.");
        return

    # model loader
    def loader(use_4bit=False):
        return load_model_and_tokenizer(args.model, use_4bit=use_4bit, device=DEVICE)

    if args.hotpot:
        print("creating a new sample from hotopt dataset")
        return(create_hotpot_sample_from_hf())
    # Load model based on --use_4bit flag
    if args.use_4bit:
        print("Loading 4-bit quantized model...")
        model, tokenizer = loader(use_4bit=True)
    else:
        print("Loading FP16/FP32 model...")
        model, tokenizer = loader(use_4bit=False)

    # subset (configurable size for memory management)
    subset = examples[:args.subset_size]
    print(f"\n{'=' * 60}")
    print(f"CONFIGURATION (matching paper requirements)")
    print(f"{'=' * 60}")
    print(f"Model: {args.model}")
    print(f"Quantization: {'4-bit NF4' if args.use_4bit else 'FP16/FP32'}")
    print(f"Attention: Eager (not SDPA/Flash)")
    print(f"Decoding: top_p={TOP_P}, temp={TEMPERATURE}, max_new={MAX_NEW_TOKENS}")
    print(f"Max Context (B): {MAX_CONTEXT_TOKENS} tokens")
    print(f"Usable Context (B-G): {USABLE_CONTEXT} tokens")
    print(f"Context Lengths: SHORT={CONTEXT_SHORT}, MED={CONTEXT_MEDIUM}, LONG={CONTEXT_LONG}")
    print(f"Fatigue: entropy healthy band [{ENTROPY_HEALTHY_MIN}, {ENTROPY_HEALTHY_MAX}]")
    print(f"Probe interval: every {PROBE_INTERVAL} token(s)")
    print(f"Processing {len(subset)} examples with seeds {args.seeds}")
    print(f"{'=' * 60}\n")

    if args.run_context:
        print("Running context-length experiment on subset...")
        out_all = []
        for ex in subset:
            res = run_context_length_experiment(model, tokenizer, ex, lengths_tokens=[10, 200, 1000], seeds=args.seeds)
            out_all.append(res)
        # example plotting (first example)
        first = out_all[0]
        decay_maps = {f"len_{r['length_tokens']}": r['forward']['layer_decay'] for r in first}
        plot_tau_by_layer(list(decay_maps.values()), list(decay_maps.keys()),
                          os.path.join(args.outdir, "tau_by_layer_context.png"))
        print("Saved tau_by_layer_context.png")

    if args.run_positional:
        print("Running positional experiment on subset...")
        out_all = []
        for ex in subset:
            res = run_positional_experiment(model, tokenizer, ex, total_context_words=600, seeds=args.seeds)
            out_all.append(res)
        # plot for first example
        first = out_all[0]
        vecs = [];
        labels = []
        for e in first:
            ld = e['forward']['layer_decay']
            # FIX: Handle both int and string keys
            if 0 in ld:
                vec = np.array(ld[0]['attn_vec'])
            elif '0' in ld:
                vec = np.array(ld['0']['attn_vec'])
            else:
                k = sorted(ld.keys(), key=lambda x: int(x) if isinstance(x, str) else x)[0]
                vec = np.array(ld[k]['attn_vec'])
            vecs.append(vec);
            labels.append(e['position'])
        plot_attn_decay_layer(vecs, labels, layer_idx=0,
                              out_png=os.path.join(args.outdir, "attn_decay_by_position_layer0.png"))
        print("Saved attn_decay_by_position_layer0.png")

    if args.run_precision:
        print("Running precision ablation...")
        # prepare small list (use subset)
        out = run_precision_ablation(loader, subset, args.seeds)
        # if both present, compute simple KL between first example FP16 vs 4bit
        if out.get("4bit") and len(out["4bit"]) > 0:
            try:
                # FIX: Use existing models instead of reloading
                ex = subset[0]
                prompt = build_prompt_with_filler(ex["question"], ex["evidence"], "filler", 200, "middle")

                # Get fresh models for KL computation
                m_fp, tok_fp = loader(use_4bit=False)
                m_4b, tok_4b = loader(use_4bit=True)

                enc_fp = tok_fp(prompt, return_tensors="pt").to(DEVICE)
                enc_4b = tok_4b(prompt, return_tensors="pt").to(DEVICE)
                with torch.no_grad():
                    out_4b = m_4b(**enc_4b, output_attentions=False, return_dict=True)

                kl_vec = kl_per_token_logits(out_fp.logits, out_4b.logits)
                plt.figure(figsize=(8, 3));
                plt.plot(kl_vec);
                plt.xlabel("token");
                plt.ylabel("KL(P||Q)");
                plt.title("KL per token FP16 || 4-bit");
                plt.tight_layout();
                plt.savefig(os.path.join(args.outdir, "precision_kl.png"));
                plt.close()
                print("Saved precision_kl.png")

                # Clean up KL models
                cleanup_model(m_4b)
            except Exception as e:
                print("Could not compute KL plot:", e)

    # Simple aggregated EM/F1 plot across methods/conditions if outputs exist (example)
    # Gather generation results and build small aggregate
    agg = {}
    # Look for saved context file
    ctxt_file = os.path.join(args.outdir, "hotpot_context_length.json")
    if os.path.exists(ctxt_file):
        with open(ctxt_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        for r in data:
            key = f"len_{r['length_tokens']}"
            ems = [g.get("em") for g in r["generations"] if g.get("em") is not None]
            f1s = [g.get("f1") for g in r["generations"] if g.get("f1") is not None]
            agg[key] = (np.nanmean(ems) if ems else np.nan, np.nanmean(f1s) if f1s else np.nan)
        if agg:
            plot_em_f1_bar(agg, os.path.join(args.outdir, "em_f1_by_condition.png"))
            print("Saved em_f1_by_condition.png")
        else: print("something is going wrong with the plotting of em_f1, due to agg")

    print("All done. Outputs are in", args.outdir)


if __name__ == "__main__":
    main(sys.argv[1:])
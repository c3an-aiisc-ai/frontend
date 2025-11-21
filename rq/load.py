#!/usr/bin/env python3
"""
RQ2 Fatigue Experiments
----------------------
This script runs three evaluation probes to study architectural drivers of "fatigue":
1) Context-length stress
2) Positional sensitivity profile
3) Precision / quantization ablation (FP16 vs 4-bit NF4)

It instruments layer/head attentions, fits exponential decay to extract `tau` per-layer/head,
computes per-token KL between precision modes, logs entropy, repetition ratio, latency, EM/F1,
and produces a set of PNG figures for quick visualization.

USAGE: edit the top-level CONFIG block (model name, data path) and run with appropriate flags.

Notes:
- This script expects Hugging Face Transformers + bitsandbytes for 4-bit loads.
- Replace the HotpotQA sample with your JSONL of entries: each line should be {"id","question","context","evidence","answer"}
- The plotting section uses matplotlib (no seaborn) per style rules.

"""

import os
import sys
import time
import json
import math
import random
import argparse
from typing import List, Optional, Tuple, Dict

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

import torch
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig

from datasets import load_dataset
dataset = load_dataset("hotpot_qa", 'fullwiki')
print(dataset)

# ---------------- CONFIG ----------------
MODEL_NAME = "tiiuae/falcon-7b-instruct"
DATA_PATH = "data/hotpot_sample_50.jsonl"  # jsonl with fields: id, question, context, evidence, answer
OUTDIR = "rq2_outputs"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
USE_4BIT_TRY = True
SEEDS = [42, 43, 44]
TOP_P = 0.95
TEMPERATURE = 0.2
MAX_NEW_TOKENS = 128
BATCH_SIZE = 1
# ----------------------------------------

os.makedirs(OUTDIR, exist_ok=True)

# ---------- Utilities ----------
def load_jsonl(path: str) -> List[dict]:
    if not os.path.exists(path):
        raise FileNotFoundError(path)
    out = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            out.append(json.loads(line))
    return out


def normalize_answer(s: Optional[str]) -> str:
    import re, string
    if s is None:
        return ""
    s = s.lower()
    s = re.sub(r"\(.*?\)", "", s)
    s = ''.join(ch for ch in s if ch not in set(string.punctuation))
    s = ' '.join(s.split())
    return s


def f1_score(pred: str, gold: str) -> float:
    p = normalize_answer(pred).split()
    g = normalize_answer(gold).split()
    if not p and not g:
        return 1.0
    if not p or not g:
        return 0.0
    common = {}
    for t in p:
        common[t] = common.get(t, 0) + 1
    match = 0
    for t in g:
        if common.get(t, 0) > 0:
            match += 1
            common[t] -= 1
    if match == 0:
        return 0.0
    prec = match / len(p)
    rec = match / len(g)
    return 2 * prec * rec / (prec + rec)


def exact_match(pred: str, gold: str) -> float:
    return float(normalize_answer(pred) == normalize_answer(gold))

# entropy helper

def entropy_from_logits(logits: torch.Tensor) -> float:
    # logits: (batch, seq_len, vocab) or (batch, vocab)
    if logits.ndim == 3:
        l = logits[:, -1, :]
    elif logits.ndim == 2:
        l = logits
    else:
        l = logits.view(-1, logits.shape[-1])
    probs = F.softmax(l.float(), dim=-1).clamp(min=1e-12)
    ent = - (probs * probs.log()).sum(dim=-1).mean().item()
    return float(ent)

# repetition ratio: proportion of repeated n-grams in generated text

def repetition_ratio(text: str, n: int = 3) -> float:
    toks = text.split()
    if len(toks) < n:
        return 0.0
    seen = set()
    repeats = 0
    total = 0
    for i in range(len(toks)-n+1):
        ng = ' '.join(toks[i:i+n])
        total += 1
        if ng in seen:
            repeats += 1
        else:
            seen.add(ng)
    return repeats / total if total>0 else 0.0

# find sublist

def find_sublist(hay: List[int], needle: List[int]) -> Optional[int]:
    if not needle:
        return None
    for i in range(len(hay)-len(needle)+1):
        if hay[i:i+len(needle)] == needle:
            return i
    return None

# layer/head attention to span

def layer_head_attention_to_span(attentions, query_pos: int, span_indices: List[int]):
    """Return per-layer dict with per_head array and layer mean."""
    import numpy as np
    res = {}
    if attentions is None:
        return res
    # attentions: tuple(len_layers) of tensors shape (batch, num_heads, S, S)
    for li, layer in enumerate(attentions):
        tensor = layer
        if tensor.ndim == 4 and tensor.shape[0] > 1:
            # (batch, num_heads, S, S) -> take batch 0
            mat = tensor[0]
        elif tensor.ndim == 4 and tensor.shape[0] == 1:
            mat = tensor[0]
        else:
            # unexpected shape
            continue
        num_heads, S, _ = mat.shape
        valid = [i for i in span_indices if 0 <= i < S]
        if len(valid) == 0:
            per_head = np.full((num_heads,), np.nan)
        else:
            per_head = mat[:, query_pos, valid].mean(axis=1).cpu().numpy()
        res[li] = {"per_head": per_head, "layer_mean": float(np.nanmean(per_head))}
    return res

# fit exponential decay

def fit_exponential_decay(attn_weights: np.ndarray, distances: np.ndarray):
    from scipy.optimize import curve_fit
    if np.isnan(attn_weights).all():
        return {"a": np.nan, "b": np.nan, "c": np.nan, "tau": np.nan, "r2": np.nan}
    def f(x,a,b,c):
        return a * np.exp(-b * x) + c
    mask = np.isfinite(attn_weights) & np.isfinite(distances)
    if mask.sum() < 3:
        return {"a": np.nan, "b": np.nan, "c": np.nan, "tau": np.nan, "r2": np.nan}
    x = distances[mask]
    y = attn_weights[mask]
    try:
        p, _ = curve_fit(f, x, y, p0=[y.max()-y.min()+1e-6, 0.01, y.min()])
        a,b,c = p
        tau = 1.0 / b if b>0 else np.inf
        ypred = f(x,*p)
        ss_res = ((y-ypred)**2).sum(); ss_tot = ((y-y.mean())**2).sum()
        r2 = 1 - ss_res/ss_tot if ss_tot>0 else np.nan
        return {"a": float(a), "b": float(b), "c": float(c), "tau": float(tau), "r2": float(r2)}
    except Exception as e:
        return {"a": np.nan, "b": np.nan, "c": np.nan, "tau": np.nan, "r2": np.nan}

# KL per token between two logits tensors

def kl_per_token_logits(logits_p: torch.Tensor, logits_q: torch.Tensor) -> np.ndarray:
    # logits tensors: (batch, seq_len, vocab)
    with torch.no_grad():
        logp = F.log_softmax(logits_p, dim=-1)
        logq = F.log_softmax(logits_q, dim=-1)
        p = logp.exp()
        kl = (p * (logp - logq)).sum(dim=-1)  # (batch, seq_len)
        return kl.mean(dim=0).cpu().numpy()

# register hooks to collect layer residual norms (model-specific; adapt if path differs)

def attach_residual_norm_hooks(model, prefix="hook"):
    norms = {}
    handles = []
    # try to find transformer blocks; common attr: model.transformer.h or model.model.blocks
    candidates = []
    for name, module in model.named_modules():
        # heuristics: MLP output or the block's output projection often has "mlp" or "ffn" in name
        if name.endswith("mlp") or "mlp" in name.split('.')[-1] or name.endswith("feed_forward"):
            candidates.append((name, module))
    # fallback: pick top-level transformer blocks if exist
    # Note: user may need to edit this function to match model internals
    for idx, (name, mod) in enumerate(candidates):
        key = f"{prefix}_{idx}_{name.replace('.', '_')}"
        def make_hook(k):
            def hook(module, inp, out):
                try:
                    # out is usually (batch, seq, dim)
                    with torch.no_grad():
                        t = out if torch.is_tensor(out) else (out[0] if isinstance(out, (list,tuple)) else None)
                        if t is None:
                            return
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

# ---------- Model load helper ----------

def load_model_and_tokenizer(model_name: str, use_4bit: bool = False, device: str = DEVICE):
    print(f"Loading model {model_name}  use_4bit={use_4bit}")
    tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token_id
    model = None
    if use_4bit:
        try:
            bnb = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_use_double_quant=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=torch.float16)
            model = AutoModelForCausalLM.from_pretrained(model_name, quantization_config=bnb, device_map="auto", trust_remote_code=True)
            print("Loaded 4-bit model")
        except Exception as e:
            print("4-bit load failed:", e)
            model = None
    if model is None:
        kwargs = {"trust_remote_code": True}
        if device == "cuda":
            kwargs.update({"torch_dtype": torch.float16, "device_map": "auto"})
        model = AutoModelForCausalLM.from_pretrained(model_name, **kwargs)
        print("Loaded FP16/FP32 model")
    model.eval()
    return model, tokenizer

# ---------- Forward analysis (entropy + layer/head attn + tau + residual norms) ----------

def analyze_forward_instrumented(model, tokenizer, prompt: str, evidence: str, attach_hooks: bool = False, device: str = DEVICE):
    enc = tokenizer(prompt, return_tensors="pt", add_special_tokens=False)
    input_ids = enc["input_ids"].to(device)
    attention_mask = enc.get("attention_mask", None)
    if attention_mask is not None:
        attention_mask = attention_mask.to(device)
    # locate evidence token span
    ev_ids = tokenizer(evidence, return_tensors="pt", add_special_tokens=False)["input_ids"][0].tolist()
    input_list = input_ids[0].tolist()
    start = find_sublist(input_list, ev_ids)
    evidence_span = list(range(start, start+len(ev_ids))) if start is not None else []

    # attach hooks
    handle_list = []
    residual_norms = {}
    if attach_hooks:
        residual_norms, handle_list = attach_residual_norm_hooks(model, prefix="resnorm")

    with torch.no_grad():
        outputs = model(input_ids=input_ids, attention_mask=attention_mask, output_attentions=True, return_dict=True)
    logits = outputs.logits  # (1, seq_len, vocab)
    ent = entropy_from_logits(logits)
    # last token query pos
    query_pos = input_ids.shape[1] - 1
    # per-layer/head attn to evidence
    lh = layer_head_attention_to_span(outputs.attentions, query_pos=query_pos, span_indices=evidence_span)
    # for each layer compute attention vector to all tokens and fit decay
    layer_decay = {}
    import numpy as np
    for li, layer in enumerate(outputs.attentions):
        mat = layer[0] if layer.ndim==4 else layer
        # attention from query_pos to all positions
        vec = mat[:, query_pos, :].mean(axis=0).cpu().numpy()  # mean across heads
        distances = np.arange(vec.shape[0])
        fit = fit_exponential_decay(vec, distances)
        layer_decay[li] = {"attn_vec": vec.tolist(), "decay_fit": fit}
    # detach hooks
    for h in handle_list:
        try:
            h.remove()
        except Exception:
            pass
    return {
        "entropy": ent,
        "evidence_span": evidence_span,
        "layer_head_attn": {k: {"layer_mean": v["layer_mean"], "per_head": v["per_head"].tolist()} for k,v in lh.items()},
        "layer_decay": layer_decay,
        "residual_norms": residual_norms
    }

# ---------- Generation with latency + entropy + repetition + EM/F1 ----------

def generate_and_score(model, tokenizer, prompt: str, gold: Optional[str], seed:int, device: str = DEVICE):
    # deterministic generator per-seed
    gen = torch.Generator(device=device if device=="cuda" else "cpu")
    gen.manual_seed(seed)
    enc = tokenizer(prompt, return_tensors="pt", truncation=True, padding=True).to(device)
    t0 = time.perf_counter()
    with torch.no_grad():
        out = model.generate(
            **enc,
            max_new_tokens=MAX_NEW_TOKENS,
            do_sample=True,
            top_p=TOP_P,
            temperature=TEMPERATURE,
            pad_token_id=tokenizer.eos_token_id,
            eos_token_id=tokenizer.eos_token_id,
            return_dict_in_generate=True,
            output_scores=True,
            generator=gen
        )
    t1 = time.perf_counter()
    seq = tokenizer.batch_decode(out.sequences, skip_special_tokens=True)[0]
    # strip prompt prefix if present
    if seq.startswith(prompt):
        pred = seq[len(prompt):].strip()
    else:
        pred = seq.strip()
    # compute entropy of final logits if scores present
    ent = None
    try:
        # outputs.scores is list of logits for generated tokens; approximate last-token entropy
        scores = out.scores
        if scores and len(scores)>0:
            last_logits = scores[-1]
            ent = entropy_from_logits(last_logits.unsqueeze(0))
    except Exception:
        ent = None
    rep3 = repetition_ratio(pred, n=3)
    em = exact_match(pred, gold) if gold is not None else None
    f1 = f1_score(pred, gold) if gold is not None else None
    latency = t1 - t0
    return {"pred": pred, "entropy_gen": ent, "repetition3": rep3, "em": em, "f1": f1, "latency_s": latency}

# ---------- High-level experimental orchestrators ----------

def build_prompt_with_filler(question: str, evidence: str, filler_token: str, filler_len_words: int, evidence_pos: str, tokenizer):
    filler = " ".join([filler_token] * max(1, filler_len_words))
    if evidence_pos == "front":
        prompt = f"{evidence}\n\n{filler}\n\nQuestion: {question}\nAnswer:"
    elif evidence_pos == "middle":
        prompt = f"{filler}\n\n{evidence}\n\n{filler}\n\nQuestion: {question}\nAnswer:"
    elif evidence_pos == "end":
        prompt = f"{filler}\n\nQuestion: {question}\n\n{evidence}\n\nAnswer:"
    else:
        raise ValueError(evidence_pos)
    # ensure trimmed
    return prompt


def run_context_length_experiment(model, tokenizer, example, lengths_words: List[int], seeds: List[int], out_prefix: str):
    question = example["question"]
    evidence = example["evidence"]
    gold = example.get("answer")
    results = []
    for L in lengths_words:
        prompt = build_prompt_with_filler(question, evidence, filler_token="filler", filler_len_words=L, evidence_pos="middle", tokenizer=tokenizer)
        # forward instrumentation
        fw = analyze_forward_instrumented(model, tokenizer, prompt, evidence, attach_hooks=True, device=DEVICE)
        # generation across seeds
        gens = []
        for sd in seeds:
            g = generate_and_score(model, tokenizer, prompt, gold, sd, device=DEVICE)
            gens.append(g)
        results.append({"length_words": L, "forward": fw, "generations": gens})
    path = os.path.join(OUTDIR, f"{out_prefix}_context_length.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print("Saved", path)
    return results


def run_positional_experiment(model, tokenizer, example, total_context_words:int, seeds: List[int], out_prefix: str):
    question = example["question"]
    evidence = example["evidence"]
    gold = example.get("answer")
    positions = ["front","middle","end"]
    results = []
    filler_len = max(1, total_context_words // 2)
    for pos in positions:
        prompt = build_prompt_with_filler(question, evidence, filler_token="filler", filler_len_words=filler_len, evidence_pos=pos, tokenizer=tokenizer)
        fw = analyze_forward_instrumented(model, tokenizer, prompt, evidence, attach_hooks=True, device=DEVICE)
        gens = [generate_and_score(model, tokenizer, prompt, gold, sd, device=DEVICE) for sd in seeds]
        results.append({"position": pos, "forward": fw, "generations": gens})
    path = os.path.join(OUTDIR, f"{out_prefix}_positional.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print("Saved", path)
    return results


def run_precision_ablation(model_loader, example_list: List[dict], seeds: List[int], out_prefix: str):
    # load FP16 baseline
    fp_model, fp_tok = model_loader(use_4bit=False)
    # attempt 4-bit load
    model_4b = None
    try:
        model_4b, tok_4b = model_loader(use_4bit=True)
    except Exception as e:
        print("4-bit load failed:", e)
        model_4b = None
    out = {"fp16": [], "4bit": []}
    for ex in example_list:
        prompt = build_prompt_with_filler(ex["question"], ex["evidence"], filler_token="filler", filler_len_words=200, evidence_pos="middle", tokenizer=fp_tok)
        # forward FP16
        fw_fp = analyze_forward_instrumented(fp_model, fp_tok, prompt, ex["evidence"], attach_hooks=True, device=DEVICE)
        gens_fp = [generate_and_score(fp_model, fp_tok, prompt, ex.get("answer"), sd, device=DEVICE) for sd in seeds]
        entry_fp = {"id": ex.get("id"), "forward": fw_fp, "generations": gens_fp}
        out["fp16"].append(entry_fp)
        # forward 4-bit if available
        if model_4b is not None:
            fw_4b = analyze_forward_instrumented(model_4b, tok_4b, prompt, ex["evidence"], attach_hooks=True, device=DEVICE)
            gens_4b = [generate_and_score(model_4b, tok_4b, prompt, ex.get("answer"), sd, device=DEVICE) for sd in seeds]
            entry_4b = {"id": ex.get("id"), "forward": fw_4b, "generations": gens_4b}
            out["4bit"].append(entry_4b)
    path = os.path.join(OUTDIR, f"{out_prefix}_precision_ablation.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
    print("Saved", path)
    return out

# ---------- Plotting helpers ----------

def plot_tau_by_layer(decay_dicts: List[dict], labels: List[str], out_png: str):
    # decay_dicts: list of objects where each has layer_decay mapping layer-> {'decay_fit':{'tau':...}}
    taus = []
    for d in decay_dicts:
        tlist = []
        for li in sorted(d.keys(), key=lambda x: int(x)):
            tau = d[li]['decay_fit'].get('tau', np.nan)
            tlist.append(tau)
        taus.append(tlist)
    plt.figure()
    for t, lab in zip(taus, labels):
        plt.plot(t, label=lab)
    plt.xlabel('layer')
    plt.ylabel('tau (1/b)')
    plt.title('Distance decay tau by layer')
    plt.legend()
    plt.tight_layout()
    plt.savefig(out_png)
    plt.close()


def plot_attention_decay_layer(layer_attn_vecs: List[np.ndarray], labels: List[str], layer_idx: int, out_png: str):
    plt.figure()
    for vec, lab in zip(layer_attn_vecs, labels):
        plt.plot(vec, label=lab)
    plt.xlabel('token position')
    plt.ylabel('attention weight')
    plt.title(f'Attention decay (layer {layer_idx})')
    plt.legend()
    plt.tight_layout()
    plt.savefig(out_png)
    plt.close()


def plot_em_f1_bar(aggregates: Dict[str, Tuple[float,float]], out_png: str):
    # aggregates: {condition: (mean_em, mean_f1)}
    conds = list(aggregates.keys())
    ems = [aggregates[c][0] for c in conds]
    f1s = [aggregates[c][1] for c in conds]
    x = np.arange(len(conds))
    width = 0.35
    plt.figure()
    plt.bar(x - width/2, ems, width)
    plt.bar(x + width/2, f1s, width)
    plt.xticks(x, conds, rotation=45)
    plt.ylabel('score')
    plt.title('EM and F1 by condition')
    plt.tight_layout()
    plt.savefig(out_png)
    plt.close()

# ---------- CLI and main ----------

def main(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default=MODEL_NAME)
    parser.add_argument("--data", default=DATA_PATH)
    parser.add_argument("--outdir", default=OUTDIR)
    parser.add_argument("--run_context", action="store_true")
    parser.add_argument("--run_positional", action="store_true")
    parser.add_argument("--run_precision", action="store_true")
    parser.add_argument("--use_4bit_try", action="store_true")
    parser.add_argument("--seeds", nargs='+', type=int, default=SEEDS)
    args = parser.parse_args(argv)

    os.path.exists(args.outdir)
    examples = load_jsonl(args.data)
    # small check
    if len(examples) == 0:
        print('No examples in data')
        return

    # model loader
    def model_loader(use_4bit: bool = False):
        return load_model_and_tokenizer(args.model, use_4bit=use_4bit, device=DEVICE)

    # warm load baseline
    base_model, base_tok = model_loader(use_4bit=False)

    # pick first N examples (user can sample externally); here run on up to 10 examples for speed
    subset = examples[:10]

    if args.run_context:
        print('Running context-length stress...')
        lengths = [10, 200, 1000]
        all_results = []
        for ex in subset:
            r = run_context_length_experiment(base_model, base_tok, ex, lengths, args.seeds, out_prefix='hotpot')
            all_results.append(r)
        # aggregate and plot (example for first example)
        first = all_results[0]
        # extract decay dicts per condition
        decay_maps = {f"len_{x['length_words']}": x['forward']['layer_decay'] for x in first}
        labels = list(decay_maps.keys())
        plot_tau_by_layer([decay_maps[l] for l in labels], labels, os.path.join(args.outdir, 'tau_by_layer_context.png'))
        print('Saved tau_by_layer_context.png')

    if args.run_positional:
        print('Running positional sensitivity...')
        all_pos = []
        for ex in subset:
            r = run_positional_experiment(base_model, base_tok, ex, total_context_words=600, seeds=args.seeds, out_prefix='hotpot')
            all_pos.append(r)
        # example plotting for first example: attention decay for layer 0 across positions
        first = all_pos[0]
        layer_vecs = []
        labels = []
        for entry in first:
            # pick layer 0 attn vec
            ld = entry['forward']['layer_decay']
            if '0' in ld:
                vec = np.array(ld['0']['attn_vec'])
            else:
                # take first layer available
                k = sorted(ld.keys(), key=lambda x: int(x))[0]
                vec = np.array(ld[k]['attn_vec'])
            layer_vecs.append(vec)
            labels.append(entry['position'])
        plot_attention_decay_layer(layer_vecs, labels, layer_idx=0, out_png=os.path.join(args.outdir, 'attn_decay_by_position_layer0.png'))
        print('Saved attn_decay_by_position_layer0.png')

    if args.run_precision:
        print('Running precision ablation...')
        out = run_precision_ablation(model_loader, subset, args.seeds, out_prefix='hotpot')
        # if both modes present, compute per-example KL for first example (approx) and plot or save summary
        if '4bit' in out and len(out['4bit'])>0:
            print('Precision ablation produced 4-bit results')

    print('Done.')

if __name__ == '__main__':
    main(sys.argv[1:])

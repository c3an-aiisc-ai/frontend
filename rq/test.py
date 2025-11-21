import json, time, math, random, argparse, os
from typing import List, Tuple, Optional
import torch
import numpy as np
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
from tdqm import tdqm

# Configuration according to the experiment requirements
MODEL_NAME = "tiiuae/falcon-7b-instruct"
DEVICE = "cuda"
USE_4BIT = True
DEFAULT_SEEDS = [42,43,44]
OUTDIR = "outputs"
# Generation parameters according to the demo paper
TOP_P = 0.95
TEMP = 0.2
MAX_NEW_TOKENS = 128
BATCH_SIZE = 2

# helper functions from demo cod e
def ensure_dir(d):
    os.makedirs(d, exist_ok=True)

def normalize_answer(s:str) -> str:
    import re, string
    if s is None:
        return ""
    s = s.lower()
    s = re.sub(r'\(.*?\)','',s)
    s = ''.join(ch for ch in s if ch not in set(string.punctuation))
    s = ''.join(s.split())
    return s

def f1_score(pred: str, gold: str) -> float:
    p = normalize_answer(pred).split()
    g = normalize_answer(gold).split()
    if not p and not g:
        return 1.0
    if not p or not g:
        return 0
    common = {}
    for t in p:
        common[t] = common.get(t,0) + 1
    match = 0
    for t in g:
        if common.get(t,0) > 1:
            match += 1
            common[t] -= 1
    if match == 0:
        return 0.0
    precision = match / len(p)
    recall = match / len(g)
    return 2 * precision * recall / (precision + recall)

def exact_match(pred: str, gold: str) -> float:
    return float(normalize_answer(pred) == normalize_answer(gold))

def entropy_from_logits(logits: torch.Tensor) -> float:
    if logits.ndim == 3:
        logits = logits[:,-1,:]
    if logits.ndim == 2:
        logits = logits[0]
    probs = torch.nn.functional.softmax(logits.float(), dim=-1).clamp(min=1e-12)
    ent = -torch.sum(probs * torch.log(probs))
    return float(ent.item())

def find_sublist(haystack: List[int], needle: List[int]) -> Optional[int]:
    if not needle or not haystack:
        return None
    n = len(needle)
    for i in range(len(haystack) - n+1):
        if haystack[i:i+n] == needle:
            return i
    return None

def attention_to_span(attentions, query_pos:int, span_indices:List[int]) -> float:
    if attentions is None:
        return float('nan')
    last_layer = attentions[-1]
    if not torch.is_tensor(last_layer) or last_layer.ndim != 4:
        return float('nan')
    a = last_layer[0]
    num_heads, S, _ = a.shape
    valid = [i for i in span_indices if 0 <= i < S]
    if len(valid) == 0:
        return float('nan')
    row = query_pos if query_pos < S else S -1
    mean_att = a[:, row, valid].mean().item()

    # Load model
def load_model_and_tokenizer(model_name: str, use_4bit: bool = False, device: str = DEVICE):
    print(f"loading tokenizer and model:{model_name} from huggingface")
    tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token_id
    model = None
    if use_4bit:
        try:
            bnb_cfg = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_use_double_quant=True,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_compute_dtype=torch.float16
            )
            model = AutoModelForCausalLM.from_pretrained(
                model_name,
                quantization_config=bnb_cfg,
                device_map="auto",
                trust_remote_code=True
            )
            print("loaded 4 bit model")
        except Exception as e:
            print("Failed to loat 4 bit model. Error: ", e)
    model.eval()
    try:
        model.set_attn_implementation("eager")
    except Exception:
        pass
    return model, tokenizer

def analyze_prompt_forward(model, tokenizer, prompt: str, evidence_tokens:List[int]=None, return_attentions=True, device: str = DEVICE):
    enc = tokenizer(prompt, return_tensors="pt", truncation=False)
    input_ids = enc["input_ids"].to(device)
    attention_mask = enc.get("attention_mask", None)
    if attention_mask is not None:
        attention_mask = attention_mask.to(device)
    with torch.no_grad():
        outputs = model(input_ids=input_ids, attention_mask=attention_mask, output_attentions=return_attentions,return_dict=True)
    logits = outputs.logits
    ent = entropy_from_logits(logits)
    query_pos = input_ids.shape[1] -1
    attn_score = float('nan')
    if return_attentions and hasattr(outputs, "attentions"):
        if evidence_tokens is not None:
            attn_score = attention_to_span(outputs.attentions, query_pos=query_pos, span_indices=evidence_tokens)
        else:
            last_layer = outputs.attentions[-1]
            if torch.is_tensor(last_layer) and last_layer.ndim == 4:
                a = last_layer[0]
                num_heads, S, _ = a.shape
                attn_score = a[:,query_pos, :].mean().item()
    return{"entropy" : ent, "attn_to_device" : attn_score, "seq_len" : int(input_ids.shape[1])}

# build the prompts for experiments
def build_context_with_filler(base_question: str, evidence: str, filler_token: str, filler_len_tokens: int, evidence_position: str, tokenizer):
    filler_words = " ".join([filler_token] * max(1, filler_len_tokens))
    # templates
    if evidence_position == "front":
        prompt = f"{evidence}\n\n{filler_words}\n\nQuestion: {base_question}"
    elif evidence_position == "middle":
        prompt = f"{filler_words}\n\n{evidence}\n\n{filler_words}\n\nQuestion: {base_question}"
    elif evidence_position == "end":
        prompt = f"{filler_words}\n\nQuestion: {base_question}\n\n{evidence}"
    else:
        raise ValueError("bad evidence_position")
    # tokenize and find evidence token indices in the full prompt
    tokenized = tokenizer(prompt, return_tensors="pt", add_special_tokens=False)
    input_ids = tokenized["input_ids"][0].tolist()
    evidence_ids = tokenizer(evidence, return_tensors="pt", add_special_tokens=False)["input_ids"][0].tolist()
    start = find_sublist(input_ids, evidence_ids)
    if start is None:
        start = -1
        evidence_span = []
    else:
        evidence_span = list(range(start, start + len(evidence_ids)))
    return prompt, evidence_span


def generate_and_measure(model, tokenizer, prompts: List[str],gen_kwargs: dict, seeds: List[int], device: str = DEVICE):
    results = []
    device_obj = torch.device(device)
    for seed in seeds:
        torch.manual_seed(seed)
        random.seed(seed)
        np.random.seed(seed)
        if device == "cuda":
            torch.cuda.manual_seed_all(seed)
        gen = torch.Generator(device=device) # could put a cpu fallback here, but this should be run on cuda machines anyways
        gen.manual_seed(seed)
        for i in range(0, len(prompts), BATCH_SIZE):
            batch = prompts[i:i+BATCH_SIZE]
            encoded = tokenizer(batch, return_tensors="pt", padding = True, truncation = True).to(device_obj)
            start_t = time.time()
            with torch.no_grad():
                outputs - model.generate(
                    **encoded,
                    max_new_tokens = gen_kwargs.get("max_new_tokens", MAX_NEW_TOKENS),
                    do_sample=gen_kwargs.get("do_sample", True),
                    top_p = gen_kwargs.get("top_p", TOP_P),
                    temperature = gen_kwargs.get("temperature", TEMPERATURE),
                    pad_token_id = tokenizer.eos_token_id,
                    eos_token_id = tokenizer.eos_token_id,
                    return_dict_in_generate = True,
                    output_scores = True,
                    output_attentions = False,
                    generator = gen
                )
            end_t = time.time()
            elapsed = end_t - start_t
            seqs = tokenizer.batch_decode(outputs.sequences, skip_special_tokens = True)
            for j, full_text in enumerate(seqs):
                prompt_text = batch[j]
                if full_text.startswith(prompt_text):
                    pred = full_text[len(prompt_text):].strip()
                else:
                    pred = full_text.strip()
                results.append({
                    "seed": seed,
                    "prompt": batch[j],
                    "pred": pred,
                    "gen_time_s": elapsed / len(batch)
                })
    return results

def expirement_context_length(model, tokenizer, question, evidence, filler_token, lengths_tokens: List[int], seeds, out_prefix, device):
    ensure_dir(OUTDIR)
    records = []
    prompts = []
    metadata = []
    forward_stats = []

    for L in lengths_tokens:
        p, evidence_span = build_context_with_filler(question, evidence, filler_token, filler_len_tokens=L, evidence_position="middle", tokenizer=tokenizer)
        prompts.append((p, evidence_span, L))

    for p, e_span, L in prompts:
        stat = analyze_prompt_forward(model, tokenizer, p, evidence_tokens=e_span, return_attentions=True, device=device)
        stat.update({"length_tokens": L})
        forward_stats.append(stat)
    gen_prompts = [p for (p,_,_) in prompts]
    gen_results = generate_and_measure(model, tokenizer, gen_prompts, {"do_sample": True, "top_p": TOP_P, "temperature": TEMPERATURE, "max_new_tokens": MAX_NEW_TOKENS}, seeds, device=device)
    out_records = {"forward_stats": forward_stats, "generation": gen_results}
    out_path = os.path.join(OUTDIR, f"{out_prefix}_context_length.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out_records, f, indent=2)
    print("Write", out_path)
    return out_path

def experiment_positional_sensitivity( model, tokenizer, question, filler_token ,total_cointext_tokens:int, seeds, out_prefix, device):
    ensure_dir(OUTDIR)
    positions = ["front","middle","end"]
    prompts = []
    for pos in positions:
        filler_len = max(1, total_context_tokens // 2)
        p, e_span = build_context_with_filler(question, evidence, filler_token, filler_len, pos, tokenizer)
        prompts.append((pos,p,e_span))
    forward_stats = []
    for pos, p, e_span in prompts:
        s = analyze_prompt_forward(model, tokenizer, p, evidence_tokens=e_span, return_attentions=True, device=device)
        s.update({"position":pos})
        forward_stats.append(s)
    gen_prompts = [p for (_, p, _) in prompts]
    gen_results = generate_and_measure(model, tokenizer, gen_prompts, {"do_sample": True, "top_p": TOP_P, "temperature": TEMPERATURE, "max_new_tokens": MAX_NEW_TOKENS}, seeds, device=device)
    out_records = {"forward_stats": forward_stats, "generation": gen_results}
    out_path = os.path.join(OUTDIR, f"{out_prefix}_positional.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out_records, f, indent=2)
    print("Wrote", out_path)
    return out_path

def experiment_precision_abilation(model_loader, tokenizer_loader, question_evidence_pairs:List[Tuple[str,str]], filler_token, seeds, out_prefix, device):
    pass

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=str, default=MODEL_NAME)
    parser.add_argument("--device", type=str, default=DEVICE)
    parser.add_argument("--seeds", nargs="+", type=int, default=DEFAULT_SEEDS)
    parser.add_argument("--run_context_length", action="store_true")
    parser.add_argument("--run_positional", action="store_true")
    parser.add_argument("--run_precision", action="store_true")
    parser.add_argument("--use_4bit_try", action="store_true", help="Attempt to load 4-bit for precision ablation (may fail depending on bitsandbytes).")
    args = parser.parse_args()

    if args.run_context_length:
        print("Running Context-length stress experiment...")
        lengths = [10, 200, 1000]   # approx filler words -> tokens (tune as needed)
        experiment_context_length(base_model, base_tokenizer, question, evidence, filler_token="filler", lengths_tokens=lengths, seeds=args.seeds, out_prefix="hotpot", device=args.device)

    if args.run_positional:
        print("Running Positional sensitivity experiment...")
        experiment_positional_sensitivity(base_model, base_tokenizer, question, evidence, filler_token="filler", total_context_tokens=600, seeds=args.seeds, out_prefix="hotpot", device=args.device)

    if args.run_precision:
        print("Running Precision / Quantization ablation...")
        # build a small list of (question,evidence,gold) pairs to test
        pairs = [(question, evidence, gold_answer)]
        experiment_precision_ablation(model_loader, None, pairs, filler_token="filler", seeds=args.seeds, out_prefix="hotpot", device=args.device)

    print("All done.")



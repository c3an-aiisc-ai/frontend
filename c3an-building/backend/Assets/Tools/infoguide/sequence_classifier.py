from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional

from ..core.stage import Stage
from ...Resources.Schemas.artifacts import RawFrame, HFTextClassifierExport
from ..io.runfs import RunFS
from ....paths import resolve_backend_path


class TrainSequenceClassifier(Stage[RawFrame, HFTextClassifierExport]):
    REQUIRED_KEYS = [
        "dataset_path",
        "text_cols",
        "label_col",
        "labels",
        "sort_labels",
        "model_checkpoint",
        "max_length",
        "test_size",
        "seed",
        "learning_rate",
        "per_device_train_batch_size",
        "per_device_eval_batch_size",
        "num_train_epochs",
        "weight_decay",
        "evaluation_strategy",
        "save_strategy",
        "load_best_model_at_end",
        "gradient_accumulation_steps",
        "fp16",
        "lora_r",
        "lora_alpha",
        "lora_dropout",
        "lora_target_modules",
        "save_merged",
        "save_adapter",
        "output_dir",
    ]

    def __init__(self):
        super().__init__("infoguide_train_sequence_classifier", RawFrame, HFTextClassifierExport)

    @staticmethod
    def _load_config(config_path: str) -> Dict[str, Any]:
        import yaml

        cfg_path = resolve_backend_path(config_path)
        if not cfg_path.exists():
            raise FileNotFoundError(f"Config not found: {cfg_path}")
        cfg = yaml.safe_load(cfg_path.read_text(encoding="utf-8")) or {}
        if not isinstance(cfg, dict):
            raise ValueError("Config must be a mapping (YAML dictionary)")
        missing = [key for key in TrainSequenceClassifier.REQUIRED_KEYS if key not in cfg]
        if missing:
            raise ValueError(f"Config missing required keys: {missing}")
        return cfg

    @staticmethod
    def _load_dataframe(dataset_path: str):
        import pandas as pd

        suffix = Path(dataset_path).suffix.lower()
        if suffix in {".xlsx", ".xls"}:
            return pd.read_excel(dataset_path)
        if suffix == ".csv":
            return pd.read_csv(dataset_path)
        if suffix == ".json":
            return pd.read_json(dataset_path)
        raise ValueError(f"Unsupported dataset file: {dataset_path}")

    @staticmethod
    def _build_texts(examples: Dict[str, List[Any]], text_cols: List[str]) -> Dict[str, List[str]]:
        if not text_cols:
            return {"text": [""] * len(next(iter(examples.values()), []))}
        row_count = len(examples[text_cols[0]])
        texts: List[str] = []
        for idx in range(row_count):
            parts: List[str] = []
            for col in text_cols:
                if col not in examples:
                    continue
                value = examples[col][idx]
                value_str = str(value).strip()
                if value_str and value_str.lower() != "nan":
                    parts.append(value_str)
            texts.append(" ".join(parts).strip() or " ")
        return {"text": texts}

    def run(self, inp: RawFrame, **kwargs) -> HFTextClassifierExport:
        config_path = kwargs.get("config_path")
        if not config_path:
            raise ValueError("config_path is required; InfoGuide parameters must come from config files")
        extra_keys = set(kwargs.keys()) - {"config_path", "fs"}
        if extra_keys:
            raise ValueError(f"Direct parameters are not allowed; move these to config: {sorted(extra_keys)}")

        cfg = self._load_config(config_path)

        dataset_path = str(resolve_backend_path(str(cfg["dataset_path"]), must_exist=True))
        text_cols = cfg["text_cols"] or []
        label_col = str(cfg["label_col"])
        labels = cfg["labels"]
        sort_labels = bool(cfg["sort_labels"])

        model_checkpoint = str(cfg["model_checkpoint"])
        test_size = float(cfg["test_size"])
        seed = int(cfg["seed"])
        max_length = int(cfg["max_length"])

        learning_rate = float(cfg["learning_rate"])
        per_device_train_batch_size = int(cfg["per_device_train_batch_size"])
        per_device_eval_batch_size = int(cfg["per_device_eval_batch_size"])
        num_train_epochs = int(cfg["num_train_epochs"])
        weight_decay = float(cfg["weight_decay"])
        evaluation_strategy = str(cfg["evaluation_strategy"])
        save_strategy = str(cfg["save_strategy"])
        load_best_model_at_end = bool(cfg["load_best_model_at_end"])
        gradient_accumulation_steps = int(cfg["gradient_accumulation_steps"])
        fp16 = bool(cfg["fp16"])

        lora_r = int(cfg["lora_r"])
        lora_alpha = int(cfg["lora_alpha"])
        lora_dropout = float(cfg["lora_dropout"])
        lora_target_modules = cfg["lora_target_modules"] or []

        save_merged = bool(cfg["save_merged"])
        save_adapter = bool(cfg["save_adapter"])

        fs: Optional[RunFS] = kwargs.get("fs")
        output_dir = cfg.get("output_dir")
        if output_dir:
            base_dir = resolve_backend_path(str(output_dir))
        elif fs is not None:
            base_dir = fs.tertiary / "infoguide_distilbert_lora"
        else:
            base_dir = Path("Data") / "Tertiary" / "infoguide_distilbert_lora"
        base_dir.mkdir(parents=True, exist_ok=True)

        df = self._load_dataframe(dataset_path)
        missing = [col for col in list(text_cols) + [label_col] if col not in df.columns]
        if missing:
            raise KeyError(f"Missing columns in dataset: {missing}")

        df = df.dropna(subset=[label_col]).copy()
        for col in text_cols:
            df[col] = df[col].fillna("")
        df[label_col] = df[label_col].astype(str)

        if labels is None:
            unique_labels = df[label_col].unique().tolist()
            if sort_labels:
                unique_labels = sorted(unique_labels)
            labels = [str(label) for label in unique_labels]
        else:
            labels = [str(label) for label in labels]

        id2label = {i: label for i, label in enumerate(labels)}
        label2id = {label: i for i, label in enumerate(labels)}

        try:
            from datasets import Dataset
        except ImportError as exc:
            raise ImportError("datasets is required for sequence classifier training") from exc

        dataset = Dataset.from_pandas(df, preserve_index=False)
        dataset = dataset.map(lambda ex: self._build_texts(ex, text_cols), batched=True)
        dataset = dataset.map(
            lambda ex: {"labels": [label2id[str(item)] for item in ex[label_col]]},
            batched=True,
        )
        drop_cols = [col for col in dataset.column_names if col not in {"text", "labels"}]
        dataset = dataset.remove_columns(drop_cols)
        dataset = dataset.train_test_split(test_size=test_size, seed=seed)

        try:
            from transformers import (
                AutoTokenizer,
                AutoModelForSequenceClassification,
                DataCollatorWithPadding,
                TrainingArguments,
                Trainer,
            )
        except ImportError as exc:
            raise ImportError("transformers is required for sequence classifier training") from exc

        tokenizer = AutoTokenizer.from_pretrained(model_checkpoint)
        added_pad = False
        if tokenizer.pad_token is None:
            tokenizer.add_special_tokens({"pad_token": "[PAD]"})
            added_pad = True

        def tokenize_function(examples: Dict[str, List[str]]):
            return tokenizer(
                examples["text"],
                truncation=True,
                max_length=max_length,
            )

        tokenized = dataset.map(tokenize_function, batched=True)
        data_collator = DataCollatorWithPadding(tokenizer=tokenizer)

        model = AutoModelForSequenceClassification.from_pretrained(
            model_checkpoint,
            num_labels=len(labels),
            id2label=id2label,
            label2id=label2id,
        )
        if added_pad:
            model.resize_token_embeddings(len(tokenizer))

        try:
            from peft import LoraConfig, TaskType, get_peft_model
        except ImportError as exc:
            raise ImportError("peft is required for LoRA training") from exc

        peft_config = LoraConfig(
            task_type=TaskType.SEQ_CLS,
            r=lora_r,
            lora_alpha=lora_alpha,
            lora_dropout=lora_dropout,
            target_modules=lora_target_modules,
        )
        model = get_peft_model(model, peft_config)

        try:
            import numpy as np
        except ImportError as exc:
            raise ImportError("numpy is required for sequence classifier training") from exc

        accuracy_metric = None
        try:
            import evaluate

            accuracy_metric = evaluate.load("accuracy")
        except Exception:
            accuracy_metric = None

        def compute_metrics(eval_pred):
            logits, labels_arr = eval_pred
            preds = np.argmax(logits, axis=1)
            if accuracy_metric is not None:
                return accuracy_metric.compute(predictions=preds, references=labels_arr)
            accuracy = float((preds == labels_arr).mean()) if len(labels_arr) else 0.0
            return {"accuracy": accuracy}

        adapter_dir = base_dir / "adapter"
        adapter_dir.mkdir(parents=True, exist_ok=True)

        # Some transformers versions do not support newer TrainingArguments keyword args.
        # Safely filter config keys to those the current library accepts.
        import inspect

        training_kwargs = {
            "output_dir": str(adapter_dir),
            "learning_rate": learning_rate,
            "per_device_train_batch_size": per_device_train_batch_size,
            "per_device_eval_batch_size": per_device_eval_batch_size,
            "num_train_epochs": num_train_epochs,
            "weight_decay": weight_decay,
            "evaluation_strategy": evaluation_strategy,
            "save_strategy": save_strategy,
            "load_best_model_at_end": load_best_model_at_end,
            "gradient_accumulation_steps": gradient_accumulation_steps,
            "fp16": fp16,
            "metric_for_best_model": "accuracy",
            "greater_is_better": True,
        }

        accepted_args = set(inspect.signature(TrainingArguments).parameters.keys())
        filtered_kwargs = {k: v for k, v in training_kwargs.items() if k in accepted_args}
        dropped = set(training_kwargs) - set(filtered_kwargs)
        if dropped:
            print(f"âš ï¸  TrainingArguments does not accept: {sorted(dropped)} (skipping)")

        training_args = TrainingArguments(**filtered_kwargs)
        trainer_kwargs = {
            "model": model,
            "args": training_args,
            "train_dataset": tokenized["train"],
            "eval_dataset": tokenized["test"],
            "data_collator": data_collator,
            "compute_metrics": compute_metrics,
        }
        # Older transformers builds may not accept tokenizer in Trainer.__init__.
        if "tokenizer" in inspect.signature(Trainer.__init__).parameters:
            trainer_kwargs["tokenizer"] = tokenizer

        trainer = Trainer(**trainer_kwargs)

        trainer.train()

        metrics = trainer.evaluate()
        metrics_json = base_dir / "metrics.json"
        metrics_json.write_text(
            __import__("json").dumps({k: float(v) for k, v in metrics.items()}, indent=2)
        )

        label_map_json = base_dir / "label_map.json"
        label_map_json.write_text(
            __import__("json").dumps({"id2label": id2label, "label2id": label2id}, indent=2)
        )

        if save_adapter:
            trainer.save_model(str(adapter_dir))
            tokenizer.save_pretrained(str(adapter_dir))

        model_dir = str(adapter_dir)
        if save_merged:
            merged_dir = base_dir / "merged"
            merged_dir.mkdir(parents=True, exist_ok=True)
            merged = model.merge_and_unload()
            merged.save_pretrained(str(merged_dir))
            tokenizer.save_pretrained(str(merged_dir))
            model_dir = str(merged_dir)

        return HFTextClassifierExport(
            model_dir=model_dir,
            adapter_dir=str(adapter_dir) if save_adapter else None,
            metrics_json=str(metrics_json),
            label_map_json=str(label_map_json),
        )

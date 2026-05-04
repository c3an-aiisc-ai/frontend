from __future__ import annotations

import importlib
import csv
import json
import os
import tempfile
from dataclasses import asdict, is_dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from .paths import BACKEND_ROOT, resolve_backend_path

REGISTRY_DIR = BACKEND_ROOT / "Agents" / "Registries"
RUNTIME_REGISTRY_PATH = REGISTRY_DIR / "agent.json"
CATALOG_REGISTRY_PATH = REGISTRY_DIR / "agent_registry.json"

DEFAULT_CONFIG_PATHS = {
    "predictx": "Assets/Resources/Configs/predictx.yaml",
    "foresight": "Assets/Resources/Configs/foresight.yaml",
    "causaltrace": "Assets/Resources/Configs/causal.yaml",
    "infoguide": "Assets/Resources/Configs/infoguide.yaml",
}

AGENT_ALIASES = {
    "predictx-agent": "predictx",
    "predictx": "predictx",
    "foresight-agent": "foresight",
    "foresight": "foresight",
    "causaltrace-agent": "causaltrace",
    "causaltrace": "causaltrace",
    "causal_trace": "causaltrace",
    "causalpulse": "causaltrace",
    "infoguide-agent": "infoguide",
    "infoguide": "infoguide",
}

PILOT_ALIASES = {
    **AGENT_ALIASES,
    "all": "all",
}


def _load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _load_yaml(path_value: str | None) -> dict[str, Any]:
    if not path_value:
        return {}
    import yaml

    path = resolve_backend_path(path_value)
    if not path.exists():
        return {}
    cfg = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return cfg if isinstance(cfg, dict) else {}


def _deep_merge(base: dict[str, Any], override: dict[str, Any] | None) -> dict[str, Any]:
    if not override:
        return dict(base)
    merged = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def to_jsonable(value: Any) -> Any:
    if is_dataclass(value):
        return to_jsonable(asdict(value))
    if isinstance(value, dict):
        return {str(k): to_jsonable(v) for k, v in value.items() if not str(k).startswith("_")}
    if isinstance(value, (list, tuple, set)):
        return [to_jsonable(item) for item in value]
    if isinstance(value, Path):
        return str(value)
    if hasattr(value, "item"):
        try:
            return value.item()
        except Exception:
            pass
    if hasattr(value, "tolist"):
        try:
            return value.tolist()
        except Exception:
            pass
    return value


def normalize_agent_id(agent_id: str) -> str:
    normalized = str(agent_id or "").strip().lower().replace("-", "_")
    canonical = AGENT_ALIASES.get(normalized) or AGENT_ALIASES.get(normalized.replace("_", "-"))
    if canonical:
        return canonical
    raise ValueError(f"Unknown agent '{agent_id}'.")


def normalize_pilots(raw: Any) -> list[str]:
    if raw is None:
        return ["predictx", "foresight", "causaltrace"]
    if isinstance(raw, str):
        parts = [part.strip().lower() for part in raw.split(",") if part.strip()]
    elif isinstance(raw, list):
        parts = [str(part).strip().lower() for part in raw if str(part).strip()]
    else:
        raise ValueError("pilots must be a comma-separated string or list.")

    if not parts or "all" in parts:
        return ["predictx", "foresight", "causaltrace"]

    pilots: list[str] = []
    for part in parts:
        alias = PILOT_ALIASES.get(part.replace("-", "_")) or PILOT_ALIASES.get(part.replace("_", "-"))
        if alias is None:
            raise ValueError("Unsupported pilot. Use predictx, foresight, infoguide, causaltrace, causalpulse, or all.")
        if alias != "all" and alias not in pilots:
            pilots.append(alias)
    return pilots


def get_runtime_registry() -> dict[str, Any]:
    return _load_json(RUNTIME_REGISTRY_PATH)


def get_catalog_registry() -> dict[str, Any]:
    return _load_json(CATALOG_REGISTRY_PATH)


def get_agent_registry_payload() -> dict[str, Any]:
    runtime = get_runtime_registry()
    catalog = get_catalog_registry()
    return {
        "runtime": runtime,
        "catalog": catalog,
        "agents": runtime.get("agents", []),
    }


def get_agent_manifest(agent_id: str) -> dict[str, Any]:
    canonical = normalize_agent_id(agent_id)
    for agent in get_runtime_registry().get("agents", []):
        if normalize_agent_id(str(agent.get("id", ""))) == canonical:
            return dict(agent)
    raise ValueError(f"Agent '{agent_id}' is not registered.")


def get_agent_catalog_entry(agent_id: str) -> dict[str, Any] | None:
    canonical = normalize_agent_id(agent_id)
    for agent in get_catalog_registry().get("agents", []):
        try:
            if normalize_agent_id(str(agent.get("id", ""))) == canonical:
                return dict(agent)
        except ValueError:
            continue
    return None


def get_agent_tools(agent_id: str) -> list[dict[str, Any]]:
    catalog_entry = get_agent_catalog_entry(agent_id)
    if not catalog_entry:
        return []
    tools = catalog_entry.get("tools")
    return tools if isinstance(tools, list) else []


def _load_agent(agent_id: str) -> Any:
    from .Assets.Tools.io.runfs import RunFS

    manifest = get_agent_manifest(agent_id)
    class_path = str(manifest.get("agent_class", "")).strip()
    if not class_path or "." not in class_path:
        raise ValueError(f"Agent '{agent_id}' is missing a valid agent_class.")
    module_name, class_name = class_path.rsplit(".", 1)
    module = importlib.import_module(module_name)
    agent_cls = getattr(module, class_name)
    return agent_cls(RunFS(str(BACKEND_ROOT)))


def _call_agent_tool(agent_id: str, tool_name: str, inputs: dict[str, Any]) -> Any:
    canonical = normalize_agent_id(agent_id)
    tool = str(tool_name or "").strip().lower()
    agent = _load_agent(canonical)

    dispatch: dict[str, Callable[..., Any]]
    if canonical == "predictx":
        dispatch = {
            "predictx_preprocess": agent.preprocess,
            "predictx_train": agent.train,
            "predictx_infer_fusion": agent.infer_fusion,
        }
    elif canonical == "foresight":
        dispatch = {
            "foresight_train": agent.train,
            "foresight_infer": agent.infer,
        }
    elif canonical == "causaltrace":
        dispatch = {
            "causaltrace_run": agent.run,
        }
    elif canonical == "infoguide":
        dispatch = {
            "infoguide_route": agent.route_request,
            "infoguide_build_context": agent.build_context,
            "infoguide_run": agent.run,
        }
    else:
        dispatch = {}

    if tool not in dispatch:
        available = ", ".join(sorted(dispatch)) or "none"
        raise ValueError(f"Tool '{tool_name}' is not available for agent '{agent_id}'. Available: {available}.")
    return dispatch[tool](**inputs)


def run_agent_tool(agent_id: str, tool_name: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    body = payload or {}
    inputs = body.get("inputs") if isinstance(body.get("inputs"), dict) else body
    started_at = datetime.now(timezone.utc)
    result = _call_agent_tool(agent_id, tool_name, dict(inputs))
    completed_at = datetime.now(timezone.utc)
    return {
        "agent_id": normalize_agent_id(agent_id),
        "tool": tool_name,
        "status": "completed",
        "started_at": started_at.isoformat(),
        "completed_at": completed_at.isoformat(),
        "result": to_jsonable(result),
    }


def _config_path(payload: dict[str, Any], name: str) -> str:
    configs = payload.get("configs") if isinstance(payload.get("configs"), dict) else {}
    aliases = {
        "causaltrace": ["causaltrace", "causal_trace", "causalpulse", "causal"],
    }.get(name, [name])
    candidate_keys = [f"{alias}_config" for alias in aliases] + aliases
    return str(
        next((payload.get(key) for key in candidate_keys if payload.get(key)), None)
        or next((configs.get(key) for key in candidate_keys if configs.get(key)), None)
        or DEFAULT_CONFIG_PATHS[name]
    )


def _workflow_output_dir(payload: dict[str, Any]) -> Path:
    raw_out_dir = str(payload.get("out_dir") or "Data/Tertiary/smart_pilot_outputs")
    requested_dir = resolve_backend_path(raw_out_dir)
    if os.environ.get("VERCEL") and not str(requested_dir).startswith(tempfile.gettempdir()):
        requested_dir = Path(tempfile.gettempdir()) / "c3an-smartpilot" / Path(raw_out_dir).name

    try:
        requested_dir.mkdir(parents=True, exist_ok=True)
        return requested_dir
    except OSError:
        out_dir = Path(tempfile.gettempdir()) / "c3an-smartpilot" / Path(raw_out_dir).name
        out_dir.mkdir(parents=True, exist_ok=True)
        return out_dir


def _load_workflow_configs(payload: dict[str, Any]) -> dict[str, dict[str, Any]]:
    overrides = payload.get("config_overrides") if isinstance(payload.get("config_overrides"), dict) else {}
    loaded: dict[str, dict[str, Any]] = {}
    for name in ("predictx", "foresight", "causaltrace", "infoguide"):
        override = overrides.get(name)
        if name == "causaltrace":
            override = override or overrides.get("causal") or overrides.get("causalpulse") or overrides.get("causal_trace")
        loaded[name] = _deep_merge(_load_yaml(_config_path(payload, name)), override)
    return loaded


def _require_config_value(cfg: dict[str, Any], key: str, label: str) -> Any:
    value = cfg.get(key)
    if value in (None, ""):
        raise ValueError(f"{label} requires '{key}' in config or request overrides.")
    return value


def _short_csv_value(value: Any, *, max_len: int = 120) -> str:
    text = "" if value is None else str(value)
    if len(text) <= max_len:
        return text
    return f"{text[: max_len - 3]}..."


def _read_csv_sample(path_value: str | None, *, limit: int = 5) -> dict[str, Any]:
    if not path_value:
        return {
            "path": None,
            "columns": [],
            "rows": [],
            "row_count": 0,
            "error": "Dataset path is not configured.",
        }

    resolved = resolve_backend_path(path_value, must_exist=True)
    rows: list[dict[str, str]] = []
    row_count = 0
    with resolved.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        columns = list(reader.fieldnames or [])
        for raw_row in reader:
            row_count += 1
            if len(rows) < limit:
                rows.append({str(key): _short_csv_value(value) for key, value in raw_row.items() if key is not None})

    return {
        "path": path_value,
        "resolved_path": str(resolved),
        "columns": columns,
        "rows": rows,
        "row_count": row_count,
    }


def _read_csv_rows(path_value: str | None) -> tuple[list[dict[str, str]], str, list[str]]:
    if not path_value:
        raise ValueError("Dataset path is not configured.")
    resolved = resolve_backend_path(path_value, must_exist=True)
    with resolved.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        rows = [
            {str(key): "" if value is None else str(value) for key, value in row.items() if key is not None}
            for row in reader
        ]
        return rows, str(resolved), list(reader.fieldnames or [])


def _float_value(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _write_predictions_csv(out_dir: Path, filename: str, predictions: list[list[float]]) -> str | None:
    try:
        out_path = out_dir / filename
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with out_path.open("w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            width = max((len(row) for row in predictions), default=0)
            writer.writerow([f"y_pred_{index}" for index in range(width)])
            writer.writerows(predictions)
        return str(out_path)
    except OSError:
        return None


def _run_predictx_lightweight(configs: dict[str, dict[str, Any]], out_dir: Path, reason: str) -> dict[str, Any]:
    cfg = configs["predictx"]
    infer_cfg = cfg.get("infer") if isinstance(cfg.get("infer"), dict) else {}
    features_csv = infer_cfg.get("features_csv")
    rows, resolved_path, columns = _read_csv_rows(features_csv)
    ts_feature_cols = infer_cfg.get("ts_feature_cols") or [column for column in columns if column.startswith("ts_pred_")]
    img_feature_cols = infer_cfg.get("img_feature_cols") or [column for column in columns if column.startswith("img_prob_")]
    knowledge_col = infer_cfg.get("knowledge_col", "knowledge_adjustment")
    image_present_col = infer_cfg.get("image_present_col", "has_image")

    predictions: list[list[float]] = []
    explanations: list[str] = []
    for row in rows:
        ts_values = [_float_value(row.get(column)) for column in ts_feature_cols]
        img_values = [_float_value(row.get(column)) for column in img_feature_cols]
        knowledge = _float_value(row.get(knowledge_col))
        has_image = _float_value(row.get(image_present_col), 1.0 if img_values else 0.0)
        ts_signal = sum(ts_values) / len(ts_values) if ts_values else 0.0
        image_signal = max(img_values) if img_values else 0.0
        anomaly_score = max(0.0, min(1.0, abs(ts_signal) * 0.5 + image_signal * 0.4 + abs(knowledge) * 0.1))
        if has_image <= 0:
            anomaly_score *= 0.8
        predictions.append([round(ts_signal, 4), round(image_signal, 4), round(anomaly_score, 4)])
        explanations.append(
            f"sensor={ts_signal:.3f}, image={image_signal:.3f}, knowledge={knowledge:.3f}, has_image={has_image:.0f}"
        )

    predictions_csv = _write_predictions_csv(out_dir, "predictx_lightweight_predictions.csv", predictions)
    return {
        "pilot": "predictx",
        "status": "completed",
        "count": len(predictions),
        "artifacts": {
            "dataset_path": resolved_path,
            "predictions_csv": predictions_csv,
            "execution_mode": "lightweight_dataset_fallback",
        },
        "result": {
            "predictions": predictions,
            "count": len(predictions),
            "execution_mode": "lightweight_dataset_fallback",
            "fallback_reason": reason,
            "explanation": "Derived anomaly scores from checked-in PredictX fusion feature columns for serverless demo execution.",
            "row_explanations": explanations,
        },
    }


def _run_foresight_lightweight(configs: dict[str, dict[str, Any]], out_dir: Path, reason: str) -> dict[str, Any]:
    cfg = configs["foresight"]
    infer_cfg = cfg.get("infer") if isinstance(cfg.get("infer"), dict) else {}
    production_csv = infer_cfg.get("production_csv") or cfg.get("production_csv")
    process_csv = infer_cfg.get("process_csv") or cfg.get("process_csv")
    rows, resolved_path, _ = _read_csv_rows(production_csv)
    label_cols = infer_cfg.get("label_cols") or cfg.get("label_cols") or ["Yeast - BRD", "Yeast - BRN", "Yeast - FMX"]

    values_by_part: dict[str, list[float]] = {}
    for row in rows:
        part = str(row.get("Part") or "").strip()
        if not part:
            continue
        values_by_part.setdefault(part, []).append(_float_value(row.get("VYP - Yeast Weight")))

    prediction: list[float] = []
    explanations: list[str] = []
    for part in label_cols:
        series = values_by_part.get(str(part), [])
        if not series:
            prediction.append(0.0)
            explanations.append(f"{part}: no production history found")
            continue
        last_value = series[-1]
        previous_value = series[-2] if len(series) > 1 else last_value
        forecast = last_value + (last_value - previous_value)
        prediction.append(round(forecast, 4))
        explanations.append(f"{part}: last={last_value:.3f}, previous={previous_value:.3f}, trend forecast={forecast:.3f}")

    predictions = [prediction] if prediction else []
    predictions_csv = _write_predictions_csv(out_dir, "foresight_lightweight_predictions.csv", predictions)
    return {
        "pilot": "foresight",
        "status": "completed",
        "count": len(predictions),
        "artifacts": {
            "production_dataset_path": resolved_path,
            "process_dataset_path": str(resolve_backend_path(process_csv)) if process_csv else None,
            "predictions_csv": predictions_csv,
            "execution_mode": "lightweight_dataset_fallback",
        },
        "result": {
            "predictions": predictions,
            "count": len(predictions),
            "label_cols": label_cols,
            "execution_mode": "lightweight_dataset_fallback",
            "fallback_reason": reason,
            "explanation": "Derived a one-step trend forecast from the checked-in ForeSight production sample for serverless demo execution.",
            "row_explanations": explanations,
        },
    }


def _build_infoguide_knowledge(rows: list[dict[str, str]]) -> str:
    chunks: list[str] = []
    for row in rows:
        series = row.get("Original Time Series") or row.get("time_series") or ""
        question_1 = row.get("Instruction1") or ""
        answer_1 = row.get("Output1_from_LLM") or row.get("predicted_label") or ""
        question_2 = row.get("Instruction2") or ""
        answer_2_parts = [row.get("Output2_1_from_LLM") or "", row.get("Output2_2_from_LLM") or ""]
        answer_2 = ", ".join(part for part in answer_2_parts if part)

        if question_1 or answer_1:
            chunks.append(f"Time series: {series}\nQuestion: {question_1}\nAnswer: {answer_1}".strip())
        if question_2 or answer_2:
            chunks.append(f"Time series: {series}\nQuestion: {question_2}\nAnswer: {answer_2}".strip())

    return "\n\n".join(chunks)


def _build_smart_pilot_demo_sample(
    configs: dict[str, dict[str, Any]],
    *,
    question: str | None = None,
) -> dict[str, Any]:
    predictx_cfg = configs.get("predictx", {})
    predictx_infer = predictx_cfg.get("infer") if isinstance(predictx_cfg.get("infer"), dict) else {}
    foresight_cfg = configs.get("foresight", {})
    infoguide_cfg = configs.get("infoguide", {})

    warnings: list[str] = []

    def sample_or_error(path_value: str | None, *, limit: int = 5) -> dict[str, Any]:
        try:
            return _read_csv_sample(path_value, limit=limit)
        except Exception as exc:
            warnings.append(str(exc))
            return {
                "path": path_value,
                "columns": [],
                "rows": [],
                "row_count": 0,
                "error": str(exc),
            }

    predictx_sample = sample_or_error(predictx_infer.get("features_csv"), limit=4)
    production_sample = sample_or_error(foresight_cfg.get("production_csv"), limit=6)
    process_sample = sample_or_error(foresight_cfg.get("process_csv"), limit=6)
    infoguide_sample = sample_or_error(infoguide_cfg.get("dataset_path"), limit=4)

    info_rows = infoguide_sample.get("rows") if isinstance(infoguide_sample.get("rows"), list) else []
    qa_row = next(
        (
            row
            for row in info_rows
            if isinstance(row, dict) and (row.get("Instruction1") or row.get("Instruction2"))
        ),
        info_rows[0] if info_rows else {},
    )
    infer_cfg = infoguide_cfg.get("infer") if isinstance(infoguide_cfg.get("infer"), dict) else {}
    demo_question = (
        question
        or qa_row.get("Instruction1")
        or qa_row.get("Instruction2")
        or infer_cfg.get("query")
        or "What are the anomalies that happen in next time step?"
    )
    demo_answer = qa_row.get("Output1_from_LLM") or qa_row.get("Output2_1_from_LLM") or qa_row.get("predicted_label") or ""
    knowledge_text = _build_infoguide_knowledge([row for row in info_rows if isinstance(row, dict)])

    return {
        "datasets": {
            "predictx_features": predictx_sample,
            "foresight_production": production_sample,
            "foresight_process": process_sample,
            "infoguide_qa": {
                **infoguide_sample,
                "question": demo_question,
                "answer": demo_answer,
                "knowledge_text": knowledge_text,
            },
        },
        "modalities": [
            "sensor/time-series features",
            "image probability features",
            "production process data",
            "domain Q&A text",
        ],
        "warnings": warnings,
    }


def get_smart_pilot_demo_sample(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    body = payload or {}
    configs = _load_workflow_configs(body)
    return _build_smart_pilot_demo_sample(configs, question=body.get("question") or body.get("user_query"))


def _run_predictx_infer(configs: dict[str, dict[str, Any]], out_dir: Path) -> dict[str, Any]:
    cfg = configs["predictx"]
    infer_cfg = cfg.get("infer") if isinstance(cfg.get("infer"), dict) else {}
    features_csv = infer_cfg.get("features_csv")
    if not features_csv:
        raise ValueError("PredictX inference requires infer.features_csv. Add PredictX sample features or pass config_overrides.predictx.infer.features_csv.")

    out_csv = infer_cfg.get("out_csv") or str(out_dir / "predictx_fusion_infer_predictions.csv")
    try:
        result = _call_agent_tool(
            "predictx",
            "predictx_infer_fusion",
            {
                "features_csv": features_csv,
                "model_path": infer_cfg.get("model_path"),
                "ts_feature_cols": infer_cfg.get("ts_feature_cols"),
                "img_feature_cols": infer_cfg.get("img_feature_cols"),
                "include_knowledge": bool(infer_cfg.get("include_knowledge", True)),
                "include_image_presence": bool(infer_cfg.get("include_image_presence", True)),
                "image_present_col": infer_cfg.get("image_present_col", "has_image"),
                "knowledge_col": infer_cfg.get("knowledge_col", "knowledge_adjustment"),
                "export_csv_path": out_csv,
            },
        )
    except (ImportError, FileNotFoundError, ModuleNotFoundError) as exc:
        return _run_predictx_lightweight(configs, out_dir, str(exc))
    return {
        "pilot": "predictx",
        "status": "completed",
        "count": result.get("count", 0) if isinstance(result, dict) else 0,
        "artifacts": {
            "model_path": result.get("model_path") if isinstance(result, dict) else None,
            "predictions_csv": result.get("predictions_csv") if isinstance(result, dict) else None,
        },
        "result": to_jsonable(result),
    }


def _run_foresight_infer(configs: dict[str, dict[str, Any]], out_dir: Path) -> dict[str, Any]:
    cfg = configs["foresight"]
    infer_cfg = cfg.get("infer") if isinstance(cfg.get("infer"), dict) else {}
    production_csv = infer_cfg.get("production_csv") or cfg.get("production_csv")
    process_csv = infer_cfg.get("process_csv") or cfg.get("process_csv")
    if not production_csv or not process_csv:
        raise ValueError("ForeSight inference requires production_csv and process_csv.")

    out_csv = infer_cfg.get("out_csv") or str(out_dir / "foresight_infer_predictions.csv")
    try:
        result = _call_agent_tool(
            "foresight",
            "foresight_infer",
            {
                "production_csv": production_csv,
                "process_csv": process_csv,
                "model_path": infer_cfg.get("model_path"),
                "seq_feature_cols": infer_cfg.get("seq_feature_cols"),
                "exog_feature_cols": infer_cfg.get("exog_feature_cols"),
                "label_cols": infer_cfg.get("label_cols"),
                "look_back": int(infer_cfg.get("look_back", cfg.get("look_back", 30))),
                "time_floor": infer_cfg.get("time_floor", cfg.get("time_floor", "h")),
                "datetime_format": infer_cfg.get("datetime_format", cfg.get("datetime_format", "%d/%m/%Y %H:%M:%S")),
                "export_csv_path": out_csv,
            },
        )
    except (ImportError, FileNotFoundError, ModuleNotFoundError) as exc:
        return _run_foresight_lightweight(configs, out_dir, str(exc))
    return {
        "pilot": "foresight",
        "status": "completed",
        "count": result.get("count", 0) if isinstance(result, dict) else 0,
        "artifacts": {
            "model_path": result.get("model_path") if isinstance(result, dict) else None,
            "predictions_csv": result.get("predictions_csv") if isinstance(result, dict) else None,
        },
        "result": to_jsonable(result),
    }


def _run_infoguide_demo(configs: dict[str, dict[str, Any]], out_dir: Path) -> dict[str, Any]:
    from .simple_llm import build_smartpilot_llm

    sample = _build_smart_pilot_demo_sample(configs)
    info_sample = sample.get("datasets", {}).get("infoguide_qa", {})
    question = str(info_sample.get("question") or "What are the anomalies that happen in next time step?")
    knowledge_text = str(info_sample.get("knowledge_text") or info_sample.get("answer") or question)
    dataset_answer = str(info_sample.get("answer") or "").strip()
    if dataset_answer:
        knowledge_text = f"Question: {question}\nAnswer: {dataset_answer}\n\n{knowledge_text}"
    infer_cfg = configs.get("infoguide", {}).get("infer")
    infer_cfg = infer_cfg if isinstance(infer_cfg, dict) else {}
    llm = build_smartpilot_llm()

    route = _call_agent_tool(
        "infoguide",
        "infoguide_route",
        {
            "user_query": question,
            "mode": "documentation",
        },
    )
    agent_output = _call_agent_tool(
        "infoguide",
        "infoguide_run",
        {
            "user_query": question,
            "knowledge_text": knowledge_text,
            "llm": llm,
            "mode": "documentation",
            "system_template": str(infer_cfg.get("system_template") or "You answer manufacturing questions using retrieved context."),
            "top_k": int(infer_cfg.get("top_k", 1)),
            "use_symbolic": True,
            "use_neural": False,
        },
    )
    result = {
        "question": question,
        "route": route,
        "response": agent_output.get("response") if isinstance(agent_output, dict) else None,
        "agent_output": agent_output,
        "dataset_answer": dataset_answer,
        "dataset_path": info_sample.get("path"),
        "llm": type(llm).__name__,
    }
    return {
        "pilot": "infoguide",
        "status": "completed",
        "count": 1 if result.get("response") else 0,
        "artifacts": {
            "dataset_path": info_sample.get("path"),
        },
        "result": to_jsonable(result),
    }


def _run_causaltrace(configs: dict[str, dict[str, Any]], out_dir: Path) -> dict[str, Any]:
    cfg = configs["causaltrace"]
    csv_path = _require_config_value(cfg, "csv_path", "CausalTrace")
    export = _call_agent_tool(
        "causaltrace",
        "causaltrace_run",
        {
            "csv_path": csv_path,
            "feature_cols": cfg.get("feature_cols"),
            "sample_size": cfg.get("sample_size"),
            "output_html_name": cfg.get("output_html_name", "lingam_causal_graph.html"),
            "run_bootstrap": bool(cfg.get("run_bootstrap", False)),
            "bootstrap_n": int(cfg.get("bootstrap_n", 20)),
            "bootstrap_seed": int(cfg.get("bootstrap_seed", 42)),
            "run_batch_eval": bool(cfg.get("run_batch_eval", False)),
            "batch_tolerance": float(cfg.get("batch_tolerance", 50.0)),
        },
    )
    return {
        "pilot": "causaltrace",
        "status": "completed",
        "artifacts": to_jsonable(export),
        "result": to_jsonable(export),
    }


def _error_result(pilot: str, exc: Exception) -> dict[str, Any]:
    return {
        "pilot": pilot,
        "status": "error",
        "error_type": type(exc).__name__,
        "error": str(exc),
        "artifacts": {},
        "result": {},
    }


def _run_pilot(pilot: str, configs: dict[str, dict[str, Any]], out_dir: Path) -> dict[str, Any]:
    runners = {
        "predictx": _run_predictx_infer,
        "foresight": _run_foresight_infer,
        "infoguide": _run_infoguide_demo,
        "causaltrace": _run_causaltrace,
    }
    if pilot not in runners:
        raise ValueError(f"Unsupported pilot '{pilot}'.")
    return runners[pilot](configs, out_dir)


def _first_prediction(result: dict[str, Any] | None) -> list[Any]:
    payload = result.get("result") if isinstance(result, dict) else {}
    predictions = payload.get("predictions") if isinstance(payload, dict) else None
    if isinstance(predictions, list) and predictions:
        first = predictions[0]
        return first if isinstance(first, list) else [first]
    return []


def _build_smart_pilot_final_response(results: dict[str, Any]) -> str:
    from .simple_llm import synthesize_final_response
    return synthesize_final_response(results)


def run_smart_pilot_workflow(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    body = payload or {}
    pilots = normalize_pilots(body.get("pilots"))
    continue_on_error = bool(body.get("continue_on_error", True))
    out_dir = _workflow_output_dir(body)
    configs = _load_workflow_configs(body)

    started_at = datetime.now(timezone.utc)
    results: dict[str, Any] = {}
    for pilot in pilots:
        try:
            results[pilot] = _run_pilot(pilot, configs, out_dir)
        except Exception as exc:
            if not continue_on_error:
                raise
            results[pilot] = _error_result(pilot, exc)

    completed_at = datetime.now(timezone.utc)
    final_response = _build_smart_pilot_final_response(results)
    summary = {
        "workflow": "smart_pilot",
        "status": "completed" if all(item.get("status") == "completed" for item in results.values()) else "partial",
        "pilots_requested": pilots,
        "started_at": started_at.isoformat(),
        "completed_at": completed_at.isoformat(),
        "output_dir": str(out_dir),
        "final_response": final_response,
        "results": results,
    }
    artifacts: dict[str, Any] = {}
    try:
        summary_path = out_dir / "smart_pilot_summary.json"
        trace_path = out_dir / "smart_pilot_trace.json"
        summary_path.write_text(json.dumps(to_jsonable(summary), indent=2, default=str), encoding="utf-8")
        trace_path.write_text(json.dumps(to_jsonable(results), indent=2, default=str), encoding="utf-8")
        artifacts = {
            "summary_path": str(summary_path),
            "trace_path": str(trace_path),
        }
    except OSError as exc:
        artifacts = {
            "write_error": str(exc),
            "output_dir": str(out_dir),
        }
    summary["artifacts"] = artifacts
    return summary


def route_smart_pilot_question(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    body = payload or {}
    question = str(body.get("question") or body.get("user_query") or "").strip()
    if not question:
        raise ValueError("question or user_query is required.")

    mode = str(body.get("mode") or body.get("route_mode") or "auto").strip().lower()
    route_inputs = {
        "user_query": question,
        "mode": None if mode == "auto" else mode,
    }
    route_info = _call_agent_tool("infoguide", "infoguide_route", route_inputs)
    target_agent = normalize_agent_id(str(route_info.get("target_agent", "")))

    routed_payload = dict(body)
    routed_payload["pilots"] = [target_agent]
    workflow = run_smart_pilot_workflow(routed_payload)
    return {
        "question": question,
        "route": to_jsonable(route_info),
        "selected_agent": target_agent,
        "workflow": workflow,
    }

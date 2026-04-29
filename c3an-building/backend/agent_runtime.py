from __future__ import annotations

import importlib
import json
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
            raise ValueError("Unsupported pilot. Use predictx, foresight, causaltrace, causalpulse, or all.")
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

    dispatch: dict[str, dict[str, Callable[..., Any]]] = {
        "predictx": {
            "predictx_preprocess": agent.preprocess,
            "predictx_train": agent.train,
            "predictx_infer_fusion": agent.infer_fusion,
        },
        "foresight": {
            "foresight_train": agent.train,
            "foresight_infer": agent.infer,
        },
        "causaltrace": {
            "causaltrace_run": agent.run,
        },
        "infoguide": {
            "infoguide_route": agent.route_request,
            "infoguide_build_context": agent.build_context,
            "infoguide_run": agent.run,
        },
    }

    agent_tools = dispatch.get(canonical, {})
    if tool not in agent_tools:
        available = ", ".join(sorted(agent_tools)) or "none"
        raise ValueError(f"Tool '{tool_name}' is not available for agent '{agent_id}'. Available: {available}.")
    return agent_tools[tool](**inputs)


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
    out_dir = resolve_backend_path(raw_out_dir)
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


def _run_predictx_infer(configs: dict[str, dict[str, Any]], out_dir: Path) -> dict[str, Any]:
    cfg = configs["predictx"]
    infer_cfg = cfg.get("infer") if isinstance(cfg.get("infer"), dict) else {}
    features_csv = infer_cfg.get("features_csv")
    if not features_csv:
        raise ValueError("PredictX inference requires infer.features_csv. Add PredictX sample features or pass config_overrides.predictx.infer.features_csv.")

    out_csv = infer_cfg.get("out_csv") or str(out_dir / "predictx_fusion_infer_predictions.csv")
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
        "causaltrace": _run_causaltrace,
    }
    if pilot not in runners:
        raise ValueError(f"Unsupported pilot '{pilot}'.")
    return runners[pilot](configs, out_dir)


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
    summary = {
        "workflow": "smart_pilot",
        "status": "completed" if all(item.get("status") == "completed" for item in results.values()) else "partial",
        "pilots_requested": pilots,
        "started_at": started_at.isoformat(),
        "completed_at": completed_at.isoformat(),
        "output_dir": str(out_dir),
        "results": results,
    }
    summary_path = out_dir / "smart_pilot_summary.json"
    trace_path = out_dir / "smart_pilot_trace.json"
    summary_path.write_text(json.dumps(to_jsonable(summary), indent=2, default=str), encoding="utf-8")
    trace_path.write_text(json.dumps(to_jsonable(results), indent=2, default=str), encoding="utf-8")
    summary["artifacts"] = {
        "summary_path": str(summary_path),
        "trace_path": str(trace_path),
    }
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

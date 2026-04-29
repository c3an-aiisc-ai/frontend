# Backend Agent Runtime

This backend exposes modular agents and tools to the frontend workflow builder. The main idea is:

- Agents are registered in `Agents/Registries/agent.json`.
- Tool metadata for the UI lives in `Agents/Registries/agent_registry.json`.
- Runtime loading, path handling, and Smart Pilot orchestration live in `agent_runtime.py`.
- Flask routes in `app.py` expose the runtime under `/api/...`.

## Important Paths

All agent-local paths are resolved from the `backend/` directory.

Examples:

```text
Data/Primary/Foresight/foresight_test_production.csv
Data/Primary/Causal/uploaded_dataset.csv
Agents/foresight_agent/saved_models/foresight_lstm_model.pth
Agents/PredictX/saved_models/predictx_fusion_model.pth
```

From the repo root, those correspond to:

```text
backend/Data/Primary/Foresight/foresight_test_production.csv
backend/Data/Primary/Causal/uploaded_dataset.csv
backend/Agents/foresight_agent/saved_models/foresight_lstm_model.pth
backend/Agents/PredictX/saved_models/predictx_fusion_model.pth
```

## PredictX `features_csv`

PredictX fusion inference requires a feature CSV. The old pilot expected:

```text
Data/Primary/PredictX/fusion_features_sample.csv
```

That file is not currently in this repo. Add it at:

```text
backend/Data/Primary/PredictX/fusion_features_sample.csv
```

Then update `Assets/Resources/Configs/predictx.yaml`:

```yaml
infer:
  features_csv: Data/Primary/PredictX/fusion_features_sample.csv
  model_path: Agents/PredictX/saved_models/predictx_fusion_model.pth
  out_csv: Agents/PredictX/saved_models/predictx_fusion_infer_predictions.csv
```

You can also pass it directly from the frontend request instead of editing the config.

## Discovery Endpoints

Use these for the workflow builder palette and block details.

```http
GET /api/agents/registry
GET /api/agents/<agent_id>
GET /api/agents/<agent_id>/tools
```

Supported agent IDs include:

```text
predictx
foresight
causaltrace
infoguide
```

Aliases such as `predictx-agent`, `foresight-agent`, `causalpulse`, and `causal_trace` are normalized by `agent_runtime.py`.

## Run One Tool

```http
POST /api/agents/<agent_id>/tools/<tool_name>/run
Content-Type: application/json
```

The request body can be either raw tool inputs or `{ "inputs": { ... } }`.

### ForeSight Inference

```json
{
  "inputs": {
    "production_csv": "Data/Primary/Foresight/foresight_test_production.csv",
    "process_csv": "Data/Primary/Foresight/foresight_test_process.csv",
    "model_path": "Agents/foresight_agent/saved_models/foresight_lstm_model.pth",
    "export_csv_path": "Data/Tertiary/foresight_infer_predictions.csv"
  }
}
```

Call:

```http
POST /api/agents/foresight/tools/foresight_infer/run
```

### CausalTrace Run

```json
{
  "inputs": {
    "csv_path": "Data/Primary/Causal/uploaded_dataset.csv",
    "sample_size": 1000,
    "output_html_name": "lingam_causal_graph.html"
  }
}
```

Call:

```http
POST /api/agents/causaltrace/tools/causaltrace_run/run
```

### PredictX Fusion Inference

```json
{
  "inputs": {
    "features_csv": "Data/Primary/PredictX/fusion_features_sample.csv",
    "model_path": "Agents/PredictX/saved_models/predictx_fusion_model.pth",
    "export_csv_path": "Data/Tertiary/predictx_fusion_predictions.csv"
  }
}
```

Call:

```http
POST /api/agents/predictx/tools/predictx_infer_fusion/run
```

### InfoGuide Route

```json
{
  "inputs": {
    "user_query": "Why did the gripper load spike?",
    "mode": null
  }
}
```

Call:

```http
POST /api/agents/infoguide/tools/infoguide_route/run
```

## Run The Smart Pilot Workflow

This endpoint runs the composed workflow from the pilot script. It can fan out to multiple pilots and collect their outputs.

```http
POST /api/workflows/smart-pilot/run
Content-Type: application/json
```

Example:

```json
{
  "pilots": ["foresight", "causaltrace"],
  "continue_on_error": true,
  "out_dir": "Data/Tertiary/smart_pilot_outputs"
}
```

To pass missing or user-selected inputs without editing YAML:

```json
{
  "pilots": ["predictx"],
  "config_overrides": {
    "predictx": {
      "infer": {
        "features_csv": "Data/Primary/PredictX/fusion_features_sample.csv"
      }
    }
  }
}
```

## Route A Question Through InfoGuide

```http
POST /api/workflows/smart-pilot/route
Content-Type: application/json
```

Example:

```json
{
  "question": "What is the next hour production?",
  "route_mode": "auto",
  "continue_on_error": true
}
```

The response includes the InfoGuide route result and the downstream Smart Pilot workflow result.

## What `agent_runtime.py` Does

`agent_runtime.py` is the backend orchestration layer. It:

- Loads agent manifests from `Agents/Registries/agent.json`.
- Loads UI/tool metadata from `Agents/Registries/agent_registry.json`.
- Normalizes agent aliases like `causalpulse` to `causaltrace`.
- Dynamically imports agent classes from the registry.
- Creates each agent with `RunFS(backend_root)`.
- Dispatches tool names like `foresight_infer` to the correct agent method.
- Converts dataclass artifacts and paths into JSON-safe responses.
- Resolves workflow config files and request overrides.
- Runs the Smart Pilot workflow and writes summary/trace JSON files.

Keep endpoint-specific HTTP handling in `app.py`; keep reusable agent execution logic in `agent_runtime.py`.

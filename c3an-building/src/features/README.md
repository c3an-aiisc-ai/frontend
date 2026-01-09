# Features

Feature modules represent the main pages and user-facing functionality of the application.

## Modules

### workflow/
**Main workflow editor canvas**

The primary interface for building agent workflows. Users drag blocks and tools onto an infinite canvas, connect them via input/output ports, and configure their properties.

| File | Purpose |
|------|---------|
| `WorkflowEditorPage.tsx` | Main page component with canvas state management |
| `AgentViewLoadingScreen.tsx` | Loading state for agent view |
| `PlanViewLoadingScreen.tsx` | Loading state for plan view |
| `utils/planDownload.ts` | Export workflow as downloadable plan |
| `utils/workflowIO.ts` | Import/export workflow JSON |

**Key concepts:**
- **Agent Blocks** — Configurable AI agent nodes with typed I/O
- **Tool Nodes** — External tool integrations
- **Connections** — Typed links between node ports
- **View Modes** — Switch between agent view and plan view

---

### planning/
**Task decomposition interface**

Allows users to import task plans as JSON and visualize them as connected planning blocks. Plans can be saved and loaded into the workflow editor.

| File | Purpose |
|------|---------|
| `PlanningPage.tsx` | JSON import and plan preview interface |

**Input format:**
```json
{
  "task_id": "task-001",
  "main_task": "Task description",
  "sub_tasks": [...],
  "triples": [{ "from": "st-001", "op": "seq", "to": "st-002" }]
}
```

**Operations:**
- `seq` — Sequential dependency
- `brn` — Branch (parallel)
- `agg` — Aggregate (join)

---

### evaluation/
**Metrics and evaluation configuration**

Configure evaluation metrics, map inputs to outputs, and define assessment criteria for workflows.

| File | Purpose |
|------|---------|
| `EvaluationPage.tsx` | Main evaluation configuration UI |
| `constants.ts` | Default values and category styles |
| `types.ts` | Evaluation-specific type definitions |
| `utils.ts` | Mapping normalization helpers |

**Components:**
- Input/output field management
- Metric library with categorized options
- Mapping table for input→output→metrics

---

### agent-gen/
**Agent generation interface**

Interface for generating and configuring new agent definitions.

| File | Purpose |
|------|---------|
| `AgentGenPage.tsx` | Agent generation UI |

## Adding a New Feature

1. Create a directory under `features/`
2. Add a main page component (`FeatureNamePage.tsx`)
3. Add feature-specific types, constants, utils as needed
4. Register the route in the app routing configuration

# Components

Shared UI components used across the application.

## Directory Structure

```
components/
├── canvas/        # Canvas nodes and visual elements
├── modals/        # Modal dialogs
├── ui/            # Sidebar, toolbar, panels
├── evaluation/    # Evaluation-specific components
└── background.tsx # Canvas background pattern
```

## Canvas Components

Visual elements rendered on the workflow canvas.

| Component | Description |
|-----------|-------------|
| `AgentBlock` | Agent node with configurable inputs/outputs |
| `ToolNode` | Tool integration node with styling variants |
| `PlanningBlockNode` | Planning view task block |
| `ConnectionLines` | SVG paths connecting nodes |
| `HandleDot` | Input/output port indicators |
| `AgentCanvasView` | Agent view canvas container |
| `PlanCanvasView` | Plan view canvas container |
| `PlanningCanvas` | Canvas for planning mode |

### Node Anatomy

```
┌─────────────────────────────┐
│  ● Input 1                  │
│  ○ Input 2 (optional)       │
│                             │
│       [Agent Name]          │
│       Description           │
│                             │
│              Output 1 ●     │
│              Output 2 ○     │
└─────────────────────────────┘
```

- **● Filled dot** — Required port
- **○ Empty dot** — Optional port

## Modal Components

| Component | Description |
|-----------|-------------|
| `BlockDetailsModal` | Edit agent block properties |
| `ToolDetailsModal` | Edit tool node configuration |
| `EvalsModal` | Evaluation settings dialog |

## UI Components

### Sidebar (`ui/side_bar/`)

| Component | Description |
|-----------|-------------|
| `Sidebar` | Main sidebar container |
| `BlocksPanel` | Draggable agent block library |
| `ToolsPanel` | Draggable tool library |
| `SettingsPanel` | Application settings |

### Toolbar (`ui/tool_bar/`)

| Component | Description |
|-----------|-------------|
| `Toolbar` | Top toolbar with view controls |

## Evaluation Components

| Component | Description |
|-----------|-------------|
| `StreamPanel` | Input/output stream configuration |
| `MetricLibrary` | Categorized metric selection |
| `MappingList` | Input→output→metric mappings |

## Usage Pattern

Components receive data and callbacks as props. State management happens in parent pages or hooks.

```tsx
<AgentBlock
  block={blockData}
  selected={isSelected}
  onRemove={() => handleRemove(blockData.id)}
  onDetailsClick={() => openModal(blockData.id)}
/>
```

## Exports

Each subdirectory has an `index.ts` that re-exports public components:

```tsx
import { AgentBlock, ToolNode } from "@/components/canvas";
import { Sidebar, Toolbar } from "@/components/ui";
```

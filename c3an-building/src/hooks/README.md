# Hooks

Custom React hooks that encapsulate reusable stateful logic.

## Overview

Hooks in this directory handle:
- Canvas interactions (drag, drop, zoom, pan)
- Node linking and connection management
- Workspace state and persistence
- Keyboard shortcuts and hotkeys

## Hook Reference

### Canvas Interactions

| Hook | Purpose |
|------|---------|
| `usePanZoom` | Pan and zoom the canvas with mouse/trackpad |
| `useCanvasDragHandlers` | Handle dragging nodes on the canvas |
| `useCanvasDrop` | Handle dropping items onto the canvas |
| `useSidebarDragHandlers` | Handle dragging items from sidebar |
| `useCanvasSelection` | Track selected nodes |
| `useHandleVisibility` | Show/hide connection handles on hover |

### Node Management

| Hook | Purpose |
|------|---------|
| `useNodeHandles` | Calculate handle positions for nodes |
| `useBlockIO` | Manage block input/output configuration |
| `useCanvasLinking` | Create and manage node connections |
| `useIdCounters` | Generate unique IDs for new nodes |

### Workspace

| Hook | Purpose |
|------|---------|
| `useWorkspace` | Core workspace state (blocks, tools, connections) |
| `useWorkspaceActions` | Workspace mutations (add, remove, update) |
| `useWorkflowImport` | Import workflow from JSON |
| `useWorkflowDownload` | Export workflow to JSON |
| `useWorkflowReset` | Reset workspace to initial state |
| `useWorkflowHotkeys` | Keyboard shortcuts (delete, undo, etc.) |

### Planning

| Hook | Purpose |
|------|---------|
| `usePlanWorkflow` | Plan-to-workflow conversion |
| `usePlanBench` | Planning workspace state |

## Usage Example

```tsx
import { usePanZoom, useWorkspace } from "@/hooks";

function WorkflowEditor() {
  const { transform, handlers } = usePanZoom();
  const { blocks, tools, connections } = useWorkspace();

  return (
    <div {...handlers}>
      <Canvas transform={transform}>
        {blocks.map(block => <AgentBlock key={block.id} {...block} />)}
      </Canvas>
    </div>
  );
}
```

## Composition Pattern

Complex behavior is built by composing hooks:

```tsx
function WorkflowEditorPage() {
  // Core state
  const workspace = useWorkspace();
  const actions = useWorkspaceActions(workspace);
  
  // Interactions
  const panZoom = usePanZoom();
  const dragHandlers = useCanvasDragHandlers(workspace, panZoom);
  const linkHandlers = useCanvasLinking(workspace);
  
  // Features
  useWorkflowHotkeys(workspace, actions);
  
  return <Canvas {...panZoom} {...dragHandlers} {...linkHandlers} />;
}
```

## State Flow

```
User Action → Hook Handler → State Update → Re-render
                  ↓
           Side Effects (localStorage, etc.)
```

## Adding a New Hook

1. Create the hook file in `hooks/`
2. Follow naming convention: `useFeatureName.ts`
3. Export from `hooks/index.ts`
4. Keep hooks focused on a single responsibility

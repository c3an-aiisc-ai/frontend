# C3AN Workflow Builder (Frontend)

Vite + React + TypeScript frontend for visually building and inspecting a C3AN-style workflow.

The core UI is a canvas-based editor where you can:

- Place **Agent blocks** and **Tool nodes**
- Connect outputs → inputs to represent data/step flow
- Import/export a lightweight **plan JSON** (triples-based)
- Inspect details via modals (block/tool/evals)

This repository is currently frontend-only. It includes API route constants for future/optional backend integration, but most of the app today is driven by local registries and client-side parsing/hydration.

## Quickstart

Prereqs: Node.js (LTS recommended) + npm.

```bash
npm install
npm run dev
```

Open the URL printed by Vite (typically `http://localhost:5173`).

## Scripts

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run preview` — preview the production build locally
- `npm run lint` — run ESLint

## Project map

This is a “tour” of the repo, organized top-down.

## Inside `src/`

### `src/assets/`
Static assets for the frontend (icons/images/etc). This folder exists for the usual React/Vite conventions.

- Current status: present, but not heavily used.

### `src/components/`
Reusable UI components and the editor “building blocks” used by the workflow editor page.

#### `src/components/index.ts`
Barrel export for components. Re-exports:

- everything from `src/components/canvas/`
- everything from `src/components/ui/`
- everything from `src/components/modals/`
- `Background` from `src/components/background.tsx`

This lets the app import from `../components` instead of deep paths.

#### `src/components/background.tsx`
Dot-grid background renderer that sits behind the canvas. It draws an SVG pattern and is designed to “move with the camera” so the grid stays visually consistent as you pan/zoom.

#### `src/components/canvas/`
Canvas/editor components for both the agent workflow view and plan view.

- `AgentBlock.tsx`
  - Renders a workflow agent node: name/mode, input/output counts, tool count, remove button, and connection handle interactions.

- `HandleDot.tsx`
  - Small circular connector UI used for link handles.

- `ConnectionLines.tsx`
  - Renders arrows/lines between nodes.
  - Also renders the “preview” line (usually dashed) while the user is actively linking.

- `ToolNode.tsx`
  - Renders a workflow tool node (gradient block), remove action, and output handles.

- `PlanningBlockNode.tsx`
  - Renders a single “plan card” in plan view.
  - Handles “enter workflow” action, link handles, remove action, and showing plan info (e.g. query/title/mode).

- `PlanningCanvas.tsx`
  - Plan-view canvas: zooming/panning, dragging plan cards, and drawing plan-to-plan connections.

- `planOps.ts`
  - Plan semantics helpers (e.g. normalize/interpret plan operations like branch/sequence/aggregate).

- `index.ts`
  - Barrel export for commonly-used canvas components.
  - Note: some components (like `PlanningCanvas`) are imported directly rather than via the barrel.

#### `src/components/io_streams/`
Client-side plan IO utilities (import/export) and parsing helpers.

- `handleIO.ts`
  - Agent-view “IO source of truth” helpers.
  - Imports a plan JSON shape (`plan_id`, `query`, `intent`, `metadata`, `triples`) and hydrates it into an editable canvas model:
    - creates one `AgentBlock` per unique agent label
    - lays blocks out left-to-right
    - generates stable block-to-block connections with deterministic input/output slot allocation
  - Export does the reverse: takes blocks + connections and emits triples (and infers ops).

- `parsePlan.ts`
  - Parses/sanitizes the plan JSON payload into the internal planning types used by the UI.

#### `src/components/modals/`
Modal dialogs used by the editor.

- `BlockDetailsModal.tsx`
  - Opens from an agent block “details” action.
  - Shows block name plus inbound/outbound inputs/outputs, and related tool attachment info.

- `ToolDetailsModal.tsx`
  - Opens when viewing a tool’s details.

- `EvalsModal.tsx`
  - Opens from the toolbar “Evals” action.

- `index.ts`
  - Barrel export for modals.

#### `src/components/ui/`
Higher-level UI chrome around the canvas.

- `index.ts`
  - Barrel export for top-level UI components (`Sidebar`, `Toolbar`).

- `side_bar/`
  - Left sidebar (tabs + panels) used to drive editor actions.
  - `Sidebar.tsx`: renders the overall left sidebar UI: vertical tab buttons + slideout panel area, and switches content based on the active panel / mode.
  - `BlocksPanel.tsx`: agent block/palette logic for the sidebar.
  - `ToolsPanel.tsx`: tool palette/panel content.
  - `SettingsPanel.tsx`: settings panel content/logic.

- `tool_bar/`
  - Top-right toolbar actions.
  - `Toolbar.tsx`: renders action buttons (e.g. About/Evals/Download/Upload).

### `src/constants/`
Centralized constants and registries used across the app.

- `agentRegistry.ts`
  - Helper functions to look up agents and their data streams by id/name.

- `registries/`
  - JSON registries (e.g. `agent_registry.json`, `data_registry.json`) that back the in-editor palettes/metadata.

- `routes.ts`
  - Frontend-side URL builders for agent API endpoints (e.g. `/api/agents`, `/api/agents/:id/capabilities`).
  - This is for calling a backend; it does not contain backend logic.

- `index.ts`
  - Barrel export for constants and preset values used across the UI.

### `src/hooks/`
Custom React hooks shared across the editor.

- `useWorkspace.ts`
  - Workspace/editor state utilities.

- `zoom.tsx`
  - Pan/zoom behavior (used by the canvas/editor).

- `index.ts`
  - Barrel export for hooks.

### `src/pages/`
Route-level pages.

- `WorkflowEditorPage.tsx`
  - Main application page.
  - Hosts the workflow canvas + planning canvas + sidebar + toolbar.
  - Wires together registry data, plan import/export, selection state, and modals.

- `index.ts`
  - Barrel export for pages.

### `src/types/`
TypeScript types for the workflow editor.

- `planning.ts`
  - Types for plan JSON / planning blocks.

- `index.ts`
  - Barrel export for types.

### Entry points

- `src/main.tsx`
  - React entry point (mounts the app).

- `src/App.tsx`
  - App shell / top-level component.

- `src/index.css`, `src/App.css`
  - Global and app-level styles.

## About `routes.ts`

`src/constants/routes.ts` defines *string builders* for backend endpoints like:

- `/api/agents`
- `/api/agents/:id/capabilities`
- `/api/agents/:id/streams/input`

It does not implement backend logic. It only standardizes the URLs the frontend would call when/if you add a backend.

Note: this repo does not currently configure a Vite dev proxy in `vite.config.ts`, so `/api/...` requests will only work if an API is served from the same origin, or if you add a proxy.

## Data flow (high level)

- **Static registries** provide default agent/tool metadata (streams, names, descriptions).
- **Plan JSON** import parses triples (`from`, `op`, `to`) and hydrates blocks + connections.
- The canvas renders nodes and connections and allows editing.

If you want, tell me where your backend runs (host/port), and I can add a minimal Vite proxy + a small API client module that uses `AGENT_ROUTES`.

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

- `src/pages/WorkflowEditorPage.tsx`
  - Main editor page that hosts the workflow canvas + surrounding panels.

- `src/components/canvas/`
  - Canvas/editor primitives: blocks, tool nodes, handles, connection lines.
  - Planning helpers (e.g. plan ops / layout-ish logic) live alongside.

- `src/components/io_streams/`
  - Plan JSON parsing + import/export helpers used to hydrate the editor from a saved plan.
  - Example entry points include `importAgentViewPlanJson(...)` / `exportAgentViewPlanJson(...)`.

- `src/constants/`
  - Static “source of truth” values used across the UI.
  - `registries/` contains JSON registries (agents/data).
  - `agentRegistry.ts` exposes helpers for looking up agents/streams.
  - `routes.ts` defines frontend-side URL builders for agent API endpoints.

- `src/components/modals/` and `src/components/ui/`
  - Reusable UI + modals used by the editor.

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

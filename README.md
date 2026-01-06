# C3AN Frontend Repo Map

This README focuses on the folder structure and what each area is responsible for.

**Top Level**
- `c3an-building/` Frontend workspace root.
- `c3an-building/dist/` Build output (generated).
- `c3an-building/node_modules/` Installed dependencies (generated).
- `c3an-building/public/` Static assets served as-is.
- `c3an-building/scripts/` Repo utilities (e.g., unused source scan).
- `c3an-building/src/` Application source (details below).

**src**
- `src/app/` App shell and top-level layout wiring.
- `src/features/` Feature pages and their local components, hooks, and utilities.
- `src/shared/` Cross-feature types, constants, registries, and helpers.
- `src/styles/` Extracted component styles for readability.
- `src/main.tsx` App entry point and bootstrapping.
- `src/index.css` Global styles.
- `src/App.tsx` Root component.
- `src/App.css` App-level styles.

**src/features**
- `src/features/workflow/` Workflow editor and canvas interactions.
- `src/features/workflow/components/` Editor UI building blocks.
- `src/features/workflow/components/canvas/` Nodes, connectors, and canvas visuals.
- `src/features/workflow/components/modals/` Block/tool/evals modals.
- `src/features/workflow/components/ui/` Sidebar, toolbar, and panels.
- `src/features/workflow/hooks/` Editor state, drag/zoom/link, IO hooks.
- `src/features/workflow/utils/` Workflow IO helpers and plan download shaping.
- `src/features/planning/` Planning page and plan JSON intake/preview.
- `src/features/agent-gen/` Agent generator page and JSON intake.
- `src/features/evaluation/` Evaluation page UI and supporting components.

**src/shared**
- `src/shared/assets/` Icon assets used by the UI.
- `src/shared/constants/` Registries, presets, and shared constants.
- `src/shared/constants/registries/` JSON registries for agents.
- `src/shared/planning/` Plan parsing and hydration utilities.
- `src/shared/types/` Shared TypeScript types.
- `src/shared/utils/` Generic helpers and custom agent/plan storage.

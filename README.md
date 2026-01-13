# C3AN Frontend

Visual workflow editor for building and orchestrating AI agent systems.

## Overview

C3AN is a canvas-based application that enables users to design multi-agent workflows through a drag-and-drop interface. Users can compose agent blocks, connect them with tools, and define evaluation metrics—all within an interactive visual environment.

### Core Capabilities

| Feature | Description |
|---------|-------------|
| **Workflow Editor** | Drag-and-drop canvas for building agent pipelines |
| **Planning View** | High-level task decomposition and dependency mapping |
| **Agent Blocks** | Configurable AI agent nodes with typed inputs/outputs |
| **Tool Integration** | Connect external tools and services to agent workflows |
| **Evaluation System** | Define metrics and mappings for workflow assessment |

## Quick Start

```bash
cd c3an-building
npm install
npm run dev
```

The app runs at `http://localhost:5173` by default.

## Project Structure

```
c3an-building/
├── src/
│   ├── features/        # Page-level features (workflow, planning, evaluation)
│   ├── components/      # Reusable UI components (canvas, modals, sidebar)
│   ├── hooks/           # Custom React hooks for state and interactions
│   ├── shared/          # Types, constants, and utilities
│   └── styles/          # Global and component styles
├── public/              # Static assets
└── scripts/             # Build utilities
```

## Tech Stack

- **React 19** — UI framework
- **TypeScript** — Type safety
- **Vite** — Build tooling
- **Tailwind CSS** — Styling

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## Architecture

The application follows a feature-based architecture:

1. **Features** contain page components and feature-specific logic
2. **Components** are shared across features (canvas nodes, modals, UI elements)
3. **Hooks** encapsulate reusable stateful logic (drag handling, zoom, linking)
4. **Shared** provides types, constants, and utilities used throughout

See [c3an-building/src/README.md](c3an-building/src/README.md) for detailed source documentation.

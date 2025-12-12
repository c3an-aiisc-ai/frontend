// =============================================================================
// Type Definitions for C3AN Workflow Builder
// =============================================================================

// -----------------------------------------------------------------------------
// Core Node Types
// -----------------------------------------------------------------------------

export type Note = {
  id: string;
  x: number;
  y: number;
  text: string;
};

export type AgentBlock = {
  id: string;
  x: number;
  y: number;
  name: string;
  description: string;
  inputCount: number;
  outputCount: number;
  inputRequired: boolean[];
  outputRequired: boolean[];
  inputNames?: string[];
  outputNames?: string[];
  presetId?: string;
  mandatoryInputCount?: number;
  mandatoryOutputCount?: number;
};

export type ToolNode = {
  id: string;
  x: number;
  y: number;
  name: string;
  tagline: string;
  gradient: string;
  ring: string;
  accent: string;
  inputCount: number;
  outputCount: number;
  inputRequired: boolean[];
  outputRequired: boolean[];
  inputNames?: string[];
  outputNames?: string[];
  mandatoryInputCount?: number;
  mandatoryOutputCount?: number;
};

export type ToolPreset = Omit<ToolNode, "id" | "x" | "y">;

export type UploadNode = {
  id: string;
  x: number;
  y: number;
  name: string;
  status: "idle" | "ready";
  fileName?: string;
  fileSize?: number;
  fileType?: string;
};

export type OutputNode = {
  id: string;
  x: number;
  y: number;
  name: string;
  format: string;
};

// -----------------------------------------------------------------------------
// Clipboard Types
// -----------------------------------------------------------------------------

export type ClipboardItem =
  | { type: "block"; data: AgentBlock }
  | { type: "tool"; data: ToolNode }
  | { type: "upload"; data: UploadNode }
  | { type: "output"; data: OutputNode }
  | { type: "note"; data: Note };

// -----------------------------------------------------------------------------
// Connection Types
// -----------------------------------------------------------------------------

export type Connection = {
  id: string;
  from:
    | { type: "block"; id: string; port: number }
    | { type: "tool"; id: string; port: number }
    | { type: "upload"; id: string; port: number };
  to: { type: "block" | "tool" | "output"; id: string; inputIndex?: number };
};

export type LinkSource = Connection["from"];
export type LinkTarget = Connection["to"];

export type AnchorPoint = {
  x: number;
  y: number;
  dir?: "left" | "right" | "up" | "down";
};

// -----------------------------------------------------------------------------
// Selection Types
// -----------------------------------------------------------------------------

export type Selection =
  | { type: "note"; id: string }
  | { type: "block"; id: string }
  | { type: "tool"; id: string }
  | { type: "upload"; id: string }
  | { type: "output"; id: string }
  | { type: "connection"; id: string }
  | null;

// -----------------------------------------------------------------------------
// UI Types
// -----------------------------------------------------------------------------

export type PanelKey = "blocks" | "tools" | "settings";

export type Theme = "light" | "dark";

// -----------------------------------------------------------------------------
// Linking State Types
// -----------------------------------------------------------------------------

export type LinkingState =
  | {
      origin: "output";
      from: LinkSource;
      current: { x: number; y: number };
    }
  | {
      origin: "input";
      target: LinkTarget;
      current: { x: number; y: number };
    }
  | null;

// -----------------------------------------------------------------------------
// Preset Types
// -----------------------------------------------------------------------------

export type AgentPreset = {
  id: string;
  name: string;
  description: string;
  inputCount: number;
  outputCount: number;
};

export type EvalOption = {
  id: string;
  name: string;
  description: string;
  category: string;
};

// -----------------------------------------------------------------------------
// Handle Types (for node connectors)
// -----------------------------------------------------------------------------

export type BlockHandles = {
  width: number;
  height: number;
  inputAnchors: AnchorPoint[];
  outputAnchors: AnchorPoint[];
  toolAnchors: { anchor: AnchorPoint; slot: number }[];
};

export type ToolHandles = {
  width: number;
  height: number;
  output: AnchorPoint;
  input: AnchorPoint;
};

export type UploadHandles = {
  width: number;
  height: number;
  output: AnchorPoint;
};

export type OutputHandles = {
  width: number;
  height: number;
  input: AnchorPoint;
};

// -----------------------------------------------------------------------------
// Workflow Snapshot Types (for save/load)
// -----------------------------------------------------------------------------

export type WorkspaceSnapshot = {
  notes: Note[];
  blocks: AgentBlock[];
  tools: ToolNode[];
  uploads: UploadNode[];
  outputs: OutputNode[];
  connections: Connection[];
  theme: Theme;
  evals?: string[];
  nextBlockId?: number;
  nextToolId?: number;
  nextUploadId?: number;
  nextOutputId?: number;
  nextConnectionId?: number;
  nextNoteId?: number;
};

export type WorkflowExport = {
  triples: { from: string; op: string; to: string }[];
  metadata: {
    total_agents: number;
    total_triples: number;
    operator_counts: { seq: number; brn: number; agg: number };
    estimated_latency_ms: number;
    estimated_cost: number;
  };
};

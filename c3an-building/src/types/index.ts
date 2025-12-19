// =============================================================================
// Type Definitions for C3AN Workflow Builder
// =============================================================================

// -----------------------------------------------------------------------------
// Core Node Types
// -----------------------------------------------------------------------------

export type AgentBlock = {
  id: string;
  /** Registry ID used for backend validation / re-hydration (not the canvas block id). */
  agentId?: string;
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

// -----------------------------------------------------------------------------
// Agent Registry Types
// -----------------------------------------------------------------------------

export type AgentRegistryStreams = {
  mandatory: string[];
  optional?: string[];
};

export type AgentRegistryEntry = {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  input_data_streams: AgentRegistryStreams;
  output_data_streams: AgentRegistryStreams;
};

export type AgentRegistryFile = {
  metadata?: Record<string, unknown>;
  global_protocols?: string[];
  agents: AgentRegistryEntry[];
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

// -----------------------------------------------------------------------------
// Clipboard Types
// -----------------------------------------------------------------------------

export type ClipboardItem =
  | { type: "block"; data: AgentBlock }
  | { type: "tool"; data: ToolNode };

// -----------------------------------------------------------------------------
// Connection Types
// -----------------------------------------------------------------------------

export type Connection = {
  id: string;
  from:
    | { type: "block"; id: string; port: number }
    | { type: "tool"; id: string; port: number };
  to: { type: "block" | "tool"; id: string; inputIndex?: number };
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
  | { type: "block"; id: string }
  | { type: "tool"; id: string }
  | { type: "connection"; id: string }
  | null;

// -----------------------------------------------------------------------------
// UI Types
// -----------------------------------------------------------------------------

export type PanelKey = "blocks" | "tools" | "settings";

export type ViewMode = "agent" | "plan";

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

// -----------------------------------------------------------------------------
// Workflow Snapshot Types (for save/load)
// -----------------------------------------------------------------------------

export type WorkspaceSnapshot = {
  blocks: AgentBlock[];
  tools: ToolNode[];
  connections: Connection[];
  theme: Theme;
  evals?: string[];
  nextBlockId?: number;
  nextToolId?: number;
  nextConnectionId?: number;
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


export * from "./planning";

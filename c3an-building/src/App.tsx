import {
  type ChangeEvent,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Background from "./components/background";
import { usePanZoom } from "./hooks/zoom";
import "./App.css";

type Note = {
  id: string;
  x: number;
  y: number;
  text: string;
};

type AgentBlock = {
  id: string;
  x: number;
  y: number;
  name: string;
  description: string;
  inputCount: number;
  outputCount: number;
  presetId?: string;
};

type ToolNode = {
  id: string;
  x: number;
  y: number;
  name: string;
  tagline: string;
  gradient: string;
  ring: string;
  accent: string;
};

type ToolPreset = Omit<ToolNode, "id" | "x" | "y">;

type UploadNode = {
  id: string;
  x: number;
  y: number;
  name: string;
  status: "idle" | "ready";
  fileName?: string;
  fileSize?: number;
  fileType?: string;
};

type OutputNode = {
  id: string;
  x: number;
  y: number;
  name: string;
  format: string;
};

type ClipboardItem =
  | { type: "block"; data: AgentBlock }
  | { type: "operation"; data: Operation }
  | { type: "tool"; data: ToolNode }
  | { type: "upload"; data: UploadNode }
  | { type: "output"; data: OutputNode }
  | { type: "note"; data: Note };

type Connection = {
  id: string;
  from:
    | { type: "block"; id: string; port: number }
    | { type: "operation"; id: string; port: number }
    | { type: "tool"; id: string; port: number }
    | { type: "upload"; id: string; port: number };
  to: { type: "block" | "operation" | "tool" | "output"; id: string; inputIndex?: number };
};

type LinkSource = Connection["from"];
type LinkTarget = Connection["to"];
type AnchorPoint = { x: number; y: number; dir?: "left" | "right" | "up" | "down" };

type OperationKind = "branch" | "sequential" | "aggregate";

type Operation = {
  id: string;
  x: number;
  y: number;
  kind: OperationKind;
};

type Selection =
  | { type: "note"; id: string }
  | { type: "block"; id: string }
  | { type: "operation"; id: string }
  | { type: "tool"; id: string }
  | { type: "upload"; id: string }
  | { type: "output"; id: string }
  | null;

type PanelKey = "blocks" | "operations" | "tools" | "io" | "settings";

export default function App() {
  const linkingRef = useRef(false);
  const { containerRef, transform, reset } = usePanZoom({
    initial: { x: 0, y: 0, zoom: 1 },
    shouldAllowPan: (event) => {
      if (linkingRef.current) return false;
      const target = event.target as HTMLElement | null;
      return !target?.closest("[data-note],[data-block],[data-operation],[data-tool],[data-upload],[data-output]");
    },
    isPanDisabled: () => linkingRef.current,
  });
  const [activePanel, setActivePanel] = useState<PanelKey | null>("blocks");
  const [notes, setNotes] = useState<Note[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [blocks, setBlocks] = useState<AgentBlock[]>([]);
  const [tools, setTools] = useState<ToolNode[]>([]);
  const [uploads, setUploads] = useState<UploadNode[]>([]);
  const [outputs, setOutputs] = useState<OutputNode[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [userThemeLocked, setUserThemeLocked] = useState(false);
  const [backgroundPreset, setBackgroundPreset] = useState<"grid" | "aurora" | "blueprint">("grid");
  const [clipboard, setClipboard] = useState<ClipboardItem | null>(null);
  const [showStart, setShowStart] = useState(true);
  const [startExiting, setStartExiting] = useState(false);
  const startTimeoutRef = useRef<number | null>(null);
  const agentPresets = useMemo(
    () => [
      { id: "router", name: "Router", description: "Split to two paths", inputCount: 1, outputCount: 2 },
      { id: "fanout", name: "Fan-out", description: "Broadcast to three", inputCount: 1, outputCount: 3 },
      { id: "collector", name: "Collector", description: "Merge two inputs", inputCount: 2, outputCount: 1 },
      { id: "triage", name: "Triage", description: "Route with fallback", inputCount: 1, outputCount: 4 },
      { id: "analysis", name: "Analysis", description: "Ingest two, emit two", inputCount: 2, outputCount: 2 },
      { id: "expander", name: "Expander", description: "Multi-branch", inputCount: 1, outputCount: 5 },
    ],
    [],
  );
  const [agentJsonInput, setAgentJsonInput] = useState<string>(`{
  "metadata": {
    "version": "1.0.0",
    "registry_type": "agent_registry",
    "compatible_protocols": ["a2a", "mcp"],
    "description": "PolicyReasoner agent specification describing how detector signals map to mitigation actions."
  },
  "global_protocols": ["a2a", "mcp"],
  "agents": [
    {
      "id": "policy_reasoner",
      "name": "PolicyReasoner",
      "description": "Scores detector outputs using configured weights and thresholds to choose actions such as PASS, PARAPHRASE, REDACT, REFUSE, or ESCALATE.",
      "capabilities": ["policy_weighting", "risk_scoring", "mitigation_decision"],
      "input_data_streams": {
        "mandatory": ["detection"],
        "optional": ["policy_override"]
      },
      "output_data_streams": {
        "mandatory": ["action", "score"],
        "optional": ["rationale"]
      }
    }
  ]
}`);
  const [agentParseError, setAgentParseError] = useState<string | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [linking, setLinking] = useState<{
    origin: "output";
    from: LinkSource;
    current: { x: number; y: number };
  } | {
    origin: "input";
    target: LinkTarget;
    current: { x: number; y: number };
  } | null>(null);
  useEffect(() => {
    linkingRef.current = Boolean(linking);
  }, [linking]);
  const [hoveredInput, setHoveredInput] = useState<{
    type: "block" | "operation" | "tool" | "output";
    id: string;
    inputIndex?: number;
  } | null>(null);
  const [hoveredOutput, setHoveredOutput] = useState<LinkSource | null>(null);
  const nextIdRef = useRef(1);
  const nextOperationIdRef = useRef(1);
  const nextBlockIdRef = useRef(1);
  const nextToolIdRef = useRef(1);
  const nextUploadIdRef = useRef(1);
  const nextOutputIdRef = useRef(1);
  const nextConnectionIdRef = useRef(1);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const operationDragOffsetRef = useRef({ x: 0, y: 0 });
  const blockDragOffsetRef = useRef({ x: 0, y: 0 });
  const toolDragOffsetRef = useRef({ x: 0, y: 0 });
  const outputDragOffsetRef = useRef({ x: 0, y: 0 });
  const uploadDragOffsetRef = useRef({ x: 0, y: 0 });
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const [draggingOperationId, setDraggingOperationId] = useState<string | null>(null);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [draggingToolId, setDraggingToolId] = useState<string | null>(null);
  const [draggingUploadId, setDraggingUploadId] = useState<string | null>(null);
  const [draggingOutputId, setDraggingOutputId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selection>(null);
  const [hoveredOperationId, setHoveredOperationId] = useState<string | null>(null);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [hoveredToolId, setHoveredToolId] = useState<string | null>(null);
  const [hoveredUploadId, setHoveredUploadId] = useState<string | null>(null);
  const [hoveredOutputId, setHoveredOutputId] = useState<string | null>(null);

  const operationMeta: Record<
    OperationKind,
    { label: string; description: string; gradient: string; ring: string; text: string; accent: string }
  > = {
    branch: {
      label: "Branch",
      description: "Split to up to 5 paths",
      gradient: "from-emerald-50 via-white to-emerald-100",
      ring: "ring-emerald-200",
      text: "text-emerald-900",
      accent: "bg-emerald-500",
    },
    sequential: {
      label: "Sequential",
      description: "Run steps in order",
      gradient: "from-sky-50 via-white to-indigo-100",
      ring: "ring-indigo-200",
      text: "text-slate-900",
      accent: "bg-indigo-500",
    },
    aggregate: {
      label: "Aggregate",
      description: "Collect up to 5 inputs and combine",
      gradient: "from-amber-50 via-white to-orange-100",
      ring: "ring-amber-200",
      text: "text-amber-900",
      accent: "bg-amber-500",
    },
  };
  const operationKinds: OperationKind[] = ["branch", "sequential", "aggregate"];
  const panelTitles: Record<PanelKey, string> = {
    blocks: "Blocks",
    operations: "Operations",
    tools: "Tools",
    io: "Inputs / Outputs",
    settings: "Settings",
  };
  const panelTabs: { id: PanelKey; label: string; symbol: string }[] = [
    { id: "blocks", label: "Blocks", symbol: "[]" },
    { id: "operations", label: "Operations", symbol: "Ops" },
    { id: "tools", label: "Tools", symbol: "TL" },
    { id: "io", label: "I/O", symbol: "IO" },
    { id: "settings", label: "Settings", symbol: ":" },
  ];
  const handleCircle = useCallback(
    () => ({
      width: 12,
      height: 12,
      borderRadius: "9999px",
      backgroundColor: "rgba(250, 204, 21, 0.9)",
      boxShadow: "0 0 0 1px rgba(234, 179, 8, 0.5), 0 3px 8px rgba(234, 179, 8, 0.22)",
    }),
    [],
  );
  const handleHalo = useCallback(
    () => ({
      width: 18,
      height: 18,
      borderRadius: "9999px",
      backgroundColor: "rgba(250, 204, 21, 0.12)",
      boxShadow: "0 0 0 1.5px rgba(234, 179, 8, 0.6)",
    }),
    [],
  );
  const HandleDot = useCallback(
    () => (
      <div className="relative flex items-center justify-center w-full h-full">
        <div className="absolute" style={handleHalo()} />
        <div style={handleCircle()} />
      </div>
    ),
    [handleCircle, handleHalo],
  );
  const toolPalette = useMemo<ToolPreset[]>(
    () => [
      { name: "Lumen Trace", tagline: "Quick spotlight", gradient: "from-sky-50 via-white to-indigo-100", ring: "ring-sky-200", accent: "bg-sky-600" },
      { name: "Drift Beacon", tagline: "Signal check", gradient: "from-emerald-50 via-white to-teal-100", ring: "ring-emerald-200", accent: "bg-emerald-600" },
      { name: "Quartz Forge", tagline: "Shape drafts", gradient: "from-amber-50 via-white to-orange-100", ring: "ring-amber-200", accent: "bg-amber-600" },
      { name: "Echo Loom", tagline: "Thread replies", gradient: "from-slate-50 via-white to-cyan-100", ring: "ring-cyan-200", accent: "bg-cyan-600" },
      { name: "Prism Warden", tagline: "Guard rails", gradient: "from-fuchsia-50 via-white to-purple-100", ring: "ring-fuchsia-200", accent: "bg-fuchsia-600" },
      { name: "Static Tuner", tagline: "Noise filter", gradient: "from-gray-50 via-white to-slate-100", ring: "ring-slate-200", accent: "bg-slate-700" },
      { name: "Nova Draft", tagline: "Fresh canvas", gradient: "from-rose-50 via-white to-amber-100", ring: "ring-rose-200", accent: "bg-rose-600" },
      { name: "Polar Kite", tagline: "Flow navigator", gradient: "from-blue-50 via-white to-sky-100", ring: "ring-blue-200", accent: "bg-blue-600" },
      { name: "Ember Chisel", tagline: "Quick trim", gradient: "from-orange-50 via-white to-amber-100", ring: "ring-orange-200", accent: "bg-orange-600" },
      { name: "Cipher Lens", tagline: "Inspect payloads", gradient: "from-violet-50 via-white to-indigo-100", ring: "ring-violet-200", accent: "bg-indigo-600" },
      { name: "Vapor Prism", tagline: "Soft preview", gradient: "from-lime-50 via-white to-emerald-100", ring: "ring-lime-200", accent: "bg-lime-600" },
    ],
    [],
  );
  const formatBytes = useCallback((size?: number) => {
    if (size === undefined || size === null) return "";
    if (size < 1024) return `${size} B`;
    const units = ["KB", "MB", "GB"];
    let value = size / 1024;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    const formatted = value >= 10 ? value.toFixed(0) : value.toFixed(1);
    return `${formatted} ${units[unitIndex]}`;
  }, []);

  const toWorldPoint = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      return {
        x: (localX - transform.x) / transform.zoom,
        y: (localY - transform.y) / transform.zoom,
      };
    },
    [containerRef, transform.x, transform.y, transform.zoom],
  );

  const handleBlockDragStart = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(
      "application/json",
      JSON.stringify({ type: "agent-block" }),
    );
    event.dataTransfer.setData("text/plain", "agent-block");
  }, []);

  const handleOperationDragStart =
    useCallback(
      (kind: OperationKind) => (event: DragEvent<HTMLDivElement>) => {
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData(
          "application/json",
          JSON.stringify({ type: "operation", kind }),
        );
        event.dataTransfer.setData("text/plain", `operation-${kind}`);
      },
      [],
    );

  const handleToolDragStart =
    useCallback(
      (toolName: string) => (event: DragEvent<HTMLDivElement>) => {
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData(
          "application/json",
          JSON.stringify({ type: "tool", name: toolName }),
        );
        event.dataTransfer.setData("text/plain", `tool-${toolName}`);
      },
      [],
    );
  const handleUploadDragStart = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(
      "application/json",
      JSON.stringify({ type: "upload-block" }),
    );
    event.dataTransfer.setData("text/plain", "upload-block");
  }, []);
  const handleOutputDragStart = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(
      "application/json",
      JSON.stringify({ type: "output-block" }),
    );
    event.dataTransfer.setData("text/plain", "output-block");
  }, []);

  const handleCanvasDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const handleCanvasDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const el = containerRef.current;
      if (!el) return;

      const payloadRaw =
        event.dataTransfer.getData("application/json") ||
        event.dataTransfer.getData("text/plain");

      let payloadType: string | null = null;
      let payloadKind: OperationKind | null = null;
      let payloadToolName: string | null = null;
      try {
        const parsed = payloadRaw ? JSON.parse(payloadRaw) : null;
        payloadType = parsed?.type ?? null;
        payloadKind = parsed?.kind ?? null;
        payloadToolName = parsed?.name ?? null;
      } catch {
        // ignore JSON parse errors, fall back to plain text matching
      }

      if (!payloadType && payloadRaw?.includes("sticky-note")) payloadType = "sticky-note";
      if (!payloadType && payloadRaw?.includes("agent-block")) payloadType = "agent-block";
      if (!payloadType && payloadRaw?.includes("upload-block")) payloadType = "upload-block";
      if (!payloadType && payloadRaw?.includes("output-block")) payloadType = "output-block";
      if (!payloadType && payloadRaw?.includes("operation")) payloadType = "operation";
      if (!payloadType && payloadRaw?.includes("tool")) payloadType = "tool";
      if (payloadType === "operation" && !payloadKind) {
        if (payloadRaw?.includes("branch")) payloadKind = "branch";
        else if (payloadRaw?.includes("sequential")) payloadKind = "sequential";
        else if (payloadRaw?.includes("aggregate")) payloadKind = "aggregate";
      }
      if (payloadType === "tool" && !payloadToolName && payloadRaw) {
        payloadToolName = payloadRaw.replace(/^tool-/, "");
      }
      if (!payloadType) return;

      const rect = el.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      const worldX = (localX - transform.x) / transform.zoom;
      const worldY = (localY - transform.y) / transform.zoom;

      if (payloadType === "sticky-note") {
        const id = nextIdRef.current++;
        setNotes((prev) => [
          ...prev,
          {
            id: `note-${id}`,
            x: worldX,
            y: worldY,
            text: "Sticky note",
          },
        ]);
      }

      if (payloadType === "operation") {
        if (!payloadKind) return;
        const id = nextOperationIdRef.current++;
        setOperations((prev) => [
          ...prev,
          {
            id: `op-${id}`,
            x: worldX,
            y: worldY,
            kind: payloadKind,
          },
        ]);
      }

      if (payloadType === "agent-block") {
        const id = nextBlockIdRef.current++;
        const preset = agentPresets[0];
        setBlocks((prev) => [
          ...prev,
          {
            id: `block-${id}`,
            x: worldX,
            y: worldY,
            name: preset?.name ?? "Agent Block",
            description: preset?.description ?? "1 input, 2 outputs",
            inputCount: preset?.inputCount ?? 1,
            outputCount: preset?.outputCount ?? 2,
            presetId: preset?.id,
          },
        ]);
      }

      if (payloadType === "upload-block") {
        const id = nextUploadIdRef.current++;
        setUploads((prev) => [
          ...prev,
          {
            id: `upload-${id}`,
            x: worldX,
            y: worldY,
            name: "Upload data",
            status: "idle",
          },
        ]);
      }

      if (payloadType === "output-block") {
        const id = nextOutputIdRef.current++;
        setOutputs((prev) => [
          ...prev,
          {
            id: `output-${id}`,
            x: worldX,
            y: worldY,
            name: "Output",
            format: "Describe the format here (e.g., JSON summary, Markdown bullets, CSV schema).",
          },
        ]);
      }

      if (payloadType === "tool") {
        const paletteItem = toolPalette.find((tool) => tool.name === payloadToolName);
        if (!paletteItem) return;
        const id = nextToolIdRef.current++;
        setTools((prev) => [
          ...prev,
          {
            ...paletteItem,
            id: `tool-${id}`,
            x: worldX,
            y: worldY,
          },
        ]);
      }
    },
    [agentPresets, containerRef, toolPalette, transform.x, transform.y, transform.zoom],
  );

  const handleGenerateAgentsFromJson = useCallback(() => {
    setAgentParseError(null);
    let parsed: any;
    try {
      parsed = JSON.parse(agentJsonInput);
    } catch (error) {
      setAgentParseError("Invalid JSON: please check formatting.");
      return;
    }
    const agents: any[] | null = Array.isArray(parsed?.agents) ? parsed.agents : null;
    if (!agents || agents.length === 0) {
      setAgentParseError("No agents found in JSON (expected an `agents` array).");
      return;
    }

    const newBlocks: AgentBlock[] = [];
    const newTools: ToolNode[] = [];
    const newConnections: Connection[] = [];
    const baseX = 140 + blocks.length * 40;
    const baseY = 200;
    const blockSpacing = 340;
    const toolSpacingX = 150;
    const toolSpacingY = 150;

    agents.forEach((agent, idx) => {
      const inputCount =
        (Array.isArray(agent?.input_data_streams?.mandatory) ? agent.input_data_streams.mandatory.length : 0) +
        (Array.isArray(agent?.input_data_streams?.optional) ? agent.input_data_streams.optional.length : 0);
      const outputCount =
        (Array.isArray(agent?.output_data_streams?.mandatory) ? agent.output_data_streams.mandatory.length : 0) +
        (Array.isArray(agent?.output_data_streams?.optional) ? agent.output_data_streams.optional.length : 0);
      const blockId = `block-${nextBlockIdRef.current++}`;
      const blockX = baseX + idx * blockSpacing;
      const blockY = baseY;

      newBlocks.push({
        id: blockId,
        x: blockX,
        y: blockY,
        name: agent?.name ?? agent?.id ?? `Agent ${idx + 1}`,
        description: agent?.description ?? "Generated from JSON",
        inputCount: Math.max(1, inputCount || 1),
        outputCount: Math.max(1, outputCount || 1),
      });

      const capabilities: string[] = Array.isArray(agent?.capabilities) ? agent.capabilities : [];
      capabilities.forEach((cap, capIdx) => {
        const palette = toolPalette[capIdx % toolPalette.length];
        const toolId = `tool-${nextToolIdRef.current++}`;
        const toolX = blockX + (capIdx % 2) * toolSpacingX - 40;
        const toolY = blockY + 220 + Math.floor(capIdx / 2) * toolSpacingY;
        newTools.push({
          ...palette,
          id: toolId,
          x: toolX,
          y: toolY,
          name: typeof cap === "string" ? cap : `Capability ${capIdx + 1}`,
          tagline: "Capability tool",
        });
        const connId = `conn-${nextConnectionIdRef.current++}`;
        newConnections.push({
          id: connId,
          from: { type: "tool", id: toolId, port: 0 },
          to: { type: "block", id: blockId, inputIndex: Math.max(1, inputCount || 1) },
        });
      });
    });

    setBlocks((prev) => [...prev, ...newBlocks]);
    setTools((prev) => [...prev, ...newTools]);
    setConnections((prev) => [...prev, ...newConnections]);
  }, [agentJsonInput, blocks.length, toolPalette]);

  const getBlockHandles = useCallback(
    (block: AgentBlock) => {
      const width = 220;
      const baseHeight = 120;
      const inputSlots = Math.max(1, block.inputCount);
      const outputSlots = Math.max(1, block.outputCount);
      const maxSlots = Math.max(inputSlots, outputSlots);
      const topPadding = 18;
      const slotGap = 28;
      const height =
        maxSlots > 1
          ? Math.max(baseHeight, topPadding * 2 + slotGap * (maxSlots - 1))
          : baseHeight;

      const buildAnchors = (count: number, side: "left" | "right"): AnchorPoint[] => {
        if (count <= 1) {
          return [
            {
              x: side === "left" ? block.x : block.x + width,
              y: block.y + height / 2,
              dir: side,
            },
          ];
        }
        const gap = (height - topPadding * 2) / (count - 1);
        return Array.from({ length: count }, (_, idx) => ({
          x: side === "left" ? block.x : block.x + width,
          y: block.y + topPadding + idx * gap,
          dir: side,
        }));
      };

      const inputAnchors = buildAnchors(inputSlots, "left");
      const outputAnchors = buildAnchors(outputSlots, "right");
      const toolPortIndex = inputSlots;
      const toolInput: AnchorPoint = { x: block.x + width / 2, y: block.y + height + 4, dir: "down" };
      return { width, height, inputAnchors, outputAnchors, toolInput, toolPortIndex };
    },
    [],
  );

  const getOperationHandles = useCallback(
    (operation: Operation) => {
      const width = 260;
      const baseHeight = 60;
      const inputSlots = 1;
      const outputSlots = 1;
      const topPadding = 12;
      const maxSlots = Math.max(inputSlots, outputSlots);
      const slotGap = 24;
      const height =
        maxSlots > 1
          ? Math.max(baseHeight, topPadding * 2 + slotGap * (maxSlots - 1))
          : baseHeight;

      const buildAnchors = (count: number, side: "left" | "right"): AnchorPoint[] => {
        if (count <= 1) {
          return [
            {
              x: side === "left" ? operation.x : operation.x + width,
              y: operation.y + height / 2,
              dir: side,
            },
          ];
        }
        const gap = (height - topPadding * 2) / (count - 1);
        return Array.from({ length: count }, (_, idx) => ({
          x: side === "left" ? operation.x : operation.x + width,
          y: operation.y + topPadding + idx * gap,
          dir: side,
        }));
      };

      const inputAnchors = buildAnchors(inputSlots, "left");
      const outputAnchors = buildAnchors(outputSlots, "right");
      return { width, height, inputAnchors, outputAnchors };
    },
    [],
  );

  const getToolHandles = useCallback((tool: ToolNode) => {
    const width = 180;
    const height = 110;
    const output: AnchorPoint = { x: tool.x + width / 2, y: tool.y - 6, dir: "up" };
    const input: AnchorPoint = output; // single connector used for both directions
    return { width, height, output, input };
  }, []);
  const getUploadHandles = useCallback((upload: UploadNode) => {
    const width = 240;
    const height = 210;
    const output: AnchorPoint = { x: upload.x + width, y: upload.y + height / 2, dir: "right" };
    return { width, height, output };
  }, []);
  const getOutputHandles = useCallback((output: OutputNode) => {
    const width = 240;
    const height = 240;
    const input: AnchorPoint = { x: output.x, y: output.y + height / 2, dir: "left" };
    return { width, height, input };
  }, []);
  const clamp = useCallback((value: number, min: number, max: number) => Math.min(max, Math.max(min, value)), []);
  const MIN_IO = 1;
  const MAX_IO = 6;
  const applyBlockIO = useCallback(
    (
      blockId: string,
      nextInputCount: number,
      nextOutputCount: number,
      extra?: Partial<Pick<AgentBlock, "name" | "description" | "presetId">>,
    ) => {
      const targetBlock = blocks.find((b) => b.id === blockId);
      if (!targetBlock) return;
      const oldInputCount = targetBlock.inputCount;
      const newInputs = clamp(nextInputCount, MIN_IO, MAX_IO);
      const newOutputs = clamp(nextOutputCount, MIN_IO, MAX_IO);
      const oldToolPortIndex = oldInputCount;
      const newToolPortIndex = newInputs;

      setBlocks((prev) =>
        prev.map((b) =>
          b.id === blockId
            ? {
                ...b,
                inputCount: newInputs,
                outputCount: newOutputs,
                ...extra,
              }
            : b,
        ),
      );

      setConnections((prev) => {
        // drop output connections past new output count
        let next = prev.filter(
          (conn) => !(conn.from.type === "block" && conn.from.id === blockId && conn.from.port >= newOutputs),
        );

        // remap tool-port connections, drop inputs that are out of range
        next = next
          .map((conn) => {
            if (conn.to.type === "block" && conn.to.id === blockId) {
              const idx = conn.to.inputIndex ?? 0;
              if (idx === oldToolPortIndex) {
                return { ...conn, to: { ...conn.to, inputIndex: newToolPortIndex } };
              }
            }
            return conn;
          })
          .filter((conn) => {
            if (conn.to.type === "block" && conn.to.id === blockId) {
              const idx = conn.to.inputIndex ?? 0;
              if (idx === newToolPortIndex) return true;
              return idx < newInputs;
            }
            return true;
          });

        return next;
      });
    },
    [MAX_IO, MIN_IO, blocks, clamp],
  );
  const changeBlockInputs = useCallback(
    (blockId: string, delta: number) => {
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;
      const newInputs = clamp(block.inputCount + delta, MIN_IO, MAX_IO);
      applyBlockIO(blockId, newInputs, block.outputCount, { presetId: "custom" });
    },
    [MAX_IO, MIN_IO, applyBlockIO, blocks, clamp],
  );
  const changeBlockOutputs = useCallback(
    (blockId: string, delta: number) => {
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;
      const newOutputs = clamp(block.outputCount + delta, MIN_IO, MAX_IO);
      applyBlockIO(blockId, block.inputCount, newOutputs, { presetId: "custom" });
    },
    [MAX_IO, MIN_IO, applyBlockIO, blocks, clamp],
  );
  const applyPresetToBlock = useCallback(
    (blockId: string, presetId: string) => {
      const preset = agentPresets.find((p) => p.id === presetId);
      if (!preset) return;
      applyBlockIO(
        blockId,
        preset.inputCount,
        preset.outputCount,
        { name: preset.name, description: preset.description, presetId: preset.id },
      );
    },
    [agentPresets, applyBlockIO],
  );
  const markBlockCustom = useCallback((blockId: string) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, presetId: "custom" } : b)),
    );
  }, []);
  const handleEnterWorkspace = useCallback(() => {
    if (startExiting) return;
    setStartExiting(true);
    if (startTimeoutRef.current) clearTimeout(startTimeoutRef.current);
    startTimeoutRef.current = window.setTimeout(() => {
      setShowStart(false);
      setStartExiting(false);
      startTimeoutRef.current = null;
    }, 450);
  }, [startExiting]);

  const getOutputAnchor = useCallback(
    (endpoint: LinkSource) => {
      if (endpoint.type === "block") {
        const block = blocks.find((b) => b.id === endpoint.id);
        if (!block) return null;
        const handles = getBlockHandles(block);
        const index = Math.min(
          handles.outputAnchors.length - 1,
          Math.max(0, endpoint.port),
        );
        return handles.outputAnchors[index];
      }
      if (endpoint.type === "tool") {
        const tool = tools.find((t) => t.id === endpoint.id);
        if (!tool) return null;
        const handles = getToolHandles(tool);
        return handles.output;
      }
      if (endpoint.type === "upload") {
        const upload = uploads.find((u) => u.id === endpoint.id);
        if (!upload) return null;
        const handles = getUploadHandles(upload);
        return handles.output;
      }
      const operation = operations.find((op) => op.id === endpoint.id);
      if (!operation) return null;
      const handles = getOperationHandles(operation);
      const index = Math.min(
        handles.outputAnchors.length - 1,
        Math.max(0, endpoint.port),
      );
      return handles.outputAnchors[index];
    },
    [blocks, getBlockHandles, getOperationHandles, getToolHandles, getUploadHandles, operations, tools, uploads],
  );

  const getInputAnchor = useCallback(
    (target: LinkTarget) => {
      if (target.type === "block") {
        const block = blocks.find((b) => b.id === target.id);
        if (!block) return null;
        const handles = getBlockHandles(block);
        const inputIndex = target.inputIndex ?? 0;
        if (inputIndex === handles.toolPortIndex) return handles.toolInput;
        const boundedIndex = Math.min(
          handles.inputAnchors.length - 1,
          Math.max(0, inputIndex),
        );
        return handles.inputAnchors[boundedIndex];
      }
      if (target.type === "tool") {
        const tool = tools.find((t) => t.id === target.id);
        if (!tool) return null;
        const handles = getToolHandles(tool);
        return handles.input;
      }
      if (target.type === "output") {
        const output = outputs.find((o) => o.id === target.id);
        if (!output) return null;
        const handles = getOutputHandles(output);
        return handles.input;
      }
      const operation = operations.find((op) => op.id === target.id);
      if (!operation) return null;
      const handles = getOperationHandles(operation);
      const index = Math.min(
        handles.inputAnchors.length - 1,
        Math.max(0, target.inputIndex ?? 0),
      );
      return handles.inputAnchors[index];
    },
    [blocks, getBlockHandles, getOperationHandles, getOutputHandles, getToolHandles, operations, outputs, tools],
  );

  const buildConnectionPath = useCallback(
    (start: AnchorPoint, end: AnchorPoint) => {
      const dx = end.x - start.x;
      const offset = Math.max(Math.abs(dx) * 0.5, 40);
      const c1x = start.x + offset;
      const c2x = end.x - offset;
      return `M ${start.x} ${start.y} C ${c1x} ${start.y} ${c2x} ${end.y} ${end.x} ${end.y}`;
    },
    [],
  );

  const handleNotePointerDown = useCallback(
    (noteId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      event.stopPropagation();
      event.preventDefault();
      setSelected((prev) =>
        prev?.type === "note" && prev.id === noteId ? null : { type: "note", id: noteId },
      );
      const note = notes.find((n) => n.id === noteId);
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!note || !world) return;
      dragOffsetRef.current = { x: world.x - note.x, y: world.y - note.y };
      setDraggingNoteId(noteId);
      setSelected({ type: "note", id: noteId });
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [notes, toWorldPoint],
  );

  const handleNotePointerMove = useCallback(
    (noteId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingNoteId !== noteId) return;
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!world) return;
      const newX = world.x - dragOffsetRef.current.x;
      const newY = world.y - dragOffsetRef.current.y;
      setNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, x: newX, y: newY } : n)),
      );
    },
    [draggingNoteId, toWorldPoint],
  );

  const handleNotePointerUp = useCallback(
    (noteId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingNoteId !== noteId) return;
      setDraggingNoteId(null);
      dragOffsetRef.current = { x: 0, y: 0 };
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    },
    [draggingNoteId],
  );

  const handleRemoveNote = useCallback(
    (noteId: string) => {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      if (draggingNoteId === noteId) setDraggingNoteId(null);
      if (selected?.type === "note" && selected.id === noteId) setSelected(null);
    },
    [draggingNoteId, selected],
  );

  const handleOperationPointerDown = useCallback(
    (operationId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (linkingRef.current || target?.closest("[data-connector]")) return;
      event.stopPropagation();
      event.preventDefault();
      setSelected((prev) =>
        prev?.type === "operation" && prev.id === operationId
          ? null
          : { type: "operation", id: operationId },
      );
      const op = operations.find((o) => o.id === operationId);
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!op || !world) return;
      operationDragOffsetRef.current = { x: world.x - op.x, y: world.y - op.y };
      setDraggingOperationId(operationId);
      setSelected({ type: "operation", id: operationId });
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [operations, toWorldPoint],
  );

  const handleOperationPointerMove = useCallback(
    (operationId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingOperationId !== operationId) return;
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!world) return;
      const newX = world.x - operationDragOffsetRef.current.x;
      const newY = world.y - operationDragOffsetRef.current.y;
      setOperations((prev) =>
        prev.map((op) => (op.id === operationId ? { ...op, x: newX, y: newY } : op)),
      );
    },
    [draggingOperationId, toWorldPoint],
  );

  const handleOperationPointerUp = useCallback(
    (operationId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingOperationId !== operationId) return;
      setDraggingOperationId(null);
      operationDragOffsetRef.current = { x: 0, y: 0 };
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    },
    [draggingOperationId],
  );

  const handleRemoveOperation = useCallback(
    (operationId: string) => {
      setOperations((prev) => prev.filter((op) => op.id !== operationId));
      if (draggingOperationId === operationId) {
        setDraggingOperationId(null);
        operationDragOffsetRef.current = { x: 0, y: 0 };
      }
      if (selected?.type === "operation" && selected.id === operationId) setSelected(null);
      setConnections((prev) =>
        prev.filter(
          (conn) =>
            !(
              (conn.from.type === "operation" && conn.from.id === operationId) ||
              (conn.to.type === "operation" && conn.to.id === operationId)
            ),
        ),
      );
    },
    [draggingOperationId, selected],
  );

  const handleBlockPointerDown = useCallback(
    (blockId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (linkingRef.current || target?.closest("[data-connector]")) return;
      event.stopPropagation();
      event.preventDefault();
      setSelected((prev) =>
        prev?.type === "block" && prev.id === blockId ? null : { type: "block", id: blockId },
      );
      const block = blocks.find((b) => b.id === blockId);
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!block || !world) return;
      blockDragOffsetRef.current = { x: world.x - block.x, y: world.y - block.y };
      setDraggingBlockId(blockId);
      setSelected({ type: "block", id: blockId });
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [blocks, toWorldPoint],
  );

  const handleBlockPointerMove = useCallback(
    (blockId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingBlockId !== blockId) return;
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!world) return;
      const newX = world.x - blockDragOffsetRef.current.x;
      const newY = world.y - blockDragOffsetRef.current.y;
      setBlocks((prev) =>
        prev.map((b) => (b.id === blockId ? { ...b, x: newX, y: newY } : b)),
      );
    },
    [draggingBlockId, toWorldPoint],
  );

  const handleBlockPointerUp = useCallback(
    (blockId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingBlockId !== blockId) return;
      setDraggingBlockId(null);
      blockDragOffsetRef.current = { x: 0, y: 0 };
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    },
    [draggingBlockId],
  );

  const handleRemoveBlock = useCallback(
    (blockId: string) => {
      setBlocks((prev) => prev.filter((b) => b.id !== blockId));
      if (draggingBlockId === blockId) setDraggingBlockId(null);
      if (selected?.type === "block" && selected.id === blockId) setSelected(null);
      setConnections((prev) =>
        prev.filter(
          (conn) =>
            !(
              (conn.from.type === "block" && conn.from.id === blockId) ||
              (conn.to.type === "block" && conn.to.id === blockId)
            ),
        ),
      );
    },
    [draggingBlockId, selected],
  );

  const handleToolPointerDown = useCallback(
    (toolId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (linkingRef.current || target?.closest("[data-connector]")) return;
      event.stopPropagation();
      event.preventDefault();
      setSelected((prev) =>
        prev?.type === "tool" && prev.id === toolId ? null : { type: "tool", id: toolId },
      );
      const tool = tools.find((t) => t.id === toolId);
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!tool || !world) return;
      toolDragOffsetRef.current = { x: world.x - tool.x, y: world.y - tool.y };
      setDraggingToolId(toolId);
      setSelected({ type: "tool", id: toolId });
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [tools, toWorldPoint],
  );

  const handleToolPointerMove = useCallback(
    (toolId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingToolId !== toolId) return;
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!world) return;
      const newX = world.x - toolDragOffsetRef.current.x;
      const newY = world.y - toolDragOffsetRef.current.y;
      setTools((prev) =>
        prev.map((tool) => (tool.id === toolId ? { ...tool, x: newX, y: newY } : tool)),
      );
    },
    [draggingToolId, toWorldPoint],
  );

  const handleToolPointerUp = useCallback(
    (toolId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingToolId !== toolId) return;
      setDraggingToolId(null);
      toolDragOffsetRef.current = { x: 0, y: 0 };
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    },
    [draggingToolId],
  );

  const handleRemoveTool = useCallback(
    (toolId: string) => {
      setTools((prev) => prev.filter((t) => t.id !== toolId));
      if (draggingToolId === toolId) setDraggingToolId(null);
      if (selected?.type === "tool" && selected.id === toolId) setSelected(null);
      setConnections((prev) =>
        prev.filter(
          (conn) =>
            !(
              (conn.from.type === "tool" && conn.from.id === toolId) ||
              (conn.to.type === "tool" && conn.to.id === toolId)
            ),
        ),
      );
    },
    [draggingToolId, selected],
  );
  const handleUploadPointerDown = useCallback(
    (uploadId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (
        linkingRef.current ||
        target?.closest("[data-connector]") ||
        target?.closest("[data-upload-control]")
      ) {
        return;
      }
      event.stopPropagation();
      event.preventDefault();
      setSelected((prev) =>
        prev?.type === "upload" && prev.id === uploadId ? null : { type: "upload", id: uploadId },
      );
      const upload = uploads.find((u) => u.id === uploadId);
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!upload || !world) return;
      uploadDragOffsetRef.current = { x: world.x - upload.x, y: world.y - upload.y };
      setDraggingUploadId(uploadId);
      setSelected({ type: "upload", id: uploadId });
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [uploads, toWorldPoint],
  );

  const handleUploadPointerMove = useCallback(
    (uploadId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingUploadId !== uploadId) return;
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!world) return;
      const newX = world.x - uploadDragOffsetRef.current.x;
      const newY = world.y - uploadDragOffsetRef.current.y;
      setUploads((prev) =>
        prev.map((upload) => (upload.id === uploadId ? { ...upload, x: newX, y: newY } : upload)),
      );
    },
    [draggingUploadId, toWorldPoint],
  );

  const handleUploadPointerUp = useCallback(
    (uploadId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingUploadId !== uploadId) return;
      setDraggingUploadId(null);
      uploadDragOffsetRef.current = { x: 0, y: 0 };
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    },
    [draggingUploadId],
  );

  const handleRemoveUpload = useCallback(
    (uploadId: string) => {
      setUploads((prev) => prev.filter((upload) => upload.id !== uploadId));
      if (draggingUploadId === uploadId) setDraggingUploadId(null);
      if (selected?.type === "upload" && selected.id === uploadId) setSelected(null);
      setConnections((prev) =>
        prev.filter(
          (conn) =>
            !(
              conn.from.type === "upload" && conn.from.id === uploadId
            ),
        ),
      );
    },
    [draggingUploadId, selected],
  );

  const handleUploadFileChange = useCallback(
    (uploadId: string) => (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      setUploads((prev) =>
        prev.map((upload) =>
          upload.id === uploadId
            ? {
                ...upload,
                status: file ? "ready" : "idle",
                fileName: file?.name,
                fileSize: file?.size,
                fileType: file?.type || (file?.name ? `.${file.name.split(".").pop() ?? ""}` : undefined),
              }
            : upload,
        ),
      );
      event.target.value = "";
    },
    [],
  );

  const handleOutputPointerDown = useCallback(
    (outputId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (
        linkingRef.current ||
        target?.closest("[data-connector]") ||
        target?.closest("[data-output-control]")
      ) {
        return;
      }
      event.stopPropagation();
      event.preventDefault();
      setSelected((prev) =>
        prev?.type === "output" && prev.id === outputId ? null : { type: "output", id: outputId },
      );
      const output = outputs.find((o) => o.id === outputId);
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!output || !world) return;
      outputDragOffsetRef.current = { x: world.x - output.x, y: world.y - output.y };
      setDraggingOutputId(outputId);
      setSelected({ type: "output", id: outputId });
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [outputs, toWorldPoint],
  );

  const handleOutputPointerMove = useCallback(
    (outputId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingOutputId !== outputId) return;
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!world) return;
      const newX = world.x - outputDragOffsetRef.current.x;
      const newY = world.y - outputDragOffsetRef.current.y;
      setOutputs((prev) =>
        prev.map((output) => (output.id === outputId ? { ...output, x: newX, y: newY } : output)),
      );
    },
    [draggingOutputId, toWorldPoint],
  );

  const handleOutputPointerUp = useCallback(
    (outputId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingOutputId !== outputId) return;
      setDraggingOutputId(null);
      outputDragOffsetRef.current = { x: 0, y: 0 };
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    },
    [draggingOutputId],
  );

  const handleRemoveOutput = useCallback(
    (outputId: string) => {
      setOutputs((prev) => prev.filter((output) => output.id !== outputId));
      if (draggingOutputId === outputId) setDraggingOutputId(null);
      if (selected?.type === "output" && selected.id === outputId) setSelected(null);
      setConnections((prev) =>
        prev.filter(
          (conn) =>
            !(
              (conn.to.type === "output" && conn.to.id === outputId)
            ),
        ),
      );
    },
    [draggingOutputId, selected],
  );

  const handleOutputFormatChange = useCallback(
    (outputId: string) => (event: ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value;
      setOutputs((prev) =>
        prev.map((output) => (output.id === outputId ? { ...output, format: value } : output)),
      );
    },
    [],
  );
  const handleOutputFormatBlur = useCallback((outputId: string) => () => {
    // delay so clicks on other elements can set selection first
    setTimeout(() => {
      setSelected((prev) => (prev?.type === "output" && prev.id === outputId ? null : prev));
    }, 0);
  }, []);

  const handleInputEnter = useCallback(
    (target: { type: "block" | "operation" | "tool" | "output"; id: string; inputIndex?: number }) => () => {
      if (linking) setHoveredInput(target);
    },
    [linking],
  );

  const handleInputLeave = useCallback(
    (target: { type: "block" | "operation" | "tool" | "output"; id: string; inputIndex?: number }) => () => {
      if (
        hoveredInput &&
        hoveredInput.type === target.type &&
        hoveredInput.id === target.id &&
        (hoveredInput.inputIndex ?? null) === (target.inputIndex ?? null)
      ) {
        setHoveredInput(null);
      }
    },
    [hoveredInput],
  );

  const handleOutputEnter = useCallback(
    (source: LinkSource) => () => {
      if (linking) setHoveredOutput(source);
    },
    [linking],
  );

  const handleOutputLeave = useCallback(
    (source: LinkSource) => () => {
      if (
        hoveredOutput &&
        hoveredOutput.type === source.type &&
        hoveredOutput.id === source.id &&
        hoveredOutput.port === source.port
      ) {
        setHoveredOutput(null);
      }
    },
    [hoveredOutput],
  );

  const startLinkingFromInput = useCallback(
    (target: LinkTarget) =>
      (event: ReactPointerEvent<HTMLDivElement | HTMLButtonElement>) => {
        event.stopPropagation();
        event.preventDefault();
        if (event.detail >= 2) return;
        const anchor = getInputAnchor(target);
        if (!anchor) return;
        linkingRef.current = true;
        setLinking({ origin: "input", target, current: anchor });
      },
    [getInputAnchor],
  );

  const startLinkingFromOutput = useCallback(
    (from: LinkSource) =>
      (event: ReactPointerEvent<HTMLButtonElement | HTMLDivElement>) => {
        event.stopPropagation();
        event.preventDefault();
        if (event.detail >= 2) return;
        const anchor = getOutputAnchor(from);
        if (!anchor) return;
        linkingRef.current = true;
        setLinking({ origin: "output", from, current: anchor });
      },
    [getOutputAnchor],
  );

  const moveLinking = useCallback(
    (event: ReactPointerEvent<HTMLDivElement | HTMLButtonElement>) => {
      if (!linking) return;
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!world) return;
      setLinking((prev) => (prev ? { ...prev, current: world } : prev));
    },
    [linking, toWorldPoint],
  );

  const finalizeLinking = useCallback((overrideTarget?: LinkTarget) => {
    if (!linking) return;
    const target =
      overrideTarget ??
      (linking.origin === "output" ? hoveredInput : linking.target);
    const from = linking.origin === "output" ? linking.from : hoveredOutput;

    if (
      target &&
      from &&
      !(target.type === from.type && target.id === from.id)
    ) {
      const id = nextConnectionIdRef.current++;
      const targetBlock =
        target.type === "block" ? blocks.find((b) => b.id === target.id) : null;
      const targetHandles = targetBlock ? getBlockHandles(targetBlock) : null;
      const isBlockToolTarget =
        target.type === "block" &&
        targetHandles &&
        (target.inputIndex ?? -1) === targetHandles.toolPortIndex;
      const targetOperation =
        target.type === "operation" ? operations.find((op) => op.id === target.id) : null;
      const allowMultipleForTarget =
        target.type === "operation" && targetOperation?.kind === "aggregate";
      setConnections((prev) => {
        if (isBlockToolTarget) {
          const withoutDuplicate = prev.filter(
            (conn) =>
              !(
                conn.from.type === from.type &&
                conn.from.id === from.id &&
                conn.to.type === target.type &&
                conn.to.id === target.id &&
                (conn.to.inputIndex ?? 0) === 1
              ),
          );
          return [...withoutDuplicate, { id: `conn-${id}`, from, to: target }];
        }
        const targetSlot = target.inputIndex ?? 0;
        if (allowMultipleForTarget) {
          const withoutExactDuplicate = prev.filter(
            (conn) =>
              !(
                conn.from.type === from.type &&
                conn.from.id === from.id &&
                conn.to.type === target.type &&
                conn.to.id === target.id &&
                (conn.to.inputIndex ?? 0) === targetSlot
              ),
          );
          return [...withoutExactDuplicate, { id: `conn-${id}`, from, to: target }];
        }
        // enforce single connection per target slot (block/operation/tool inputs)
        return [
          ...prev.filter(
            (conn) =>
              !(
                conn.to.type === target.type &&
                conn.to.id === target.id &&
                (conn.to.inputIndex ?? 0) === targetSlot
              ),
          ),
          { id: `conn-${id}`, from, to: target },
        ];
      });
    }
    setLinking(null);
    linkingRef.current = false;
    setHoveredInput(null);
    setHoveredOutput(null);
  }, [blocks, getBlockHandles, hoveredInput, hoveredOutput, linking, operations]);

  const handleCanvasPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-note],[data-block],[data-operation],[data-tool],[data-upload],[data-output]")) return;
      setSelected(null);
      setHoveredInput(null);
      setHoveredOutput(null);
      setHoveredBlockId(null);
      setHoveredToolId(null);
      setHoveredUploadId(null);
      setHoveredOutputId(null);
      setLinking(null);
      linkingRef.current = false;
    },
    [],
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const modKey = isMac ? event.metaKey : event.ctrlKey;
      const key = event.key.toLowerCase();

      if (modKey && key === "c" && selected) {
        event.preventDefault();
        if (selected.type === "block") {
          const block = blocks.find((b) => b.id === selected.id);
          if (block) setClipboard({ type: "block", data: block });
        } else if (selected.type === "operation") {
          const op = operations.find((o) => o.id === selected.id);
          if (op) setClipboard({ type: "operation", data: op });
        } else if (selected.type === "tool") {
          const tool = tools.find((t) => t.id === selected.id);
          if (tool) setClipboard({ type: "tool", data: tool });
        } else if (selected.type === "upload") {
          const upload = uploads.find((u) => u.id === selected.id);
          if (upload) setClipboard({ type: "upload", data: upload });
        } else if (selected.type === "output") {
          const output = outputs.find((o) => o.id === selected.id);
          if (output) setClipboard({ type: "output", data: output });
        } else if (selected.type === "note") {
          const note = notes.find((n) => n.id === selected.id);
          if (note) setClipboard({ type: "note", data: note });
        }
        return;
      }

      if (modKey && key === "v" && clipboard) {
        event.preventDefault();
        const OFFSET = 26;
        if (clipboard.type === "block") {
          const base = clipboard.data;
          const id = nextBlockIdRef.current++;
          const newBlock: AgentBlock = {
            ...base,
            id: `block-${id}`,
            x: base.x + OFFSET,
            y: base.y + OFFSET,
            inputCount: clamp(base.inputCount, MIN_IO, MAX_IO),
            outputCount: clamp(base.outputCount, MIN_IO, MAX_IO),
          };
          setBlocks((prev) => [...prev, newBlock]);
          setSelected({ type: "block", id: newBlock.id });
        } else if (clipboard.type === "operation") {
          const base = clipboard.data;
          const id = nextOperationIdRef.current++;
          const newOp: Operation = { ...base, id: `op-${id}`, x: base.x + OFFSET, y: base.y + OFFSET };
          setOperations((prev) => [...prev, newOp]);
          setSelected({ type: "operation", id: newOp.id });
        } else if (clipboard.type === "tool") {
          const base = clipboard.data;
          const id = nextToolIdRef.current++;
          const newTool: ToolNode = { ...base, id: `tool-${id}`, x: base.x + OFFSET, y: base.y + OFFSET };
          setTools((prev) => [...prev, newTool]);
          setSelected({ type: "tool", id: newTool.id });
        } else if (clipboard.type === "upload") {
          const base = clipboard.data;
          const id = nextUploadIdRef.current++;
          const newUpload: UploadNode = { ...base, id: `upload-${id}`, x: base.x + OFFSET, y: base.y + OFFSET };
          setUploads((prev) => [...prev, newUpload]);
          setSelected({ type: "upload", id: newUpload.id });
        } else if (clipboard.type === "output") {
          const base = clipboard.data;
          const id = nextOutputIdRef.current++;
          const newOutput: OutputNode = { ...base, id: `output-${id}`, x: base.x + OFFSET, y: base.y + OFFSET };
          setOutputs((prev) => [...prev, newOutput]);
          setSelected({ type: "output", id: newOutput.id });
        } else if (clipboard.type === "note") {
          const base = clipboard.data;
          const id = nextIdRef.current++;
          const newNote: Note = { ...base, id: `note-${id}`, x: base.x + OFFSET, y: base.y + OFFSET };
          setNotes((prev) => [...prev, newNote]);
          setSelected({ type: "note", id: newNote.id });
        }
        return;
      }

      if (!selected) return;
      if (event.key !== "Backspace" && event.key !== "Delete") return;
      event.preventDefault();
      if (selected.type === "note") {
        handleRemoveNote(selected.id);
      } else if (selected.type === "block") {
        handleRemoveBlock(selected.id);
      } else if (selected.type === "operation") {
        handleRemoveOperation(selected.id);
      } else if (selected.type === "tool") {
        handleRemoveTool(selected.id);
      } else if (selected.type === "upload") {
        handleRemoveUpload(selected.id);
      } else if (selected.type === "output") {
        handleRemoveOutput(selected.id);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    MAX_IO,
    MIN_IO,
    blocks,
    clipboard,
    clamp,
    handleRemoveBlock,
    handleRemoveNote,
    handleRemoveOperation,
    handleRemoveOutput,
    handleRemoveTool,
    handleRemoveUpload,
    notes,
    operations,
    outputs,
    selected,
    tools,
    uploads,
  ]);

  useEffect(() => {
    return () => {
      if (startTimeoutRef.current) clearTimeout(startTimeoutRef.current);
    };
  }, []);

  const appThemeClass =
    theme === "dark"
      ? "bg-slate-950 text-slate-100"
      : "bg-slate-50 text-slate-900";
  const actionButtonClass =
    theme === "dark"
      ? "rounded-full border border-slate-700 bg-slate-800/90 px-4 py-2 text-sm font-semibold text-slate-100 shadow-sm hover:bg-slate-700"
      : "rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100";
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applySystemTheme = (prefersDark: boolean) => {
      if (userThemeLocked) return;
      setTheme(prefersDark ? "dark" : "light");
    };
    applySystemTheme(media.matches);
    const listener = (event: MediaQueryListEvent) => applySystemTheme(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [userThemeLocked]);

  return (
    <div className={`relative h-screen w-screen overflow-hidden transition-colors duration-200 ${appThemeClass}`}>
      <div className="absolute left-0 top-0 bottom-0 z-30 flex">
        <div className="flex flex-col items-center gap-2 bg-slate-900/95 px-2 py-3 text-white shadow-xl">
          {panelTabs.map((item) => (
            <button
              key={item.id}
              className={`h-12 w-12 rounded-md border border-slate-700 text-sm font-semibold transition ${
                activePanel === item.id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "bg-slate-800/70 text-white hover:bg-slate-800"
              }`}
              onClick={() => setActivePanel((prev) => (prev === item.id ? null : item.id))}
              aria-pressed={activePanel === item.id}
              aria-label={item.label}
            >
              {item.symbol}
            </button>
          ))}
        </div>

        {activePanel && (
          <div
            className={`w-72 backdrop-blur px-4 py-5 shadow-xl transition-all flex flex-col overflow-hidden ${
              theme === "dark"
                ? "border-r border-slate-800 bg-slate-900/90 text-slate-100"
                : "border-r border-slate-200 bg-white/95 text-slate-900"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {activePanel ? panelTitles[activePanel] : ""}
                </h2>
              </div>
              <button
                className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                onClick={() => setActivePanel(null)}
              >
                Close
              </button>
            </div>

            {activePanel === "blocks" && (
              <div className="mt-4 space-y-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Agent Blocks</p>
                <div
                  className="cursor-grab rounded-xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 p-4 shadow-sm active:cursor-grabbing"
                  draggable
                  onDragStart={handleBlockDragStart}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Agent: Splitter</p>
                      <p className="text-xs text-slate-600">1 input → 2 outputs</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                      Drag
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-[auto,1fr,auto] gap-3 items-center">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200" />
                      <span className="text-[11px] font-medium text-emerald-900">Input</span>
                    </div>
                    <div className="h-px bg-gradient-to-r from-emerald-200 via-emerald-100 to-transparent" />
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-[11px] font-medium text-slate-700">Output A</span>
                        <div className="h-2.5 w-2.5 rounded-full bg-sky-500 shadow-sm shadow-sky-200" />
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-[11px] font-medium text-slate-700">Output B</span>
                        <div className="h-2.5 w-2.5 rounded-full bg-sky-500 shadow-sm shadow-sky-200" />
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-600">
                    Drag this to the canvas to place your agent with one input and two outputs.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Generate from JSON</p>
                      <p className="text-xs text-slate-600">Build agents, inputs, outputs, and capability tools.</p>
                    </div>
                    <span className="rounded-full bg-slate-900/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
                      Beta
                    </span>
                  </div>
                  <textarea
                    className="mt-3 w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    rows={10}
                    value={agentJsonInput}
                    onChange={(e) => setAgentJsonInput(e.target.value)}
                    spellCheck={false}
                  />
                  {agentParseError && (
                    <p className="mt-2 text-xs font-semibold text-rose-600">{agentParseError}</p>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-[11px] text-slate-600">
                      Agents become blocks with matching input/output counts; capabilities become tools linked underneath.
                    </p>
                    <button
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500"
                      onClick={handleGenerateAgentsFromJson}
                    >
                      Generate agents
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activePanel === "operations" && (
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Operations</p>
                    <p className="text-sm text-slate-600">Drop pills to orchestrate flow</p>
                  </div>
                  <span className="rounded-full bg-slate-900/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                    New
                  </span>
                </div>
                <div className="space-y-3">
                  {operationKinds.map((kind) => {
                    const meta = operationMeta[kind];
                    return (
                      <div
                        key={kind}
                        className={`cursor-grab rounded-full border border-slate-200 bg-gradient-to-r ${meta.gradient} px-4 py-3 shadow-sm ring-1 ring-inset ${meta.ring} transition active:cursor-grabbing`}
                        draggable
                        onDragStart={handleOperationDragStart(kind)}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${meta.accent} text-xs font-semibold uppercase tracking-wide text-white shadow-sm shadow-slate-300/40`}
                            >
                              {meta.label.charAt(0)}
                            </span>
                            <div className="text-left">
                              <p className={`text-sm font-semibold ${meta.text}`}>{meta.label}</p>
                              <p className="text-[11px] text-slate-600">{meta.description}</p>
                            </div>
                          </div>
                          <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700 ring-1 ring-slate-200">
                            Drag
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  className="inline-flex items-center gap-2 rounded border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  onClick={reset}
                >
                  Reset view
                </button>
              </div>
            )}

            {activePanel === "tools" && (
              <div className="mt-4 flex-1 space-y-4 overflow-hidden">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Tools</p>
                    <p className="text-sm text-slate-600">Eleven trapezoid picks ready to drop</p>
                  </div>
                </div>
                <div className="mt-3 h-[calc(100vh-240px)] overflow-y-auto pr-2">
                  <div className="grid grid-cols-2 gap-3 auto-rows-max">
                    {toolPalette.map((tool) => (
                      <div
                        key={tool.name}
                        className="group relative flex items-center justify-center cursor-grab active:cursor-grabbing"
                        draggable
                        onDragStart={handleToolDragStart(tool.name)}
                      >
                        <div
                          className={`relative h-[110px] w-[180px] rounded-lg bg-gradient-to-br ${tool.gradient} ring-1 ring-inset ${tool.ring} shadow-sm transition duration-150 group-hover:shadow-md group-hover:-translate-y-0.5`}
                          aria-label={tool.name}
                        >
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
                            <p className="text-sm font-semibold text-slate-900 drop-shadow-sm">{tool.name}</p>
                            <p className="text-[11px] text-slate-700 leading-tight">{tool.tagline}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activePanel === "io" && (
              <div className="mt-4 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Inputs / Outputs</p>
                    <p className="text-sm text-slate-600">Place data ingress and egress blocks</p>
                  </div>
                  <span className="rounded-full bg-slate-900/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
                    IO
                  </span>
                </div>

                <div className="space-y-4">
                  <div
                    className="cursor-grab rounded-xl border border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-sky-100 p-4 shadow-sm ring-1 ring-inset ring-indigo-100 active:cursor-grabbing"
                    draggable
                    onDragStart={handleUploadDragStart}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Upload block</p>
                        <p className="text-xs text-slate-600">PDF, CSV, Excel, JSON, TXT and more</p>
                      </div>
                      <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700 ring-1 ring-slate-200">
                        Drag
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-[auto,1fr] gap-3 items-center text-[11px] text-slate-700">
                      <div className="h-10 w-10 rounded-lg bg-white/80 ring-1 ring-slate-200 shadow-sm flex items-center justify-center font-semibold text-indigo-600">
                        ⬆
                      </div>
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-800">Drop onto canvas</p>
                        <p className="text-slate-600">Click “Choose file” on the block to attach your data.</p>
                      </div>
                    </div>
                    <p className="mt-3 text-[11px] text-slate-600">
                      Use this as a data source before branching into agents or tools.
                    </p>
                  </div>

                  <div
                    className="cursor-grab rounded-xl border border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-amber-100 p-4 shadow-sm ring-1 ring-inset ring-emerald-100 active:cursor-grabbing"
                    draggable
                    onDragStart={handleOutputDragStart}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Output block</p>
                        <p className="text-xs text-slate-600">Define response/formatting requirements</p>
                      </div>
                      <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700 ring-1 ring-slate-200">
                        Drag
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-[auto,1fr] gap-3 items-center text-[11px] text-slate-700">
                      <div className="h-10 w-10 rounded-lg bg-white/80 ring-1 ring-emerald-100 shadow-sm flex items-center justify-center font-semibold text-emerald-600">
                        ⬇
                      </div>
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-800">Connect to outputs</p>
                        <p className="text-slate-600">Collect results and specify final format.</p>
                      </div>
                    </div>
                    <p className="mt-3 text-[11px] text-slate-600">
                      Ideal for summarizing, shaping JSON payloads, or preparing reports.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activePanel === "settings" && (
              <div className="mt-4 space-y-5 text-sm">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Theme</p>
                  <div className="flex items-center gap-2">
                    {(["light", "dark"] as const).map((mode) => (
                      <button
                        key={mode}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                          theme === mode
                            ? "bg-slate-900 text-white border-slate-700 shadow-sm"
                            : "bg-white/80 border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                        onClick={() => {
                          setUserThemeLocked(true);
                          setTheme(mode);
                        }}
                      >
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            mode === "light" ? "bg-amber-400" : "bg-emerald-400"
                          }`}
                        />
                        {mode === "light" ? "Light" : "Dark"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Canvas background</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "grid", name: "Soft grid", accent: "from-slate-100 via-white to-slate-200" },
                      { id: "aurora", name: "Aurora", accent: "from-emerald-100 via-teal-100 to-indigo-100" },
                      { id: "blueprint", name: "Blueprint", accent: "from-sky-100 via-blue-100 to-indigo-200" },
                    ].map((preset) => (
                      <button
                        key={preset.id}
                        className={`relative h-24 rounded-xl border text-left p-3 shadow-sm transition ${
                          backgroundPreset === preset.id
                            ? "border-slate-900 ring-2 ring-slate-900"
                            : "border-slate-200 hover:border-slate-300"
                        } bg-gradient-to-br ${preset.accent}`}
                        onClick={() => setBackgroundPreset(preset.id as typeof backgroundPreset)}
                      >
                        <span className="text-xs font-semibold text-slate-800">{preset.name}</span>
                        {backgroundPreset === preset.id && (
                          <span className="absolute right-2 top-2 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                            Active
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Backgrounds apply to the canvas; theme updates surrounding UI chrome.
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Links</p>
                  <div className="flex flex-wrap gap-2">
                    {["Docs", "Changelog", "Support"].map((label) => (
                      <button
                        key={label}
                        className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        onClick={() => setSelected(null)}
                      >
                        Add {label} link
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <main className="relative z-0 h-full w-full">
        <div className="absolute top-4 right-6 z-30 flex items-center gap-3">
          <button
            className={actionButtonClass}
            onClick={() => {
              if (startTimeoutRef.current) clearTimeout(startTimeoutRef.current);
              setStartExiting(false);
              setShowStart(true);
            }}
          >
            Flow
          </button>
          <button
            className={actionButtonClass}
            onClick={() => setActivePanel("settings")}
          >
            About
          </button>
          <button
            className={actionButtonClass}
            onClick={() => {
              reset();
              setSelected(null);
            }}
          >
            Reset
          </button>
        </div>
        <div
          ref={containerRef}
          className="absolute inset-0"
          style={{ touchAction: "none" }}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
          onPointerDownCapture={handleCanvasPointerDown}
        >
          <Background transform={transform} theme={theme} preset={backgroundPreset} />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
              transformOrigin: "0 0",
              width: "100%",
              height: "100%",
              transition: "none",
              willChange: "transform",
              pointerEvents: "auto",
            }}
            onPointerMove={moveLinking}
            onPointerUp={() => {
              if (linking) finalizeLinking();
            }}
          >
            {/* existing connections */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              xmlns="http://www.w3.org/2000/svg"
              overflow="visible"
            >
              {connections.map((conn) => {
                const start = getOutputAnchor(conn.from);
                const end = getInputAnchor(conn.to);
                if (!start || !end) return null;
                const d = buildConnectionPath(start, end);
                const stroke =
                  conn.from.type === "operation"
                    ? "rgba(99, 102, 241, 0.7)"
                    : "rgba(56, 189, 248, 0.7)";
                return (
                  <path
                    key={conn.id}
                    d={d}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                );
              })}

              {linking && (() => {
                const start =
                  linking.origin === "output"
                    ? getOutputAnchor(linking.from)
                    : getInputAnchor(linking.target);
                if (!start) return null;
                const end = linking.current;
                const d = buildConnectionPath(start, end);
                return (
                  <path
                    d={d}
                    fill="none"
                    stroke="rgba(59, 130, 246, 0.6)"
                    strokeDasharray="6 6"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                );
              })()}
            </svg>

            {blocks.map((block) => {
              const isActive = selected?.type === "block" && selected.id === block.id;
              const linkingActive = Boolean(linking);
              const showConnections =
                isActive ||
                draggingBlockId === block.id ||
                linkingActive ||
                hoveredBlockId === block.id;
              const blockPresetValue =
                block.presetId && agentPresets.some((p) => p.id === block.presetId)
                  ? block.presetId
                  : "custom";
              const handles = getBlockHandles(block);
              return (
                <div
                  key={block.id}
                  className="absolute"
                  style={{ left: block.x, top: block.y }}
                  onPointerEnter={() => setHoveredBlockId(block.id)}
                  onPointerLeave={() =>
                    setHoveredBlockId((prev) => (prev === block.id ? null : prev))
                  }
                >
                  <div
                    className={`relative rounded-lg border border-slate-200 bg-white/90 shadow-md backdrop-blur-sm transition-all duration-150 w-[220px] p-3 scale-[0.97] min-h-[120px] ${
                      showConnections ? "ring-2 ring-emerald-300" : ""
                    } cursor-grab active:cursor-grabbing select-none`}
                    data-block
                    onPointerDown={handleBlockPointerDown(block.id)}
                    onPointerMove={handleBlockPointerMove(block.id)}
                    onPointerUp={handleBlockPointerUp(block.id)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setSelected(null);
                    }}
                  >
                    <button
                      className={`absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white text-xs shadow-md transition-all duration-150 ${
                        isActive ? "scale-100 opacity-100" : "scale-75 opacity-0 pointer-events-none"
                      }`}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onClick={() => handleRemoveBlock(block.id)}
                      aria-label="Remove block"
                    >
                      ×
                    </button>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{block.name}</p>
                        <select
                          className="rounded border border-slate-200 bg-white/80 text-xs font-semibold text-slate-700 px-2 py-1"
                          value={blockPresetValue}
                          onChange={(e) => {
                            if (e.target.value === "custom") {
                              markBlockCustom(block.id);
                            } else {
                              applyPresetToBlock(block.id, e.target.value);
                            }
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          onDoubleClick={(e) => e.stopPropagation()}
                        >
                          <option value="custom">Custom</option>
                          {agentPresets.map((preset) => (
                            <option key={preset.id} value={preset.id}>
                              {preset.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                        Agent
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-700">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 ring-1 ring-emerald-100">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        {block.inputCount} inputs
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-1 ring-1 ring-sky-100">
                        <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                        {block.outputCount} outputs
                      </span>
                    </div>
                  </div>

                  {/* connection handles for visual targeting */}
                  <div
                      className={`absolute left-1/2 -bottom-4 -translate-x-1/2 flex h-8 w-8 items-center justify-center transition-all duration-150 z-10 ${
                      showConnections ? "opacity-100 scale-100" : "opacity-0 scale-75"
                    }`}
                    style={{ width: 24, height: 24, pointerEvents: "auto" }}
                    data-input
                    data-connector
                    onPointerEnter={handleInputEnter({
                      type: "block",
                      id: block.id,
                      inputIndex: handles.toolPortIndex,
                    })}
                    onPointerLeave={handleInputLeave({
                      type: "block",
                      id: block.id,
                      inputIndex: handles.toolPortIndex,
                    })}
                    onPointerDownCapture={startLinkingFromInput({
                      type: "block",
                      id: block.id,
                      inputIndex: handles.toolPortIndex,
                    })}
                    onPointerDown={startLinkingFromInput({
                      type: "block",
                      id: block.id,
                      inputIndex: handles.toolPortIndex,
                    })}
                    onPointerUp={() =>
                      finalizeLinking({
                        type: "block",
                        id: block.id,
                        inputIndex: handles.toolPortIndex,
                      })
                    }
                    aria-label="Attach tool"
                  >
                    <HandleDot />
                  </div>
                  {handles.inputAnchors.map((anchor, idx) => (
                    <div
                      key={idx}
                      className={`absolute flex items-center justify-center transition-all duration-150 z-10 ${
                        showConnections ? "opacity-100 scale-100" : "opacity-0 scale-75"
                      }`}
                      style={{
                        top: anchor.y - block.y - 12,
                        left: anchor.x - block.x - 12,
                        width: 24,
                        height: 24,
                        pointerEvents: "auto",
                      }}
                      data-input
                      data-connector
                      onPointerDownCapture={startLinkingFromInput({ type: "block", id: block.id, inputIndex: idx })}
                      onPointerEnter={handleInputEnter({ type: "block", id: block.id, inputIndex: idx })}
                      onPointerLeave={handleInputLeave({ type: "block", id: block.id, inputIndex: idx })}
                      onPointerDown={startLinkingFromInput({ type: "block", id: block.id, inputIndex: idx })}
                      onPointerUp={() =>
                        finalizeLinking({
                          type: "block",
                          id: block.id,
                          inputIndex: idx,
                        })
                      }
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        changeBlockInputs(block.id, e.altKey ? -1 : 1);
                      }}
                    >
                      <HandleDot />
                    </div>
                  ))}
                  {handles.outputAnchors.map((anchor, idx) => (
                    <div
                      key={idx}
                      className={`absolute flex items-center justify-center transition-all duration-150 z-10 ${
                        showConnections ? "opacity-100 scale-100" : "opacity-0 scale-75"
                      }`}
                      style={{
                        top: anchor.y - block.y - 12,
                        left: anchor.x - block.x - 12,
                        width: 24,
                        height: 24,
                        pointerEvents: "auto",
                      }}
                      data-output
                      data-connector
                      data-port={idx}
                      onPointerDownCapture={startLinkingFromOutput({ type: "block", id: block.id, port: idx })}
                      onPointerDown={startLinkingFromOutput({ type: "block", id: block.id, port: idx })}
                      onPointerEnter={handleOutputEnter({ type: "block", id: block.id, port: idx })}
                      onPointerLeave={handleOutputLeave({ type: "block", id: block.id, port: idx })}
                      onPointerMove={moveLinking}
                      onPointerUp={() => finalizeLinking()}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        changeBlockOutputs(block.id, e.altKey ? -1 : 1);
                      }}
                    >
                      <HandleDot />
                    </div>
                  ))}
                </div>
              );
            })}
            {uploads.map((upload) => {
              const isActive = selected?.type === "upload" && selected.id === upload.id;
              const isDragging = draggingUploadId === upload.id;
              const handles = getUploadHandles(upload);
              const showHandles =
                isActive ||
                isDragging ||
                hoveredUploadId === upload.id ||
                Boolean(linking);
              const fileLabel = upload.fileName ?? "No file attached";
              const fileMeta =
                upload.status === "ready"
                  ? `${upload.fileType ?? "File"}${upload.fileSize ? ` • ${formatBytes(upload.fileSize)}` : ""}`
                  : "Accepted: PDF, CSV, Excel, JSON, TXT";
              return (
                <div
                  key={upload.id}
                  className="absolute"
                  style={{ left: upload.x, top: upload.y }}
                  onPointerEnter={() => setHoveredUploadId(upload.id)}
                  onPointerLeave={() =>
                    setHoveredUploadId((prev) => (prev === upload.id ? null : prev))
                  }
                >
                  <div
                    className={`relative rounded-xl border border-slate-200 bg-white/90 p-4 shadow-md backdrop-blur-sm transition-all duration-150 ${
                      isActive ? "ring-2 ring-indigo-300" : ""
                    } ${isDragging ? "scale-[1.01]" : "scale-[0.98]"} cursor-grab active:cursor-grabbing select-none`}
                    data-upload
                    style={{ width: handles.width, height: handles.height }}
                    onPointerDown={handleUploadPointerDown(upload.id)}
                    onPointerMove={handleUploadPointerMove(upload.id)}
                    onPointerUp={handleUploadPointerUp(upload.id)}
                  >
                    <button
                      className={`absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white text-xs shadow-md transition-all duration-150 ${
                        isActive ? "scale-100 opacity-100" : "scale-75 opacity-0 pointer-events-none"
                      }`}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onClick={() => handleRemoveUpload(upload.id)}
                      aria-label="Remove upload block"
                    >
                      ×
                    </button>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{upload.name}</p>
                        <p className="text-xs text-slate-600">Attach data to feed the flow</p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ring-1 ${
                          upload.status === "ready"
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                            : "bg-amber-50 text-amber-700 ring-amber-100"
                        }`}
                      >
                        {upload.status === "ready" ? "Ready" : "No file"}
                      </span>
                    </div>

                    <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-3 text-left">
                      <p className="text-xs font-semibold text-slate-800 break-words">{fileLabel}</p>
                      <p className="text-[11px] text-slate-600">{fileMeta}</p>
                      <div className="mt-3 flex items-center gap-2">
                        <input
                          id={`upload-input-${upload.id}`}
                          type="file"
                          className="hidden"
                          onChange={handleUploadFileChange(upload.id)}
                          accept=".pdf,.csv,.xlsx,.xls,.json,.txt,.doc,.docx,.xml,.zip"
                          data-upload-control
                        />
                        <label
                          htmlFor={`upload-input-${upload.id}`}
                          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 cursor-pointer"
                          data-upload-control
                        >
                          Choose file
                        </label>
                        {upload.fileName && (
                          <button
                            className="text-[11px] font-semibold text-slate-600 underline decoration-dotted underline-offset-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              setUploads((prev) =>
                                prev.map((item) =>
                                  item.id === upload.id
                                    ? { ...item, status: "idle", fileName: undefined, fileSize: undefined, fileType: undefined }
                                    : item,
                                ),
                              );
                            }}
                            data-upload-control
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`absolute flex h-8 w-8 items-center justify-center transition-all duration-150 z-10 ${
                      showHandles ? "opacity-100 scale-100" : "opacity-0 scale-75"
                    }`}
                    style={{
                      top: handles.output.y - upload.y - 12,
                      left: handles.output.x - upload.x - 12,
                      width: 24,
                      height: 24,
                      pointerEvents: "auto",
                    }}
                    data-output
                    data-connector
                    onPointerDownCapture={startLinkingFromOutput({ type: "upload", id: upload.id, port: 0 })}
                    onPointerDown={startLinkingFromOutput({ type: "upload", id: upload.id, port: 0 })}
                    onPointerEnter={handleOutputEnter({ type: "upload", id: upload.id, port: 0 })}
                    onPointerLeave={handleOutputLeave({ type: "upload", id: upload.id, port: 0 })}
                    onPointerMove={moveLinking}
                    onPointerUp={() => finalizeLinking()}
                  >
                    <HandleDot />
                  </div>
                </div>
              );
            })}
            {outputs.map((output) => {
              const isActive = selected?.type === "output" && selected.id === output.id;
              const isDragging = draggingOutputId === output.id;
              const handles = getOutputHandles(output);
              const showHandles =
                isActive ||
                isDragging ||
                hoveredOutputId === output.id ||
                Boolean(linking);
              return (
                <div
                  key={output.id}
                  className="absolute"
                  style={{ left: output.x, top: output.y }}
                  onPointerEnter={() => setHoveredOutputId(output.id)}
                  onPointerLeave={() =>
                    setHoveredOutputId((prev) => (prev === output.id ? null : prev))
                  }
                >
                  <div
                    className={`relative rounded-xl border border-slate-200 bg-white/90 p-4 shadow-md backdrop-blur-sm transition-all duration-150 ${
                      isActive ? "ring-2 ring-amber-300" : ""
                    } ${isDragging ? "scale-[1.01]" : "scale-[0.98]"} cursor-grab active:cursor-grabbing select-none flex flex-col gap-3`}
                    data-output
                    style={{ width: handles.width, height: handles.height }}
                    onPointerDown={handleOutputPointerDown(output.id)}
                    onPointerMove={handleOutputPointerMove(output.id)}
                    onPointerUp={handleOutputPointerUp(output.id)}
                  >
                    <button
                      className={`absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white text-xs shadow-md transition-all duration-150 ${
                        isActive ? "scale-100 opacity-100" : "scale-75 opacity-0 pointer-events-none"
                      }`}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onClick={() => handleRemoveOutput(output.id)}
                      aria-label="Remove output block"
                    >
                      ×
                    </button>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{output.name}</p>
                        <p className="text-xs text-slate-600">Describe the final response shape</p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-amber-100">
                        Sink
                      </span>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 flex flex-col gap-2">
                      <p className="text-[11px] font-semibold text-slate-800 mb-2">Output format</p>
                      <textarea
                        className="w-full rounded-md border border-slate-200 bg-white/90 px-2 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none min-h-[88px]"
                        rows={3}
                        value={output.format}
                        onChange={handleOutputFormatChange(output.id)}
                        spellCheck={false}
                        data-output-control
                        onBlur={handleOutputFormatBlur(output.id)}
                      />
                    </div>
                  </div>
                  <div
                    className={`absolute flex h-8 w-8 items-center justify-center transition-all duration-150 z-10 ${
                      showHandles ? "opacity-100 scale-100" : "opacity-0 scale-75"
                    }`}
                    style={{
                      top: handles.input.y - output.y - 12,
                      left: handles.input.x - output.x - 12,
                      width: 24,
                      height: 24,
                      pointerEvents: "auto",
                    }}
                    data-input
                    data-connector
                    onPointerDownCapture={startLinkingFromInput({ type: "output", id: output.id, inputIndex: 0 })}
                    onPointerEnter={handleInputEnter({ type: "output", id: output.id, inputIndex: 0 })}
                    onPointerLeave={handleInputLeave({ type: "output", id: output.id, inputIndex: 0 })}
                    onPointerDown={startLinkingFromInput({ type: "output", id: output.id, inputIndex: 0 })}
                    onPointerUp={() =>
                      finalizeLinking({
                        type: "output",
                        id: output.id,
                        inputIndex: 0,
                      })
                    }
                  >
                    <HandleDot />
                  </div>
                </div>
              );
            })}
            {operations.map((operation) => {
              const meta = operationMeta[operation.kind];
              const isActive =
                selected?.type === "operation" && selected.id === operation.id;
              const handles = getOperationHandles(operation);
              const isSourceLinking =
                linking?.origin === "output" &&
                linking.from.type === "operation" &&
                linking.from.id === operation.id;
              const isTargetLinking =
                linking?.origin === "input" &&
                linking.target.type === "operation" &&
                linking.target.id === operation.id;
              const showHandles =
                hoveredOperationId === operation.id ||
                draggingOperationId === operation.id ||
                isSourceLinking ||
                isTargetLinking ||
                Boolean(linking);
              const pillHeight = 60;
              return (
                <div
                  key={operation.id}
                  className="absolute"
                  style={{ left: operation.x, top: operation.y }}
                  onPointerEnter={() => setHoveredOperationId(operation.id)}
                  onPointerLeave={() =>
                    setHoveredOperationId((prev) => (prev === operation.id ? null : prev))
                  }
                >
                  <div
                    className={`relative rounded-full border border-slate-200 bg-gradient-to-r ${meta.gradient} px-4 py-3 shadow-md ring-1 ring-inset ${meta.ring} transition-all duration-150 overflow-visible ${
                      isActive ? "ring-2 ring-offset-2 ring-offset-white shadow-lg" : ""
                    } cursor-grab active:cursor-grabbing select-none`}
                    data-operation
                    style={{ width: handles.width, height: pillHeight }}
                    onPointerDown={handleOperationPointerDown(operation.id)}
                    onPointerMove={handleOperationPointerMove(operation.id)}
                    onPointerUp={handleOperationPointerUp(operation.id)}
                  >
                    <button
                      className={`absolute -right-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white text-xs shadow-md transition-all duration-150 ${
                        isActive ? "scale-100 opacity-100" : "scale-75 opacity-0 pointer-events-none"
                      }`}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onClick={() => handleRemoveOperation(operation.id)}
                      aria-label="Remove operation"
                    >
                      ×
                    </button>
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${meta.accent} text-sm font-semibold uppercase tracking-wide text-white shadow-sm shadow-slate-300/50`}
                      >
                        {meta.label.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="flex flex-col">
                        <span className={`text-sm font-semibold ${meta.text}`}>{meta.label}</span>
                        <span className="text-[11px] text-slate-600">Operation</span>
                      </div>
                      <div className="ml-auto flex h-6 items-center gap-1 rounded-full bg-white/80 px-3 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
                        <div className={`h-2 w-2 rounded-full ${meta.accent}`} />
                        <span>Drop</span>
                      </div>
                    </div>

                    {/* connection handles */}
                    {handles.inputAnchors.map((anchor, idx) => (
                    <div
                      key={idx}
                      className={`absolute flex items-center justify-center transition-all duration-150 z-10 ${
                          showHandles ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"
                        }`}
                        style={{
                          top: anchor.y - operation.y - 12,
                          left: anchor.x - operation.x - 12,
                          width: 24,
                          height: 24,
                          pointerEvents: "auto",
                        }}
                        data-input
                      data-connector
                      onPointerEnter={handleInputEnter({
                        type: "operation",
                        id: operation.id,
                        inputIndex: idx,
                      })}
                      onPointerLeave={handleInputLeave({
                        type: "operation",
                        id: operation.id,
                        inputIndex: idx,
                      })}
                      onPointerDownCapture={startLinkingFromInput({
                        type: "operation",
                        id: operation.id,
                        inputIndex: idx,
                      })}
                      onPointerDown={startLinkingFromInput({
                        type: "operation",
                        id: operation.id,
                        inputIndex: idx,
                      })}
                      onPointerUp={() =>
                        finalizeLinking({
                          type: "operation",
                          id: operation.id,
                          inputIndex: idx,
                          })
                        }
                      >
                        <HandleDot />
                      </div>
                    ))}
                    {handles.outputAnchors.map((anchor, idx) => (
                    <div
                      key={idx}
                        className={`absolute flex items-center justify-center transition-all duration-150 z-10 ${
                          showHandles ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"
                        }`}
                        style={{
                          top: anchor.y - operation.y - 12,
                          left: anchor.x - operation.x - 12,
                          width: 24,
                          height: 24,
                          pointerEvents: "auto",
                        }}
                        data-output
                        data-connector
                        onPointerDown={startLinkingFromOutput({
                          type: "operation",
                          id: operation.id,
                          port: idx,
                        })}
                        onPointerDownCapture={startLinkingFromOutput({
                          type: "operation",
                          id: operation.id,
                          port: idx,
                        })}
                        onPointerEnter={handleOutputEnter({
                          type: "operation",
                          id: operation.id,
                          port: idx,
                        })}
                        onPointerLeave={handleOutputLeave({
                          type: "operation",
                          id: operation.id,
                          port: idx,
                        })}
                        onPointerMove={moveLinking}
                        onPointerUp={() => finalizeLinking()}
                      >
                        <HandleDot />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {tools.map((tool) => {
              const isActive = selected?.type === "tool" && selected.id === tool.id;
              const isDragging = draggingToolId === tool.id;
              const handles = getToolHandles(tool);
              const width = handles.width;
              const height = handles.height;
              const showHandles =
                isActive ||
                isDragging ||
                hoveredToolId === tool.id ||
                (linking?.origin === "output" && linking.from.id === tool.id) ||
                (linking?.origin === "input" && linking.target.id === tool.id) ||
                (linking
                  ? Math.hypot(linking.current.x - (tool.x + width / 2), linking.current.y - (tool.y + height / 2)) < 140
                  : false);
              return (
                <div
                  key={tool.id}
                  className="absolute"
                  style={{ left: tool.x, top: tool.y }}
                  onPointerEnter={() => setHoveredToolId(tool.id)}
                  onPointerLeave={() =>
                    setHoveredToolId((prev) => (prev === tool.id ? null : prev))
                  }
                >
                  <div
                    className={`relative overflow-visible ${isActive ? "ring-2 ring-offset-2 ring-offset-white shadow-lg" : ""} ${
                      isDragging ? "scale-[1.01]" : ""
                    } cursor-grab active:cursor-grabbing select-none`}
                    data-tool
                    style={{ width, height }}
                    onPointerDown={handleToolPointerDown(tool.id)}
                    onPointerMove={handleToolPointerMove(tool.id)}
                    onPointerUp={handleToolPointerUp(tool.id)}
                  >
                    <div
                      className={`absolute inset-0 rounded-lg bg-gradient-to-br ${tool.gradient} ring-1 ring-inset ${tool.ring} shadow-sm transition-all duration-150 pointer-events-none`}
                    />
                    <div className="relative h-full w-full flex items-center justify-center px-4 text-center">
                      <button
                        className={`absolute -right-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white text-xs shadow-md transition-all duration-150 ${
                          isActive ? "scale-100 opacity-100" : "scale-75 opacity-0 pointer-events-none"
                        }`}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                        onClick={() => handleRemoveTool(tool.id)}
                        aria-label="Remove tool"
                      >
                        ×
                      </button>
                      <p className="text-base font-semibold text-slate-900">{tool.name}</p>
                    </div>
                    <div
                      className={`absolute left-1/2 -top-4 -translate-x-1/2 flex h-8 w-8 items-center justify-center transition-all duration-150 z-10 ${
                        showHandles ? "opacity-100 scale-100" : "opacity-0 scale-75"
                      }`}
                      style={{ top: handles.output.y - tool.y - 16, pointerEvents: "auto" }}
                      data-output
                      data-input
                      data-connector
                      onPointerDown={startLinkingFromOutput({ type: "tool", id: tool.id, port: 0 })}
                      onPointerDownCapture={startLinkingFromOutput({ type: "tool", id: tool.id, port: 0 })}
                      onPointerEnter={handleOutputEnter({ type: "tool", id: tool.id, port: 0 })}
                      onPointerLeave={handleOutputLeave({ type: "tool", id: tool.id, port: 0 })}
                      onPointerMove={moveLinking}
                      onPointerUp={() => finalizeLinking({ type: "tool", id: tool.id })}
                    >
                      <HandleDot />
                    </div>
                  </div>
                </div>
              );
            })}
            {notes.map((note) => (
              <div
                key={note.id}
                className="absolute"
                style={{ left: note.x, top: note.y }}
              >
                <div
                  className={`relative w-48 rounded border border-yellow-200 bg-yellow-100/90 p-3 shadow ${
                    draggingNoteId === note.id || (selected?.type === "note" && selected.id === note.id)
                      ? "ring-2 ring-yellow-300"
                      : ""
                  } cursor-grab active:cursor-grabbing select-none`}
                  data-note
                  onPointerDown={handleNotePointerDown(note.id)}
                  onPointerMove={handleNotePointerMove(note.id)}
                  onPointerUp={handleNotePointerUp(note.id)}
                >
                  <button
                    className={`absolute -right-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white text-xs shadow-md transition-all duration-150 ${
                      selected?.type === "note" && selected.id === note.id
                        ? "scale-100 opacity-100"
                        : "scale-75 opacity-0 pointer-events-none"
                    }`}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onClick={() => handleRemoveNote(note.id)}
                    aria-label="Remove note"
                  >
                    ×
                  </button>
                  <div className="text-sm font-semibold text-slate-800">
                    {note.text}
                  </div>
                  <p className="mt-1 text-xs text-slate-700">
                    Add your quick reminder here.
                  </p>
                </div>
              </div>
            ))}
            <div style={{ padding: 40 }}>
              {/* canvas placeholder card removed per request */}
            </div>
          </div>
        </div>
      </main>
      {(showStart || startExiting) && (
        <div
          className={`absolute inset-0 z-40 transition-opacity duration-500 ease-out ${
            showStart && !startExiting ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          style={{
            background:
              theme === "dark"
                ? "radial-gradient(120% 140% at 25% 18%, rgba(15,23,42,0.2), rgba(15,23,42,0)), radial-gradient(120% 140% at 80% 75%, rgba(255,255,255,0.04), rgba(255,255,255,0)), linear-gradient(135deg, #0f172a 0%, #0b1224 52%, #0f172a 100%)"
                : "radial-gradient(120% 140% at 25% 18%, rgba(0,0,0,0.05), rgba(0,0,0,0)), radial-gradient(120% 140% at 80% 75%, rgba(15,23,42,0.08), rgba(15,23,42,0)), linear-gradient(135deg, #f8f5ed 0%, #f2ede4 52%, #ebe6de 100%)",
          }}
        >
          <div className="relative w-full h-full">
            <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-emerald-100 blur-3xl opacity-60 pointer-events-none" />
            <div
              className={`absolute -bottom-12 -left-12 h-28 w-28 rounded-full blur-3xl opacity-40 pointer-events-none ${
                theme === "dark" ? "bg-slate-800" : "bg-slate-200"
              }`}
            />
            <div className="absolute top-1/2 left-[48%] -translate-y-1/2">
              <div className="flex flex-col items-start gap-4">
                {[
                  { letter: "F", word: "Forge" },
                  { letter: "L", word: "Link" },
                  { letter: "O", word: "Orchestrate" },
                  { letter: "W", word: "Workflows" },
                ].map((item, idx) => (
                  <div
                    key={item.letter}
                    className="flex items-center gap-4 letter-cycle"
                    style={{
                      animationDelay: `${0.6 + idx * 1.5}s`,
                      animationDuration: "8s",
                      fontFamily: "'Playfair Display', 'Times New Roman', serif",
                    }}
                  >
                    <span
                      className={`text-6xl font-black leading-none tracking-tight ${
                        theme === "dark" ? "text-slate-100" : "text-slate-800"
                      }`}
                    >
                      {item.letter}
                    </span>
                    <span
                      className={`text-lg font-semibold tracking-wide uppercase ${
                        theme === "dark" ? "text-slate-200" : "text-slate-600"
                      }`}
                    >
                      {item.word}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 bottom-16">
              <button
                className={`rounded-full px-5 py-2.5 text-sm font-semibold shadow-lg shadow-slate-300/60 ${
                  theme === "dark"
                    ? "bg-white text-slate-900 hover:bg-slate-100"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
                onClick={handleEnterWorkspace}
              >
                Enter workspace
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="absolute bottom-3 right-4 z-20 text-xs font-semibold text-slate-400">
        © 2025 All rights reserved
      </div>
    </div>
  );
}

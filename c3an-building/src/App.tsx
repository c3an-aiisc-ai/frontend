import {
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

type Connection = {
  id: string;
  from:
    | { type: "block"; id: string; port: number }
    | { type: "operation"; id: string; port: number }
    | { type: "tool"; id: string; port: number };
  to: { type: "block" | "operation" | "tool"; id: string; inputIndex?: number };
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
  | null;

type PanelKey = "blocks" | "operations" | "tools" | "settings";

export default function App() {
  const linkingRef = useRef(false);
  const { containerRef, transform, reset } = usePanZoom({
    initial: { x: 0, y: 0, zoom: 1 },
    shouldAllowPan: (event) => {
      if (linkingRef.current) return false;
      const target = event.target as HTMLElement | null;
      return !target?.closest("[data-note],[data-block],[data-operation],[data-tool]");
    },
    isPanDisabled: () => linkingRef.current,
  });
  const [activePanel, setActivePanel] = useState<PanelKey | null>("blocks");
  const [notes, setNotes] = useState<Note[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [blocks, setBlocks] = useState<AgentBlock[]>([]);
  const [tools, setTools] = useState<ToolNode[]>([]);
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
    type: "block" | "operation" | "tool";
    id: string;
    inputIndex?: number;
  } | null>(null);
  const [hoveredOutput, setHoveredOutput] = useState<LinkSource | null>(null);
  const nextIdRef = useRef(1);
  const nextOperationIdRef = useRef(1);
  const nextBlockIdRef = useRef(1);
  const nextToolIdRef = useRef(1);
  const nextConnectionIdRef = useRef(1);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const operationDragOffsetRef = useRef({ x: 0, y: 0 });
  const blockDragOffsetRef = useRef({ x: 0, y: 0 });
  const toolDragOffsetRef = useRef({ x: 0, y: 0 });
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const [draggingOperationId, setDraggingOperationId] = useState<string | null>(null);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [draggingToolId, setDraggingToolId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selection>(null);
  const [hoveredOperationId, setHoveredOperationId] = useState<string | null>(null);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [hoveredToolId, setHoveredToolId] = useState<string | null>(null);

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
    settings: "Settings",
  };
  const panelTabs: { id: PanelKey; label: string; symbol: string }[] = [
    { id: "blocks", label: "Blocks", symbol: "[]" },
    { id: "operations", label: "Operations", symbol: "Ops" },
    { id: "tools", label: "Tools", symbol: "TL" },
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
        setBlocks((prev) => [
          ...prev,
          {
            id: `block-${id}`,
            x: worldX,
            y: worldY,
            name: "Agent Block",
            description: "1 input, 2 outputs",
            inputCount: 1,
            outputCount: 2,
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
    [containerRef, toolPalette, transform.x, transform.y, transform.zoom],
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
    const input: AnchorPoint = { x: tool.x, y: tool.y + height / 2, dir: "left" };
    return { width, height, output, input };
  }, []);

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
      const operation = operations.find((op) => op.id === endpoint.id);
      if (!operation) return null;
      const handles = getOperationHandles(operation);
      const index = Math.min(
        handles.outputAnchors.length - 1,
        Math.max(0, endpoint.port),
      );
      return handles.outputAnchors[index];
    },
    [blocks, getBlockHandles, getOperationHandles, getToolHandles, operations, tools],
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
      const operation = operations.find((op) => op.id === target.id);
      if (!operation) return null;
      const handles = getOperationHandles(operation);
      const index = Math.min(
        handles.inputAnchors.length - 1,
        Math.max(0, target.inputIndex ?? 0),
      );
      return handles.inputAnchors[index];
    },
    [blocks, getBlockHandles, getOperationHandles, getToolHandles, operations, tools],
  );

  const buildConnectionPath = useCallback(
    (start: AnchorPoint, end: AnchorPoint) => {
      const pad = 16;
      const startDir = start.dir;
      const first: AnchorPoint = { ...start };
      if (startDir === "left") first.x -= pad;
      else if (startDir === "right") first.x += pad;
      else if (startDir === "up") first.y -= pad;
      else if (startDir === "down") first.y += pad;

      const dx = end.x - first.x;
      const dy = end.y - first.y;
      const absDx = Math.abs(dx);
      if (absDx < 12 && Math.abs(dy) < 12) {
        return `M ${start.x} ${start.y} L ${first.x} ${first.y} L ${end.x} ${end.y}`;
      }

      const curveDir =
        startDir === "left" ? -1 : startDir === "right" ? 1 : dx >= 0 ? 1 : -1;
      const curve = Math.min(240, Math.max(70, absDx * 0.68));
      const yEase = dy * 0.24;
      const cx1 = first.x + curveDir * curve;
      const cx2 = end.x - curveDir * curve;
      return `M ${start.x} ${start.y} L ${first.x} ${first.y} C ${cx1} ${first.y + yEase} ${cx2} ${end.y - yEase} ${end.x} ${end.y}`;
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

  const handleInputEnter = useCallback(
    (target: { type: "block" | "operation" | "tool"; id: string; inputIndex?: number }) => () => {
      if (linking) setHoveredInput(target);
    },
    [linking],
  );

  const handleInputLeave = useCallback(
    (target: { type: "block" | "operation" | "tool"; id: string; inputIndex?: number }) => () => {
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
  }, [blocks, getBlockHandles, hoveredInput, hoveredOutput, linking]);

  const handleCanvasPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-note],[data-block],[data-operation],[data-tool]")) return;
      setSelected(null);
      setHoveredInput(null);
      setHoveredOutput(null);
      setHoveredBlockId(null);
      setHoveredToolId(null);
      setLinking(null);
      linkingRef.current = false;
    },
    [],
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!selected) return;
      if (event.key !== "Backspace" && event.key !== "Delete") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      event.preventDefault();
      if (selected.type === "note") {
        handleRemoveNote(selected.id);
      } else if (selected.type === "block") {
        handleRemoveBlock(selected.id);
      } else if (selected.type === "operation") {
        handleRemoveOperation(selected.id);
      } else if (selected.type === "tool") {
        handleRemoveTool(selected.id);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleRemoveBlock, handleRemoveNote, handleRemoveOperation, handleRemoveTool, selected]);

  return (
    <div className="relative h-screen w-screen bg-slate-50 overflow-hidden">
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
          <div className="w-72 border-r border-slate-200 bg-white/95 backdrop-blur px-4 py-5 shadow-xl transition-all flex flex-col overflow-hidden">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Panel</p>
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
                  <span className="rounded-full bg-slate-900/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
                    11 tools
                  </span>
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
                          className={`relative h-28 w-32 rounded-xl bg-gradient-to-br ${tool.gradient} ring-1 ring-inset ${tool.ring} shadow-sm transition duration-200 group-hover:shadow-md group-hover:-translate-y-0.5`}
                          aria-label={tool.name}
                          style={{ clipPath: "polygon(16% 0%, 84% 0%, 100% 100%, 0 100%)" }}
                        >
                          <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                            <span className={`inline-flex items-center rounded-full ${tool.accent} px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm ring-1 ring-inset ring-white/40`}>
                              Tool
                            </span>
                          </div>
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-3 text-center">
                            <div className="h-8 w-8 rounded-full bg-white/80 ring-1 ring-slate-200 shadow-sm shadow-slate-200/60 flex items-center justify-center">
                              <span className={`h-2 w-2 rounded-full ${tool.accent}`} />
                            </div>
                            <p className="text-sm font-semibold text-slate-900">{tool.name}</p>
                            <p className="text-[11px] text-slate-600">{tool.tagline}</p>
                          </div>
                          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
                            <div className={`h-2 w-12 rounded-full bg-white/80 ring-1 ring-inset ${tool.ring}`} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activePanel === "settings" && (
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <p className="text-xs uppercase tracking-wide text-slate-500">Workspace</p>
                <p>Adjust canvas options here later. Reset view is under Operations for now.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <main className="relative z-0 h-full w-full">
        <div
          ref={containerRef}
          className="absolute inset-0"
          style={{ touchAction: "none" }}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
        >
          <Background transform={transform} />
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
            onPointerDown={handleCanvasPointerDown}
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
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{block.name}</p>
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
                    >
                      <HandleDot />
                    </div>
                  ))}
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
                    <div className="absolute inset-0 rounded-lg bg-white/90 border border-slate-200 shadow-sm transition-all duration-150 pointer-events-none" />
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
                    data-connector
                    onPointerDown={startLinkingFromOutput({ type: "tool", id: tool.id, port: 0 })}
                    onPointerDownCapture={startLinkingFromOutput({ type: "tool", id: tool.id, port: 0 })}
                    onPointerEnter={handleOutputEnter({ type: "tool", id: tool.id, port: 0 })}
                    onPointerLeave={handleOutputLeave({ type: "tool", id: tool.id, port: 0 })}
                    onPointerMove={moveLinking}
                    onPointerUp={() => finalizeLinking()}
                  >
                    <HandleDot />
                  </div>
                    <div
                      className={`absolute flex h-8 w-8 items-center justify-center transition-all duration-150 z-10 ${
                        showHandles ? "opacity-100 scale-100" : "opacity-0 scale-75"
                      }`}
                      style={{ top: handles.input.y - tool.y - 6, left: -6, pointerEvents: "auto" }}
                      data-input
                      data-connector
                      onPointerEnter={handleInputEnter({ type: "tool", id: tool.id })}
                      onPointerLeave={handleInputLeave({ type: "tool", id: tool.id })}
                      onPointerDown={startLinkingFromInput({ type: "tool", id: tool.id })}
                      onPointerUp={() =>
                        finalizeLinking({
                          type: "tool",
                          id: tool.id,
                        })
                      }
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
              <div className="p-6 bg-white/80 border rounded shadow-sm">
                <h2 className="text-lg font-semibold">Canvas Area</h2>
                <p className="test-sm text-slate-600">build your flow here.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

import {
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
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
};

type Connection = {
  id: string;
  from:
    | { type: "block"; id: string; port: "A" | "B" }
    | { type: "operation"; id: string; port: number };
  to: { type: "block" | "operation"; id: string; inputIndex?: number };
};

type LinkSource = Connection["from"];
type LinkTarget = Connection["to"];

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
  | null;

export default function App() {
  const { containerRef, transform, reset } = usePanZoom({
    initial: { x: 0, y: 0, zoom: 1 },
    shouldAllowPan: (event) => {
      const target = event.target as HTMLElement | null;
      return !target?.closest("[data-note],[data-block],[data-operation]");
    },
  });
  const [activePanel, setActivePanel] = useState<
    "blocks" | "operations" | "settings" | null
  >("blocks");
  const [notes, setNotes] = useState<Note[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [blocks, setBlocks] = useState<AgentBlock[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [linking, setLinking] = useState<{
    from: LinkSource;
    current: { x: number; y: number };
  } | null>(null);
  const [hoveredInput, setHoveredInput] = useState<{
    type: "block" | "operation";
    id: string;
    inputIndex?: number;
  } | null>(null);
  const nextIdRef = useRef(1);
  const nextOperationIdRef = useRef(1);
  const nextBlockIdRef = useRef(1);
  const nextConnectionIdRef = useRef(1);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const operationDragOffsetRef = useRef({ x: 0, y: 0 });
  const blockDragOffsetRef = useRef({ x: 0, y: 0 });
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const [draggingOperationId, setDraggingOperationId] = useState<string | null>(null);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selection>(null);
  const [hoveredOperationId, setHoveredOperationId] = useState<string | null>(null);

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
      try {
        const parsed = payloadRaw ? JSON.parse(payloadRaw) : null;
        payloadType = parsed?.type ?? null;
        payloadKind = parsed?.kind ?? null;
      } catch {
        // ignore JSON parse errors, fall back to plain text matching
      }

      if (!payloadType && payloadRaw?.includes("sticky-note")) payloadType = "sticky-note";
      if (!payloadType && payloadRaw?.includes("agent-block")) payloadType = "agent-block";
      if (!payloadType && payloadRaw?.includes("operation")) payloadType = "operation";
      if (payloadType === "operation" && !payloadKind) {
        if (payloadRaw?.includes("branch")) payloadKind = "branch";
        else if (payloadRaw?.includes("sequential")) payloadKind = "sequential";
        else if (payloadRaw?.includes("aggregate")) payloadKind = "aggregate";
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
          },
        ]);
      }
    },
    [containerRef, transform.x, transform.y, transform.zoom],
  );

  const getBlockHandles = useCallback(
    (block: AgentBlock) => {
      const isActive =
        (selected?.type === "block" && selected.id === block.id) || draggingBlockId === block.id;
      const width = isActive ? 256 : 192;
      const height = isActive ? 140 : 96;
      // positions aligned to the visual handle placements:
      // input handle sits centered vertically with slight offset for its own size (h-8 top-1/2)
      const input = { x: block.x, y: block.y + height / 2 + 16 };
      // outputs sit near top/bottom corners (-right-4 top-4 / bottom-4)
      const outputA = { x: block.x + width, y: block.y + 32 };
      const outputB = { x: block.x + width, y: block.y + height - 8 };
      return { width, height, input, outputA, outputB, isActive };
    },
    [draggingBlockId, selected],
  );

  const getOperationHandles = useCallback(
    (operation: Operation) => {
      const width = 260;
      const baseHeight = 76;
      const isAggregate = operation.kind === "aggregate";
      const isBranch = operation.kind === "branch";
      const inputSlots = isAggregate ? 5 : 1;
      const outputSlots = isBranch ? 5 : 1;
      const topPadding = 16;
      const maxSlots = Math.max(inputSlots, outputSlots);
      const slotGap = 24;
      const height =
        maxSlots > 1
          ? Math.max(baseHeight, topPadding * 2 + slotGap * (maxSlots - 1))
          : baseHeight;

      const buildAnchors = (count: number, side: "left" | "right") => {
        if (count <= 1) {
          return [
            {
              x: side === "left" ? operation.x : operation.x + width,
              y: operation.y + height / 2,
            },
          ];
        }
        const gap = (height - topPadding * 2) / (count - 1);
        return Array.from({ length: count }, (_, idx) => ({
          x: side === "left" ? operation.x : operation.x + width,
          y: operation.y + topPadding + idx * gap,
        }));
      };

      const inputAnchors = buildAnchors(inputSlots, "left");
      const outputAnchors = buildAnchors(outputSlots, "right");
      return { width, height, inputAnchors, outputAnchors, isAggregate, isBranch };
    },
    [],
  );

  const getOutputAnchor = useCallback(
    (endpoint: LinkSource) => {
      if (endpoint.type === "block") {
        const block = blocks.find((b) => b.id === endpoint.id);
        if (!block) return null;
        const handles = getBlockHandles(block);
        return endpoint.port === "A" ? handles.outputA : handles.outputB;
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
    [blocks, getBlockHandles, getOperationHandles, operations],
  );

  const getInputAnchor = useCallback(
    (target: LinkTarget) => {
      if (target.type === "block") {
        const block = blocks.find((b) => b.id === target.id);
        if (!block) return null;
        const handles = getBlockHandles(block);
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
    [blocks, getBlockHandles, getOperationHandles, operations],
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

  const handleInputEnter = useCallback(
    (target: { type: "block" | "operation"; id: string; inputIndex?: number }) => () => {
      if (linking) setHoveredInput(target);
    },
    [linking],
  );

  const handleInputLeave = useCallback(
    (target: { type: "block" | "operation"; id: string; inputIndex?: number }) => () => {
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

  const startLinkingFromOutput = useCallback(
    (from: LinkSource) =>
      (event: ReactPointerEvent<HTMLButtonElement | HTMLDivElement>) => {
        event.stopPropagation();
        event.preventDefault();
        const anchor =
          from.type === "block"
            ? (() => {
                const block = blocks.find((b) => b.id === from.id);
                if (!block) return null;
                const handles = getBlockHandles(block);
                return from.port === "A" ? handles.outputA : handles.outputB;
              })()
            : (() => {
                const operation = operations.find((op) => op.id === from.id);
                if (!operation) return null;
                const handles = getOperationHandles(operation);
                const index = Math.min(
                  handles.outputAnchors.length - 1,
                  Math.max(0, from.port),
                );
                return handles.outputAnchors[index];
              })();
        if (!anchor) return;
        setLinking({ from, current: anchor });
        setSelected({ type: from.type, id: from.id });
      },
    [blocks, getBlockHandles, operations, getOperationHandles],
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

  const finalizeLinking = useCallback(() => {
    if (!linking) return;
    const target = hoveredInput;
    const from = linking.from;
    if (
      target &&
      !(target.type === from.type && target.id === from.id)
    ) {
      const id = nextConnectionIdRef.current++;
      setConnections((prev) => [
        // enforce single connection per target slot (block input or specific operation input)
        ...prev.filter(
          (conn) =>
            !(
              conn.to.type === target.type &&
              conn.to.id === target.id &&
              (conn.to.inputIndex ?? null) === (target.inputIndex ?? null)
            ),
        ),
        { id: `conn-${id}`, from, to: target },
      ]);
    }
    setLinking(null);
    setHoveredInput(null);
  }, [hoveredInput, linking]);

  const handleCanvasPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-note],[data-block],[data-operation]")) return;
      setSelected(null);
      setHoveredInput(null);
      setLinking(null);
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
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleRemoveBlock, handleRemoveNote, handleRemoveOperation, selected]);

  return (
    <div className="relative h-screen w-screen bg-slate-50 overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 z-30 flex">
        <div className="flex flex-col items-center gap-2 bg-slate-900/95 px-2 py-3 text-white shadow-xl">
          {[
            { id: "blocks", label: "Blocks", symbol: "[]" },
            { id: "operations", label: "Operations", symbol: "Ops" },
            { id: "settings", label: "Settings", symbol: ":" },
          ].map((item) => (
            <button
              key={item.id}
              className={`h-12 w-12 rounded-md border border-slate-700 text-sm font-semibold transition ${
                activePanel === item.id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "bg-slate-800/70 text-white hover:bg-slate-800"
              }`}
              onClick={() =>
                setActivePanel((prev) => (prev === item.id ? null : (item.id as typeof activePanel)))
              }
              aria-pressed={activePanel === item.id}
              aria-label={item.label}
            >
              {item.symbol}
            </button>
          ))}
        </div>

        {activePanel && (
          <div className="w-72 border-r border-slate-200 bg-white/95 backdrop-blur px-4 py-5 shadow-xl transition-all">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Panel</p>
                <h2 className="text-lg font-semibold text-slate-900">
                  {activePanel === "blocks"
                    ? "Blocks"
                    : activePanel === "operations"
                      ? "Operations"
                      : "Settings"}
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
              transition: "transform 120ms ease-out",
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
            <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
              {connections.map((conn) => {
                const start = getOutputAnchor(conn.from);
                const end = getInputAnchor(conn.to);
                if (!start || !end) return null;
                const curve = 80;
                const d = `M ${start.x} ${start.y} C ${start.x + curve} ${start.y} ${end.x - curve} ${end.y} ${end.x} ${end.y}`;
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
                const start = getOutputAnchor(linking.from);
                if (!start) return null;
                const end = linking.current;
                const curve = 80;
                const d = `M ${start.x} ${start.y} C ${start.x + curve} ${start.y} ${end.x - curve} ${end.y} ${end.x} ${end.y}`;
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
              const showConnections = isActive || draggingBlockId === block.id || linkingActive;
              return (
                <div key={block.id} className="absolute" style={{ left: block.x, top: block.y }}>
                  <div
                    className={`relative rounded-lg border border-slate-200 bg-white/90 shadow-md backdrop-blur-sm transition-all duration-150 ${
                      isActive ? "w-64 p-4 min-h-[140px]" : "w-48 p-3 scale-[0.97] min-h-[96px]"
                    } ${
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
                        {isActive && <p className="text-xs text-slate-600">{block.description}</p>}
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                        Agent
                      </span>
                    </div>

                    <div
                      className={`mt-4 grid grid-cols-[auto,1fr,auto] gap-3 items-center transition-all duration-150 ${
                        showConnections ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200" />
                        <span className="text-xs font-medium text-emerald-900">Input</span>
                      </div>
                    <div className="h-px bg-gradient-to-r from-emerald-200 via-emerald-100 to-transparent" />
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-xs font-medium text-slate-700">Output A</span>
                        <div
                          className="h-3 w-3 rounded-full bg-sky-500 shadow-sm shadow-sky-200"
                          data-output
                          data-port="A"
                          onPointerDown={startLinkingFromOutput({ type: "block", id: block.id, port: "A" })}
                          onPointerMove={moveLinking}
                          onPointerUp={finalizeLinking}
                        />
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-xs font-medium text-slate-700">Output B</span>
                        <div
                          className="h-3 w-3 rounded-full bg-sky-500 shadow-sm shadow-sky-200"
                          data-output
                          data-port="B"
                          onPointerDown={startLinkingFromOutput({ type: "block", id: block.id, port: "B" })}
                          onPointerMove={moveLinking}
                          onPointerUp={finalizeLinking}
                        />
                      </div>
                    </div>
                  </div>

                  {/* connection handles for visual targeting */}
                  <div
                    className={`absolute -left-4 top-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-emerald-100 transition-all duration-150 ${
                      showConnections ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"
                    } ${
                      hoveredInput?.type === "block" && hoveredInput.id === block.id
                        ? "ring-2 ring-emerald-300 shadow-emerald-100"
                        : ""
                    }`}
                    data-input
                    onPointerEnter={handleInputEnter({ type: "block", id: block.id })}
                    onPointerLeave={handleInputLeave({ type: "block", id: block.id })}
                    onPointerUp={finalizeLinking}
                  >
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  </div>
                  <div
                    className={`absolute -right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-sky-100 transition-all duration-150 ${
                      showConnections ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"
                    }`}
                    data-output
                    data-port="A"
                    onPointerDown={startLinkingFromOutput({ type: "block", id: block.id, port: "A" })}
                    onPointerMove={moveLinking}
                    onPointerUp={finalizeLinking}
                  >
                    <div className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                  </div>
                  <div
                    className={`absolute -right-4 bottom-4 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-sky-100 transition-all duration-150 ${
                      showConnections ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"
                    }`}
                    data-output
                    data-port="B"
                    onPointerDown={startLinkingFromOutput({ type: "block", id: block.id, port: "B" })}
                    onPointerMove={moveLinking}
                    onPointerUp={finalizeLinking}
                  >
                    <div className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                  </div>
                </div>
              </div>
              );
            })}
            {operations.map((operation) => {
              const meta = operationMeta[operation.kind];
              const isActive =
                selected?.type === "operation" && selected.id === operation.id;
              const isDragging = draggingOperationId === operation.id;
              const linkingFromThis =
                linking?.from.type === "operation" && linking.from.id === operation.id;
              const handles = getOperationHandles(operation);
              const isLinkingNear = (() => {
                if (!linking) return false;
                const cx = operation.x + handles.width / 2;
                const cy = operation.y + handles.height / 2;
                const dist = Math.hypot(linking.current.x - cx, linking.current.y - cy);
                return dist < 140;
              })();
              const showHandles =
                hoveredOperationId === operation.id || isDragging || linkingFromThis || isLinkingNear;
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
                        className={`absolute -left-4 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-emerald-100 transition-all duration-150 ${
                          showHandles ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"
                        } ${
                          hoveredInput?.type === "operation" &&
                          hoveredInput.id === operation.id &&
                          (hoveredInput.inputIndex ?? 0) === idx
                            ? "ring-2 ring-emerald-300 shadow-emerald-100"
                            : ""
                        }`}
                        style={{ top: anchor.y - operation.y - 4 }}
                        data-input
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
                        onPointerUp={finalizeLinking}
                      >
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      </div>
                    ))}
                    {handles.outputAnchors.map((anchor, idx) => (
                      <div
                        key={idx}
                        className={`absolute -right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-sky-100 transition-all duration-150 ${
                          showHandles ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"
                        }`}
                        style={{ top: anchor.y - operation.y - 4 }}
                        data-output
                        onPointerDown={startLinkingFromOutput({
                          type: "operation",
                          id: operation.id,
                          port: idx,
                        })}
                        onPointerMove={moveLinking}
                        onPointerUp={finalizeLinking}
                      >
                        <div className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                      </div>
                    ))}
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

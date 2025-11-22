import {
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
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
  from: { blockId: string; port: "A" | "B" };
  to: { blockId: string };
};

type Selection =
  | { type: "note"; id: string }
  | { type: "block"; id: string }
  | null;

export default function App() {
  const { containerRef, transform, reset } = usePanZoom({
    initial: { x: 0, y: 0, zoom: 1 },
    shouldAllowPan: (event) => {
      const target = event.target as HTMLElement | null;
      return !target?.closest("[data-note],[data-block]");
    },
  });
  const [activePanel, setActivePanel] = useState<"blocks" | "notes" | "settings" | null>(
    "blocks",
  );
  const [notes, setNotes] = useState<Note[]>([]);
  const [blocks, setBlocks] = useState<AgentBlock[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [linking, setLinking] = useState<{
    from: { blockId: string; port: "A" | "B" };
    current: { x: number; y: number };
  } | null>(null);
  const [hoveredInput, setHoveredInput] = useState<string | null>(null);
  const nextIdRef = useRef(1);
  const nextBlockIdRef = useRef(1);
  const nextConnectionIdRef = useRef(1);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const blockDragOffsetRef = useRef({ x: 0, y: 0 });
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selection>(null);

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

  const handleNoteDragStart = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(
      "application/json",
      JSON.stringify({ type: "sticky-note" }),
    );
    // text/plain fallback for simpler drop handlers
    event.dataTransfer.setData("text/plain", "sticky-note");
  }, []);

  const handleBlockDragStart = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(
      "application/json",
      JSON.stringify({ type: "agent-block" }),
    );
    event.dataTransfer.setData("text/plain", "agent-block");
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
      try {
        const parsed = payloadRaw ? JSON.parse(payloadRaw) : null;
        payloadType = parsed?.type ?? null;
      } catch {
        // ignore JSON parse errors, fall back to plain text matching
      }

      if (!payloadType && payloadRaw?.includes("sticky-note")) payloadType = "sticky-note";
      if (!payloadType && payloadRaw?.includes("agent-block")) payloadType = "agent-block";
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
        prev.filter((conn) => conn.from.blockId !== blockId && conn.to.blockId !== blockId),
      );
    },
    [draggingBlockId, selected],
  );

  const handleInputEnter = useCallback(
    (blockId: string) => () => {
      if (linking) setHoveredInput(blockId);
    },
    [linking],
  );

  const handleInputLeave = useCallback(
    (blockId: string) => () => {
      if (hoveredInput === blockId) setHoveredInput(null);
    },
    [hoveredInput],
  );

  const startLinkingFromOutput = useCallback(
    (blockId: string, port: "A" | "B") =>
      (event: ReactPointerEvent<HTMLButtonElement | HTMLDivElement>) => {
        event.stopPropagation();
        event.preventDefault();
        const block = blocks.find((b) => b.id === blockId);
        if (!block) return;
        const handles = getBlockHandles(block);
        const anchor = port === "A" ? handles.outputA : handles.outputB;
        setLinking({ from: { blockId, port }, current: anchor });
        setSelected({ type: "block", id: blockId });
      },
    [blocks, getBlockHandles],
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
    const targetId = hoveredInput;
    const from = linking.from;
    if (targetId && targetId !== from.blockId) {
      const id = nextConnectionIdRef.current++;
      setConnections((prev) => [
        // enforce single input: drop any existing connection into this target
        ...prev.filter((conn) => conn.to.blockId !== targetId),
        { id: `conn-${id}`, from, to: { blockId: targetId } },
      ]);
    }
    setLinking(null);
    setHoveredInput(null);
  }, [hoveredInput, linking]);

  const handleCanvasPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-note],[data-block]")) return;
      setSelected(null);
      setHoveredInput(null);
      setLinking(null);
    },
    [],
  );

  return (
    <div className="relative h-screen w-screen bg-slate-50 overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 z-30 flex">
        <div className="flex flex-col items-center gap-2 bg-slate-900/95 px-2 py-3 text-white shadow-xl">
          {[
            { id: "blocks", label: "Blocks", symbol: "[]" },
            { id: "notes", label: "Notes", symbol: "N" },
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
                    : activePanel === "notes"
                      ? "Notes"
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

            {activePanel === "notes" && (
              <div className="mt-4 space-y-3">
                <div
                  className="cursor-grab rounded border border-yellow-200 bg-yellow-100 px-3 py-2 text-sm font-medium text-slate-800 shadow-sm active:cursor-grabbing"
                  draggable
                  onDragStart={handleNoteDragStart}
                >
                  Sticky Note
                  <div className="mt-1 text-xs text-slate-600">
                    Drag to canvas to drop a note
                  </div>
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
                <p>Adjust canvas options here later. Reset view is under Notes for now.</p>
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
                const fromBlock = blocks.find((b) => b.id === conn.from.blockId);
                const toBlock = blocks.find((b) => b.id === conn.to.blockId);
                if (!fromBlock || !toBlock) return null;
                const fromHandles = getBlockHandles(fromBlock);
                const toHandles = getBlockHandles(toBlock);
                const start =
                  conn.from.port === "A" ? fromHandles.outputA : fromHandles.outputB;
                const end = toHandles.input;
                const curve = 80;
                const d = `M ${start.x} ${start.y} C ${start.x + curve} ${start.y} ${end.x - curve} ${end.y} ${end.x} ${end.y}`;
                return (
                  <path
                    key={conn.id}
                    d={d}
                    fill="none"
                    stroke="rgba(56, 189, 248, 0.7)"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                );
              })}

              {linking && (() => {
                const fromBlock = blocks.find((b) => b.id === linking.from.blockId);
                if (!fromBlock) return null;
                const fromHandles = getBlockHandles(fromBlock);
                const start =
                  linking.from.port === "A" ? fromHandles.outputA : fromHandles.outputB;
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
                          onPointerDown={startLinkingFromOutput(block.id, "A")}
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
                          onPointerDown={startLinkingFromOutput(block.id, "B")}
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
                    } ${hoveredInput === block.id ? "ring-2 ring-emerald-300 shadow-emerald-100" : ""}`}
                    data-input
                    onPointerEnter={handleInputEnter(block.id)}
                    onPointerLeave={handleInputLeave(block.id)}
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
                    onPointerDown={startLinkingFromOutput(block.id, "A")}
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
                    onPointerDown={startLinkingFromOutput(block.id, "B")}
                    onPointerMove={moveLinking}
                    onPointerUp={finalizeLinking}
                  >
                    <div className="h-2.5 w-2.5 rounded-full bg-sky-500" />
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

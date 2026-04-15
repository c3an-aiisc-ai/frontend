import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNodeHandles } from "../../hooks/useNodeHandles";
import { AGENT_BLOCK_BASE_HEIGHT, TOOL_PORT_OFFSET } from "../../shared/constants";
import { iconPaths } from "../../shared/assets";
import { hydrateWorkflowFromPlan } from "../../shared/planning/handleIO";
import { clamp } from "../../shared/utils";
import type {
  AgentBlock as AgentBlockType,
  AnchorPoint,
  Connection,
  ToolNode as ToolNodeType,
} from "../../shared/types";
import type { PlanningBlock } from "../../shared/types/planning";
import ConnectionLines from "./ConnectionLines";

type Props = {
  panelId: string;
  plan: PlanningBlock;
  anchorRect: DOMRect;
  triggerElement: HTMLButtonElement | null;
  onClose: () => void;
};

type Placement = "right" | "bottom";
type PanelPosition = { left: number; top: number };
type DragState = { offsetX: number; offsetY: number } | null;

const VIEWPORT_MARGIN = 16;
const PANEL_GAP = 24;
const RIGHT_PLACEMENT_X_OFFSET = 140;
const PANEL_WIDTH = 420;
const PANEL_MIN_HEIGHT = 240;
const SNAPSHOT_PADDING = 28;
const SNAPSHOT_TARGET_SCALE = 0.76;

function getBlockMode(blockId: string, connections: Connection[]): "aggregate" | "branch" | "sequential" | null {
  const inboundSources = new Set(
    connections
      .filter(
        (connection) =>
          connection.from.type === "block" &&
          connection.to.type === "block" &&
          connection.to.id === blockId &&
          (connection.to.inputIndex ?? 0) < TOOL_PORT_OFFSET
      )
      .map((connection) => connection.from.id)
  );
  const outboundTargets = new Set(
    connections
      .filter((connection) => connection.from.type === "block" && connection.from.id === blockId)
      .map((connection) => connection.to.id)
  );
  if (inboundSources.size > 1) return "aggregate";
  if (outboundTargets.size > 1) return "branch";
  if (outboundTargets.size > 0) return "sequential";
  return null;
}

function getToolIdsConnectedToBlock(blockId: string, connections: Connection[]): Set<string> {
  const directToolIds = connections
    .filter(
      (connection) =>
        connection.from.type === "tool" &&
        connection.to.type === "block" &&
        connection.to.id === blockId &&
        (connection.to.inputIndex ?? 0) >= TOOL_PORT_OFFSET
    )
    .map((connection) => connection.from.id);

  if (directToolIds.length === 0) return new Set();

  const incomingByToolId = new Map<string, Set<string>>();
  connections.forEach((connection) => {
    if (connection.from.type !== "tool" || connection.to.type !== "tool") return;
    const incoming = incomingByToolId.get(connection.to.id);
    if (incoming) incoming.add(connection.from.id);
    else incomingByToolId.set(connection.to.id, new Set([connection.from.id]));
  });

  const seen = new Set<string>();
  const stack = [...directToolIds];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    const upstream = incomingByToolId.get(current);
    upstream?.forEach((toolId) => {
      if (!seen.has(toolId)) stack.push(toolId);
    });
  }

  return seen;
}

type PreparedSnapshot = {
  blocks: AgentBlockType[];
  tools: ToolNodeType[];
  connections: Connection[];
  width: number;
  height: number;
};

export default function SubplanAgentsPanel({
  panelId,
  plan,
  anchorRect,
  triggerElement,
  onClose,
}: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = `${panelId}-title`;
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window === "undefined" ? 1280 : window.innerWidth,
    height: typeof window === "undefined" ? 900 : window.innerHeight,
  }));
  const [dragPosition, setDragPosition] = useState<PanelPosition | null>(null);
  const [dragState, setDragState] = useState<DragState>(null);

  const snapshot = useMemo(() => {
    if (plan.workflow) {
      return {
        blocks: plan.workflow.blocks ?? [],
        tools: plan.workflow.tools ?? [],
        connections: plan.workflow.connections ?? [],
      };
    }
    return hydrateWorkflowFromPlan(plan);
  }, [plan]);

  const { getBlockHandles, getToolHandles } = useNodeHandles({
    connections: snapshot.connections,
    linking: null,
    hoveredBlockId: null,
  });

  const preparedSnapshot = useMemo<PreparedSnapshot>(() => {
    const hasNodes = snapshot.blocks.length > 0 || snapshot.tools.length > 0;
    if (!hasNodes) {
      return {
        blocks: [],
        tools: [],
        connections: snapshot.connections,
        width: 320,
        height: 180,
      };
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    snapshot.blocks.forEach((block) => {
      const handles = getBlockHandles(block);
      minX = Math.min(minX, block.x);
      minY = Math.min(minY, block.y);
      maxX = Math.max(maxX, block.x + handles.width);
      maxY = Math.max(maxY, block.y + handles.height);
    });

    snapshot.tools.forEach((tool) => {
      const handles = getToolHandles(tool);
      minX = Math.min(minX, tool.x);
      minY = Math.min(minY, tool.y);
      maxX = Math.max(maxX, tool.x + handles.width);
      maxY = Math.max(maxY, tool.y + handles.height);
    });

    const offsetX = SNAPSHOT_PADDING - minX;
    const offsetY = SNAPSHOT_PADDING - minY;

    return {
      blocks: snapshot.blocks.map((block) => ({
        ...block,
        x: block.x + offsetX,
        y: block.y + offsetY,
      })),
      tools: snapshot.tools.map((tool) => ({
        ...tool,
        x: tool.x + offsetX,
        y: tool.y + offsetY,
      })),
      connections: snapshot.connections,
      width: Math.max(320, maxX - minX + SNAPSHOT_PADDING * 2),
      height: Math.max(180, maxY - minY + SNAPSHOT_PADDING * 2),
    };
  }, [getBlockHandles, getToolHandles, snapshot.blocks, snapshot.connections, snapshot.tools]);

  const blockById = useMemo(
    () => new Map(preparedSnapshot.blocks.map((block) => [block.id, block] as const)),
    [preparedSnapshot.blocks]
  );
  const toolById = useMemo(
    () => new Map(preparedSnapshot.tools.map((tool) => [tool.id, tool] as const)),
    [preparedSnapshot.tools]
  );

  const getOutputAnchor = useCallback(
    (endpoint: Connection["from"]): AnchorPoint | null => {
      if (endpoint.type === "block") {
        const block = blockById.get(endpoint.id);
        if (!block) return null;
        const handles = getBlockHandles(block);
        return handles.outputAnchors[Math.min(endpoint.port, handles.outputAnchors.length - 1)] ?? null;
      }
      if (endpoint.type === "tool") {
        const tool = toolById.get(endpoint.id);
        if (!tool) return null;
        return getToolHandles(tool).output;
      }
      return null;
    },
    [blockById, getBlockHandles, getToolHandles, toolById]
  );

  const getInputAnchor = useCallback(
    (target: Connection["to"]): AnchorPoint | null => {
      if (target.type === "block") {
        const block = blockById.get(target.id);
        if (!block) return null;
        const handles = getBlockHandles(block);
        const inputIndex = target.inputIndex ?? 0;
        if (inputIndex >= TOOL_PORT_OFFSET) {
          return handles.toolAnchors[0]?.anchor ?? null;
        }
        return handles.inputAnchors[Math.min(inputIndex, handles.inputAnchors.length - 1)] ?? null;
      }
      if (target.type === "tool") {
        const tool = toolById.get(target.id);
        if (!tool) return null;
        return getToolHandles(tool).input;
      }
      return null;
    },
    [blockById, getBlockHandles, getToolHandles, toolById]
  );

  const panelLayout = useMemo(() => {
    const width = Math.min(PANEL_WIDTH, Math.max(260, viewportSize.width - VIEWPORT_MARGIN * 2));
    const placement: Placement =
      anchorRect.right + PANEL_GAP + width <= viewportSize.width - VIEWPORT_MARGIN ? "right" : "bottom";
    const left =
      placement === "right"
        ? clamp(
            anchorRect.right + PANEL_GAP + RIGHT_PLACEMENT_X_OFFSET,
            VIEWPORT_MARGIN,
            Math.max(VIEWPORT_MARGIN, viewportSize.width - width - VIEWPORT_MARGIN)
          )
        : clamp(
            anchorRect.left,
            VIEWPORT_MARGIN,
            Math.max(VIEWPORT_MARGIN, viewportSize.width - width - VIEWPORT_MARGIN)
          );
    const preferredTop = placement === "right" ? anchorRect.top - 72 : anchorRect.bottom + PANEL_GAP;
    const top = clamp(
      preferredTop,
      VIEWPORT_MARGIN,
      Math.max(VIEWPORT_MARGIN, viewportSize.height - VIEWPORT_MARGIN - PANEL_MIN_HEIGHT)
    );
    const maxHeight = Math.max(PANEL_MIN_HEIGHT, viewportSize.height - top - VIEWPORT_MARGIN);
    return {
      placement,
      left,
      top,
      width,
      maxHeight,
      style: {
        left,
        top,
        width,
        maxHeight,
      } satisfies React.CSSProperties,
    };
  }, [anchorRect, viewportSize.height, viewportSize.width]);

  const snapshotScale = useMemo(() => {
    const availableWidth = Math.max(220, panelLayout.width - 28);
    return Math.min(SNAPSHOT_TARGET_SCALE, availableWidth / preparedSnapshot.width, 1);
  }, [panelLayout.width, preparedSnapshot.width]);

  const scaledSnapshotWidth = preparedSnapshot.width * snapshotScale;
  const scaledSnapshotHeight = preparedSnapshot.height * snapshotScale;
  const activePosition = dragPosition ?? { left: panelLayout.left, top: panelLayout.top };
  const panelStyle = useMemo(
    () => ({
      left: activePosition.left,
      top: activePosition.top,
      width: panelLayout.width,
      maxHeight: panelLayout.maxHeight,
    }),
    [activePosition.left, activePosition.top, panelLayout.maxHeight, panelLayout.width]
  );

  useEffect(() => {
    const handleResize = () => {
      const nextViewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };
      setViewportSize(nextViewport);
      setDragPosition((prev) => {
        if (!prev || !panelRef.current) return prev;
        const nextLeft = clamp(
          prev.left,
          VIEWPORT_MARGIN,
          Math.max(VIEWPORT_MARGIN, nextViewport.width - panelRef.current.offsetWidth - VIEWPORT_MARGIN)
        );
        const nextTop = clamp(
          prev.top,
          VIEWPORT_MARGIN,
          Math.max(VIEWPORT_MARGIN, nextViewport.height - panelRef.current.offsetHeight - VIEWPORT_MARGIN)
        );
        if (nextLeft === prev.left && nextTop === prev.top) return prev;
        return { left: nextLeft, top: nextTop };
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (panelRef.current?.contains(target)) return;
      if (triggerElement?.contains(target)) return;
      onClose();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onClose, triggerElement]);

  useEffect(() => {
    if (!dragState) return;
    const handlePointerMove = (event: PointerEvent) => {
      const panelWidth = panelRef.current?.offsetWidth ?? panelLayout.width;
      const panelHeight = panelRef.current?.offsetHeight ?? panelLayout.maxHeight;
      const nextLeft = clamp(
        event.clientX - dragState.offsetX,
        VIEWPORT_MARGIN,
        Math.max(VIEWPORT_MARGIN, viewportSize.width - panelWidth - VIEWPORT_MARGIN)
      );
      const nextTop = clamp(
        event.clientY - dragState.offsetY,
        VIEWPORT_MARGIN,
        Math.max(VIEWPORT_MARGIN, viewportSize.height - panelHeight - VIEWPORT_MARGIN)
      );
      setDragPosition({ left: nextLeft, top: nextTop });
    };
    const handlePointerUp = () => {
      setDragState(null);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState, panelLayout.maxHeight, panelLayout.width, viewportSize.height, viewportSize.width]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      id={panelId}
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
      data-placement={panelLayout.placement}
      className="subplan-agents-panel fixed z-40 flex flex-col gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-2xl outline-none"
      style={panelStyle}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        onClose();
      }}
    >
      <div
        className={`flex items-start justify-between gap-3 select-none ${
          dragState ? "cursor-grabbing" : "cursor-grab"
        }`}
        data-drag-handle
        onPointerDown={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest("button")) return;
          setDragState({
            offsetX: event.clientX - activePosition.left,
            offsetY: event.clientY - activePosition.top,
          });
        }}
      >
        <div className="min-w-0">
          <p className="label-xs">Child agents</p>
          <h2 id={titleId} className="mt-1 text-[13px] font-semibold text-slate-900">
            {plan.name}
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
            {plan.query || "Agent and tool snapshot for this subplan."}
          </p>
        </div>

        <button
          type="button"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
          onClick={onClose}
          aria-label="Close agents panel"
        >
          <img src={iconPaths.close} alt="" className="h-3.5 w-3.5" draggable={false} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-slate-700">
        <span className="badge-tight bg-emerald-50 text-emerald-700">{preparedSnapshot.blocks.length} agents</span>
        <span className="badge-tight bg-sky-50 text-sky-700">{preparedSnapshot.tools.length} tools</span>
      </div>

      <div
        className="flex-1 min-h-0 overflow-auto rounded-xl border border-slate-200 bg-slate-50/80 p-1.5"
        style={{ maxHeight: "min(62vh, 100%)" }}
      >
        {preparedSnapshot.blocks.length === 0 ? (
          <div className="empty-state px-4 py-6 text-sm text-slate-600">
            No child agents are available for this subplan yet.
          </div>
        ) : (
          <div
            className="relative"
            style={{
              width: scaledSnapshotWidth,
              height: scaledSnapshotHeight,
              minWidth: "100%",
            }}
          >
            <div
              className="absolute left-0 top-0 origin-top-left"
              style={{
                width: preparedSnapshot.width,
                height: preparedSnapshot.height,
                transform: `scale(${snapshotScale})`,
              }}
            >
              <ConnectionLines
                connections={preparedSnapshot.connections}
                linking={null}
                selected={null}
                getOutputAnchor={getOutputAnchor}
                getInputAnchor={getInputAnchor}
                onConnectionPointerDown={() => () => {}}
              />

              {preparedSnapshot.blocks.map((block) => {
                const handles = getBlockHandles(block);
                const toolCount = getToolIdsConnectedToBlock(block.id, preparedSnapshot.connections).size;
                const mode = getBlockMode(block.id, preparedSnapshot.connections);
                return (
                  <div
                    key={block.id}
                    className="canvas-agent-card absolute cursor-default px-2.5 pt-2 pb-2.5 active:cursor-default"
                    style={{
                      left: block.x,
                      top: block.y,
                      width: handles.width,
                      height: handles.height,
                      minHeight: AGENT_BLOCK_BASE_HEIGHT,
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold leading-snug text-slate-900">
                          {block.name}
                        </p>
                        {mode && (
                          <p className="text-[11px] leading-snug text-slate-600">
                            Mode: {mode}
                          </p>
                        )}
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-700">
                        Agent
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-slate-700">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 ring-1 ring-emerald-100">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        {handles.inputAnchors.length} inputs
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 ring-1 ring-sky-100">
                        <span className="h-2 w-2 rounded-full bg-sky-500" />
                        {handles.outputAnchors.length} outputs
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 ring-1 ring-indigo-100">
                        <span className="h-2 w-2 rounded-full bg-indigo-500" />
                        {toolCount} tools
                      </span>
                    </div>
                  </div>
                );
              })}

              {preparedSnapshot.tools.map((tool) => {
                const handles = getToolHandles(tool);
                return (
                  <div
                    key={tool.id}
                    className="canvas-tool-shell absolute cursor-default active:cursor-default"
                    style={{ left: tool.x, top: tool.y, width: handles.width, height: handles.height }}
                  >
                    <div className={`canvas-tool-bg ${tool.gradient} ${tool.ring}`} />
                    <div className="canvas-tool-content">
                      <span
                        className="pill-tag pill-tag-sky pointer-events-none absolute left-2 top-2 px-2 py-0.5 text-[9px]"
                        aria-hidden="true"
                      >
                        Tool
                      </span>
                      <p className="text-base font-semibold text-slate-900">{tool.name}</p>
                      {tool.tagline ? (
                        <p className="text-xs leading-snug text-slate-600">{tool.tagline}</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

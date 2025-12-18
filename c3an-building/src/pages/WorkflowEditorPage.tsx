// =============================================================================
// Workflow Editor Page - Main canvas page component
// =============================================================================

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
import { Background } from "../components";
import { Sidebar } from "../components/side_panel";
import { Toolbar, ConnectionLines } from "../components/ui";
import {
  AgentBlock,
  ToolNode,
  PlanningCanvas,
} from "../components/canvas";
import {
  BlockDetailsModal,
  ToolDetailsModal,
  EvalsModal,
} from "../components/modals";
import { usePanZoom, useWorkspace } from "../hooks";
import {
  AGENT_PRESETS,
  TOOL_PALETTE,
  EVAL_OPTIONS,
  MIN_IO,
  MAX_IO,
  TOOL_PORT_OFFSET,
} from "../constants";
import {
  clamp,
  clampNames,
  countOperators,
  downloadWorkflow,
  resizeRequired,
} from "../utils";
import { detectWorkflowType } from "../utils/detectWorkflowType";
import { exportAgentViewPlanJson, hydrateWorkflowFromPlan, importAgentViewPlanJson } from "../components/io_streams/handleIO";
import { parsePlanningJSON } from "../planning/parsePlan";
import { inferTripleOpsByDegree } from "../planning/planOps";
import type { PlanningBlock } from "../types/planning";
import type {
  AgentBlock as AgentBlockType,
  AnchorPoint,
  BlockHandles,
  Connection,
  LinkSource,
  LinkTarget,
  Selection,
  ToolHandles,
} from "../types";

export default function WorkflowEditorPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Agent-view-only IO: when the user uploads a plan JSON while in agent view,
  // we keep the original payload as a template so download keeps the same schema.
  const agentPlanTemplateRef = useRef<unknown | null>(null);

  const [uploadedPlan, setUploadedPlan] = useState<PlanningBlock | null>(null);
  const [showPlanningView, setShowPlanningView] = useState(false);
  const [plans, setPlans] = useState<PlanningBlock[]>([]);
  const [planConnections, setPlanConnections] = useState<{ from: string; to: string }[]>([]);
  const [linkingPlanId, setLinkingPlanId] = useState<string | null>(null);
  const [linkingPlanPoint, setLinkingPlanPoint] = useState<{ x: number; y: number } | null>(null);

  const handleRemovePlan = useCallback((id: string) => {
    setPlans((prev) => prev.filter((p) => p.id !== id));
    setPlanConnections((prev) => prev.filter((c) => c.from !== id && c.to !== id));
    if (linkingPlanId === id) setLinkingPlanId(null);
    if (linkingPlanPoint) setLinkingPlanPoint(null);
  }, [linkingPlanId]);

  const {
    blocks,
    setBlocks,
    tools,
    setTools,
    connections,
    setConnections,
    theme,
    setTheme,
    setUserThemeLocked,
    selectedEvals,
    setSelectedEvals,
    clipboard,
    setClipboard,
    selected,
    setSelected,
    activePanel,
    setActivePanel,
    linking,
    setLinking,
    linkingRef,
    hoveredInput,
    setHoveredInput,
    hoveredOutput,
    setHoveredOutput,
    hoveredBlockId,
    setHoveredBlockId,
    hoveredToolId,
    setHoveredToolId,
    draggingBlockId,
    setDraggingBlockId,
    draggingToolId,
    setDraggingToolId,
    blockDragOffsetRef,
    toolDragOffsetRef,
    modalBlockId,
    setModalBlockId,
    modalToolId,
    setModalToolId,
    modalToolChoice,
    setModalToolChoice,
    showEvalsModal,
    setShowEvalsModal,
    nextBlockIdRef,
    nextToolIdRef,
    nextConnectionIdRef,
    resetWorkspace,
    recalcBlockPorts,
    getBlockMode,
  } = useWorkspace();

  const persistWorkflowIntoUploadedPlan = useCallback(() => {
    if (!uploadedPlan) return;

    const blockById = new Map(blocks.map((b) => [b.id, b] as const));

    const nameCounts = new Map<string, number>();
    for (const b of blocks) {
      nameCounts.set(b.name, (nameCounts.get(b.name) ?? 0) + 1);
    }
    const hasDuplicateNames = Array.from(nameCounts.values()).some((c) => c > 1);
    const labelFor = (blockId: string) => {
      const b = blockById.get(blockId);
      if (!b) return blockId;
      return hasDuplicateNames ? b.id : b.name;
    };

    const rawTriples = connections
      .filter((conn) => conn.from.type === "block" && conn.to.type === "block")
      .map((conn) => ({
        from: labelFor(conn.from.id),
        to: labelFor(conn.to.id),
      }));

    const triples = inferTripleOpsByDegree(rawTriples);

    const workflow = {
      notes: [],
      blocks,
      tools,
      uploads: [],
      outputs: [],
      connections,
      evals: selectedEvals,
    };

    setPlans((prev) => {
      const exists = prev.some((p) => p.id === uploadedPlan.id);
      const next = exists
        ? prev.map((p) => (p.id === uploadedPlan.id ? { ...p, triples, workflow } : p))
        : [...prev, { ...uploadedPlan, triples, workflow }];
      return next;
    });

    setUploadedPlan((prev) =>
      prev && prev.id === uploadedPlan.id ? { ...prev, triples, workflow } : prev
    );
  }, [blocks, connections, selectedEvals, tools, uploadedPlan]);

  const togglePlanningView = useCallback(() => {
    setShowPlanningView((prev) => {
      if (!prev) persistWorkflowIntoUploadedPlan();
      return !prev;
    });
  }, [persistWorkflowIntoUploadedPlan]);

  const handleC3ANClick = useCallback(() => {
    window.open("https://c3an.aiisc.ai/", "_blank", "noopener,noreferrer");
  }, []);


  const { containerRef, transform, reset } = usePanZoom({
    initial: { x: 0, y: 0, zoom: 1 },
    shouldAllowPan: (event) => {
      if (linkingRef.current) return false;
      const target = event.target as HTMLElement | null;
      return !target?.closest(
        "[data-block],[data-tool]"
      );
    },
    isPanDisabled: () => linkingRef.current,
  });

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
    [containerRef, transform.x, transform.y, transform.zoom]
  );

  const toolPalette = useMemo(() => TOOL_PALETTE, []);
  const agentPresets = useMemo(() => AGENT_PRESETS, []);
  const evalOptions = useMemo(() => EVAL_OPTIONS, []);

  const handleBlockDragStart = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("application/json", JSON.stringify({ type: "agent-block" }));
  }, []);

  const handleToolDragStart = useCallback(
    (toolName: string) => (e: DragEvent<HTMLDivElement>) => {
      e.dataTransfer.effectAllowed = "copy";
      e.dataTransfer.setData(
        "application/json",
        JSON.stringify({ type: "tool", name: toolName })
      );
    },
    []
  );

  const handleCanvasDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleCanvasDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const el = containerRef.current;
      if (!el) return;

      const payloadRaw =
        e.dataTransfer.getData("application/json") ||
        e.dataTransfer.getData("text/plain");

      let payload: { type?: string; name?: string } = {};
      try {
        payload = payloadRaw ? JSON.parse(payloadRaw) : {};
      } catch {
        // ignore
      }

      const rect = el.getBoundingClientRect();
      const world = {
        x: (e.clientX - rect.left - transform.x) / transform.zoom,
        y: (e.clientY - rect.top - transform.y) / transform.zoom,
      };

      if (showPlanningView && payload.type === "planning-block") {
        const id = `plan-${plans.length + 1}`;
        setPlans((prev) => [
          ...prev,
          {
            id,
            x: world.x,
            y: world.y,
            name: id,
            query: "Describe this plan",
            triples: [],
          },
        ]);
        return;
      }

      if (payload.type === "agent-block") {
        const preset = agentPresets[0];
        const id = nextBlockIdRef.current++;
        setBlocks((prev) => [
          ...prev,
          {
            id: `block-${id}`,
            x: world.x,
            y: world.y,
            name: preset?.name ?? "Agent Block",
            description: preset?.description ?? "Adaptive block",
            inputCount: preset?.inputCount ?? 1,
            outputCount: preset?.outputCount ?? 1,
            inputRequired: Array(preset?.inputCount ?? 1).fill(false),
            outputRequired: Array(preset?.outputCount ?? 1).fill(false),
            inputNames: [],
            outputNames: [],
            presetId: preset?.id,
          },
        ]);
      }

      if (payload.type === "tool") {
        const paletteItem = toolPalette.find((t) => t.name === payload.name);
        if (!paletteItem) return;
        const id = nextToolIdRef.current++;
        setTools((prev) => [
          ...prev,
          { ...paletteItem, id: `tool-${id}`, x: world.x, y: world.y },
        ]);
      }
    },
    [agentPresets, containerRef, nextBlockIdRef, nextToolIdRef, plans.length, setBlocks, setPlans, setTools, showPlanningView, toolPalette, transform.x, transform.y, transform.zoom]
  );

  const getBlockHandles = useCallback(
    (block: AgentBlockType): BlockHandles => {
      const width = 220;
      const baseHeight = 120;
      const baseInputs = Math.max(1, block.inputCount);
      const baseOutputs = Math.max(1, block.outputCount);

      const maxConnectedInput = connections
        .filter(
          (conn) =>
            conn.to.type === "block" &&
            conn.to.id === block.id &&
            (conn.to.inputIndex ?? -1) < TOOL_PORT_OFFSET
        )
        .reduce((max, conn) => Math.max(max, conn.to.inputIndex ?? 0), -1);

      const hasToolConnection = connections.some(
        (conn) =>
          conn.to.type === "block" &&
          conn.to.id === block.id &&
          (conn.to.inputIndex ?? -1) >= TOOL_PORT_OFFSET
      );

      const maxConnectedOutput = connections
        .filter((conn) => conn.from.type === "block" && conn.from.id === block.id)
        .reduce((max, conn) => Math.max(max, conn.from.port), -1);

      const desiredInputs = Math.max(baseInputs, maxConnectedInput + 1);
      const inputSlots = Math.min(MAX_IO, desiredInputs);

      const desiredOutputs = Math.max(baseOutputs, maxConnectedOutput + 1);
      const outputSlots = Math.min(MAX_IO, desiredOutputs);

      const hoverIsOnBottom =
        linking?.origin === "output" && linking.from.type === "tool" && hoveredBlockId === block.id;
      const toolSlots = hasToolConnection ? 1 : 1 + (hoverIsOnBottom ? 1 : 0);

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

      const buildBottomAnchors = (count: number) =>
        Array.from({ length: Math.max(1, count) }, (_, idx) => ({
          anchor: { x: block.x + width / 2 + 4, y: block.y + height, dir: "down" as const },
          slot: TOOL_PORT_OFFSET + idx,
        }));

      return {
        width,
        height,
        inputAnchors: buildAnchors(inputSlots, "left"),
        outputAnchors: buildAnchors(outputSlots, "right"),
        toolAnchors: buildBottomAnchors(toolSlots),
      };
    },
    [MAX_IO, TOOL_PORT_OFFSET, connections, hoveredBlockId, hoveredInput, linking]
  );

  const getToolHandles = useCallback(
    (tool: any): ToolHandles => {
      const width = 180;
      const height = 110;
      const output: AnchorPoint = {
        x: tool.x + width / 2,
        y: tool.y - 6,
        dir: "up",
      };
      return { width, height, output, input: output };
    },
    []
  );

  const addToolToBlock = useCallback(
    (blockId: string, toolName: string) => {
      const block = blocks.find((b) => b.id === blockId);
      const palette = toolPalette.find((t) => t.name === toolName);
      if (!block || !palette) return;

      const handles = getBlockHandles(block);
      const toolWidth = 180;
      const toolId = `tool-${nextToolIdRef.current++}`;
      const toolX = block.x + handles.width / 2 - toolWidth / 2;
      const toolY = block.y + handles.height + 60;
      const newTool = { ...palette, id: toolId, x: toolX, y: toolY };

      setTools((prev) => [...prev, newTool]);
      const connId = `conn-${nextConnectionIdRef.current++}`;
      setConnections((prev) => {
        const next: Connection[] = [
          ...prev,
          {
            id: connId,
            from: { type: "tool", id: toolId, port: 0 },
            to: { type: "block", id: blockId, inputIndex: TOOL_PORT_OFFSET },
          },
        ];
        setBlocks((state) => recalcBlockPorts(next, state));
        return next;
      });
    },
    [blocks, getBlockHandles, nextConnectionIdRef, nextToolIdRef, recalcBlockPorts, setBlocks, setConnections, setTools, toolPalette]
  );

  const applyBlockIO = useCallback(
    (blockId: string, nextInputCount: number, nextOutputCount: number) => {
      const newInputs = clamp(nextInputCount, MIN_IO, MAX_IO);
      const newOutputs = clamp(nextOutputCount, MIN_IO, MAX_IO);

      setBlocks((prev) =>
        prev.map((b) =>
          b.id === blockId
            ? {
                ...b,
                inputCount: newInputs,
                outputCount: newOutputs,
                inputRequired: resizeRequired(b.inputRequired, newInputs),
                outputRequired: resizeRequired(b.outputRequired, newOutputs),
                inputNames: clampNames(b.inputNames, newInputs),
                outputNames: clampNames(b.outputNames, newOutputs),
                presetId: "custom",
              }
            : b
        )
      );

      setConnections((prev) => {
        let next = prev.filter(
          (conn) => !(conn.from.type === "block" && conn.from.id === blockId && conn.from.port >= newOutputs)
        );
        next = next.filter((conn) => {
          if (conn.to.type === "block" && conn.to.id === blockId) {
            const idx = conn.to.inputIndex ?? 0;
            if (idx >= TOOL_PORT_OFFSET) return true;
            return idx < newInputs;
          }
          return true;
        });
        return next;
      });
    },
    [MAX_IO, MIN_IO, TOOL_PORT_OFFSET, clamp, clampNames, resizeRequired, setBlocks, setConnections]
  );

  const changeBlockInputs = useCallback(
    (blockId: string, delta: number) => {
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;
      applyBlockIO(blockId, block.inputCount + delta, block.outputCount);
    },
    [applyBlockIO, blocks]
  );

  const changeBlockOutputs = useCallback(
    (blockId: string, delta: number) => {
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;
      applyBlockIO(blockId, block.inputCount, block.outputCount + delta);
    },
    [applyBlockIO, blocks]
  );

  const getOutputAnchor = useCallback(
    (endpoint: LinkSource) => {
      if (endpoint.type === "block") {
        const block = blocks.find((b) => b.id === endpoint.id);
        if (!block) return null;
        const handles = getBlockHandles(block);
        const index = Math.min(handles.outputAnchors.length - 1, Math.max(0, endpoint.port));
        return handles.outputAnchors[index];
      }
      if (endpoint.type === "tool") {
        const tool = tools.find((t) => t.id === endpoint.id);
        return tool ? getToolHandles(tool).output : null;
      }
      return null;
    },
    [blocks, getBlockHandles, getToolHandles, tools]
  );

  const getInputAnchor = useCallback(
    (target: LinkTarget) => {
      if (target.type === "block") {
        const block = blocks.find((b) => b.id === target.id);
        if (!block) return null;
        const handles = getBlockHandles(block);
        const inputIndex = target.inputIndex ?? 0;
        const toolAnchor = handles.toolAnchors.find((item) => item.slot === inputIndex);
        if (toolAnchor) return toolAnchor.anchor;
        const boundedIndex = Math.min(handles.inputAnchors.length - 1, Math.max(0, inputIndex));
        return handles.inputAnchors[boundedIndex];
      }
      if (target.type === "tool") {
        const tool = tools.find((t) => t.id === target.id);
        return tool ? getToolHandles(tool).input : null;
      }
      return null;
    },
    [blocks, getBlockHandles, getToolHandles, tools]
  );

  const handleConnectionPointerDown = useCallback(
    (conn: Connection) => (e: ReactPointerEvent<SVGPathElement>) => {
      e.stopPropagation();
      e.preventDefault();
      const isDouble = e.detail >= 2;
      setConnections((prev) => {
        const next = prev.filter((c) => c.id !== conn.id);
        setBlocks((state) => recalcBlockPorts(next, state));
        return next;
      });

      if (isDouble) {
        const anchor = getOutputAnchor(conn.from);
        const world = toWorldPoint(e.clientX, e.clientY);
        const currentPoint = world ?? anchor ?? { x: 0, y: 0 };
        linkingRef.current = true;
        setLinking({ origin: "output", from: conn.from, current: currentPoint });
        setHoveredInput(null);
        setHoveredOutput(null);
      }
    },
    [getOutputAnchor, recalcBlockPorts, setBlocks, setConnections, setHoveredInput, setHoveredOutput, setLinking, toWorldPoint, linkingRef]
  );

  const startLinkingFromInput = useCallback(
    (target: LinkTarget) => (e: ReactPointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.preventDefault();
      if (e.detail >= 2) return;
      setHoveredInput(null);
      setHoveredOutput(null);
      const anchor = getInputAnchor(target);
      if (!anchor) return;
      linkingRef.current = true;
      setLinking({ origin: "input", target, current: anchor });
    },
    [getInputAnchor, setHoveredInput, setHoveredOutput, setLinking, linkingRef]
  );

  const startLinkingFromOutput = useCallback(
    (from: LinkSource) => (e: ReactPointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.preventDefault();
      if (e.detail >= 2) return;
      setHoveredInput(null);
      setHoveredOutput(null);

      let effectiveFrom = from;
      if (from.type === "block") {
        const ports = connections
          .filter((c) => c.from.type === "block" && c.from.id === from.id)
          .map((c) => c.from.port);
        const hasPort = ports.includes(from.port);
        const maxPort = ports.reduce((max, p) => Math.max(max, p), -1);
        const nextPort = Math.min(MAX_IO - 1, Math.max(maxPort + 1, from.port));
        if (hasPort) effectiveFrom = { ...from, port: nextPort };
      }

      const anchor = getOutputAnchor(effectiveFrom);
      if (!anchor) return;
      linkingRef.current = true;
      setLinking({ origin: "output", from: effectiveFrom, current: anchor });
    },
    [MAX_IO, connections, getOutputAnchor, setHoveredInput, setHoveredOutput, setLinking, linkingRef]
  );

  const moveLinking = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!linking) return;
      const world = toWorldPoint(e.clientX, e.clientY);
      if (!world) return;
      setLinking((prev) => (prev ? { ...prev, current: world } : prev));
    },
    [linking, setLinking, toWorldPoint]
  );

  const finalizeLinking = useCallback(
    (overrideTarget?: LinkTarget) => {
      if (!linking) return;
      const autoToolTarget =
        linking.origin === "output" &&
        linking.from.type === "tool" &&
        hoveredBlockId
          ? { type: "block" as const, id: hoveredBlockId, inputIndex: TOOL_PORT_OFFSET }
          : null;

      const target =
        overrideTarget ??
        (linking.origin === "output"
          ? linking.from.type === "tool"
            ? autoToolTarget || hoveredInput
            : hoveredInput
          : linking.target);

      const from = linking.origin === "output" ? linking.from : hoveredOutput;

      if (target && from && !(target.type === from.type && target.id === from.id)) {
        // First inbound defaults to slot 0. Additional inbound connections will
        // auto-allocate the next free input slot (0..MAX_IO-1) so you can
        // connect multiple agents into the same target block.
        const normalizedTarget: LinkTarget =
          target.type === "block" && (target.inputIndex ?? 0) < TOOL_PORT_OFFSET
            ? { ...target, inputIndex: target.inputIndex ?? 0 }
            : target;

        const isToolPortTarget =
          normalizedTarget.type === "block" && (normalizedTarget.inputIndex ?? 0) >= TOOL_PORT_OFFSET;
        if (isToolPortTarget && from.type !== "tool") {
          setLinking(null);
          linkingRef.current = false;
          return;
        }

        if (
          from.type === "tool" &&
          normalizedTarget.type === "block" &&
          (normalizedTarget.inputIndex ?? 0) < TOOL_PORT_OFFSET
        ) {
          setLinking(null);
          linkingRef.current = false;
          return;
        }

        const id = nextConnectionIdRef.current++;
        setConnections((prev) => {
          // Keep tool nodes single-attached (a tool belongs to one agent)
          const base =
            from.type === "tool"
              ? prev.filter((c) => !(c.from.type === "tool" && c.from.id === from.id))
              : prev;

          let targetSlot = normalizedTarget.inputIndex ?? 0;
          let finalTarget: LinkTarget = normalizedTarget;

          if (normalizedTarget.type === "block" && targetSlot < TOOL_PORT_OFFSET) {
            const inbound = base.filter(
              (c) =>
                c.to.type === "block" &&
                c.to.id === normalizedTarget.id &&
                (c.to.inputIndex ?? 0) < TOOL_PORT_OFFSET
            );
            const occupied = new Set(inbound.map((c) => c.to.inputIndex ?? 0));

            // First inbound always uses slot 0.
            if (inbound.length === 0) {
              targetSlot = 0;
            } else if (occupied.has(targetSlot)) {
              // Additional inbound: pick the next free slot.
              const free = Array.from({ length: MAX_IO }, (_, i) => i).find((i) => !occupied.has(i));
              if (typeof free === "number") targetSlot = free;
            }

            finalTarget = { ...normalizedTarget, inputIndex: targetSlot };
          }

          // Enforce: a single source agent cannot feed multiple inputs of the same target agent.
          // This ensures multi-input targets are driven by multiple *different* agents.
          if (
            from.type === "block" &&
            finalTarget.type === "block" &&
            (finalTarget.inputIndex ?? 0) < TOOL_PORT_OFFSET
          ) {
            const alreadyConnectedFromSameSource = base.some(
              (c) =>
                c.from.type === "block" &&
                c.from.id === from.id &&
                c.to.type === "block" &&
                c.to.id === finalTarget.id &&
                (c.to.inputIndex ?? 0) < TOOL_PORT_OFFSET
            );
            if (alreadyConnectedFromSameSource) return prev;
          }

          const isDuplicate = base.some(
            (conn) =>
              conn.from.type === from.type &&
              conn.from.id === from.id &&
              conn.from.port === from.port &&
              conn.to.type === finalTarget.type &&
              conn.to.id === finalTarget.id &&
              (conn.to.inputIndex ?? 0) === (finalTarget.inputIndex ?? 0)
          );
          if (isDuplicate) return prev;

          // Enforce a single connection per *slot* (but allow multiple slots).
          const withoutExistingTargetSlot = base.filter(
            (c) =>
              !(
                c.to.type === finalTarget.type &&
                c.to.id === finalTarget.id &&
                (c.to.inputIndex ?? 0) === (finalTarget.inputIndex ?? 0)
              )
          );

          const next = [...withoutExistingTargetSlot, { id: `conn-${id}`, from, to: finalTarget }];
          setBlocks((state) => recalcBlockPorts(next, state));
          return next;
        });
      }

      setLinking(null);
      linkingRef.current = false;
      setHoveredInput(null);
      setHoveredOutput(null);
    },
    [MAX_IO, TOOL_PORT_OFFSET, hoveredBlockId, hoveredInput, hoveredOutput, linking, nextConnectionIdRef, recalcBlockPorts, setBlocks, setConnections, setHoveredInput, setHoveredOutput, setLinking, linkingRef]
  );

  const handleCanvasPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.closest("[data-block],[data-tool],[data-connector]")
      )
        return;
      setSelected(null);
      setHoveredInput(null);
      setHoveredOutput(null);
      setHoveredBlockId(null);
      setHoveredToolId(null);
      setLinking(null);
      linkingRef.current = false;
    },
    [linkingRef, setHoveredBlockId, setHoveredInput, setHoveredOutput, setHoveredToolId, setLinking, setSelected]
  );

  const makeDragHandlers = useCallback(
    (
      type: NonNullable<Selection>["type"],
      getItem: (id: string) => { x: number; y: number } | undefined,
      setItem: (updater: (prev: any[]) => any[]) => void,
      setDragging: React.Dispatch<React.SetStateAction<string | null>>,
      offsetRef: React.MutableRefObject<{ x: number; y: number }>,
      getDraggingId: () => string | null
    ) => ({
      onPointerDown:
        (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => {
          const target = e.target as HTMLElement | null;
          if (linkingRef.current || target?.closest("[data-connector]")) return;
          const container = e.currentTarget as HTMLElement;
          const rect = container.getBoundingClientRect();
          const edgePadding = 20;
          const withinCenterArea =
            e.clientX >= rect.left + edgePadding &&
            e.clientX <= rect.right - edgePadding &&
            e.clientY >= rect.top + edgePadding &&
            e.clientY <= rect.bottom - edgePadding;
          if (!withinCenterArea) return;
          e.stopPropagation();
          e.preventDefault();
          setSelected({ type, id } as Selection);
          const item = getItem(id);
          const world = toWorldPoint(e.clientX, e.clientY);
          if (!item || !world) return;
          offsetRef.current = { x: world.x - item.x, y: world.y - item.y };
          setDragging(id);
          e.currentTarget.setPointerCapture?.(e.pointerId);
        },
      onPointerMove:
        (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => {
          if (getDraggingId() !== id) return;
          if (linkingRef.current) return;
          const world = toWorldPoint(e.clientX, e.clientY);
          if (!world) return;
          setItem((prev) =>
            prev.map((item: any) =>
              item.id === id
                ? { ...item, x: world.x - offsetRef.current.x, y: world.y - offsetRef.current.y }
                : item
            )
          );
        },
      onPointerUp:
        (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => {
          setDragging((current) => (current === id ? null : current));
          offsetRef.current = { x: 0, y: 0 };
          e.currentTarget.releasePointerCapture?.(e.pointerId);
        },
    }),
    [linkingRef, setSelected, toWorldPoint]
  );

  const blockDrag = makeDragHandlers(
    "block",
    (id) => blocks.find((b) => b.id === id),
    setBlocks,
    setDraggingBlockId,
    blockDragOffsetRef,
    () => draggingBlockId
  );
  const toolDrag = makeDragHandlers(
    "tool",
    (id) => tools.find((t) => t.id === id),
    setTools,
    setDraggingToolId,
    toolDragOffsetRef,
    () => draggingToolId
  );

  const handleRemoveBlock = useCallback(
    (id: string) => {
      setBlocks((prev) => prev.filter((b) => b.id !== id));
      setConnections((prev) => prev.filter((c) => !(c.from.type === "block" && c.from.id === id) && !(c.to.type === "block" && c.to.id === id)));
      if (selected?.type === "block" && selected.id === id) setSelected(null);
    },
    [selected, setBlocks, setConnections, setSelected]
  );

  const handleRemoveTool = useCallback(
    (id: string) => {
      setTools((prev) => prev.filter((t) => t.id !== id));
      setConnections((prev) => prev.filter((c) => !(c.from.type === "tool" && c.from.id === id) && !(c.to.type === "tool" && c.to.id === id)));
      if (selected?.type === "tool" && selected.id === id) setSelected(null);
    },
    [selected, setConnections, setSelected, setTools]
  );

  const toggleInputRequired = useCallback(
    (blockId: string, index: number) => {
      setBlocks((prev) =>
        prev.map((b) => {
          if (b.id !== blockId) return b;
          const mandatoryCount = b.mandatoryInputCount ?? 0;
          if (index < mandatoryCount) return b;
          const next = [...b.inputRequired];
          next[index] = !next[index];
          return { ...b, inputRequired: next };
        })
      );
    },
    [setBlocks]
  );

  const toggleOutputRequired = useCallback(
    (blockId: string, index: number) => {
      setBlocks((prev) =>
        prev.map((b) => {
          if (b.id !== blockId) return b;
          const mandatoryCount = b.mandatoryOutputCount ?? 0;
          if (index < mandatoryCount) return b;
          const next = [...b.outputRequired];
          next[index] = !next[index];
          return { ...b, outputRequired: next };
        })
      );
    },
    [setBlocks]
  );

  const toggleToolInputRequired = useCallback(
    (toolId: string, index: number) => {
      setTools((prev) =>
        prev.map((t) => {
          if (t.id !== toolId) return t;
          const mandatoryCount = t.mandatoryInputCount ?? 0;
          if (index < mandatoryCount) return t;
          const next = [...t.inputRequired];
          next[index] = !next[index];
          return { ...t, inputRequired: next };
        })
      );
    },
    [setTools]
  );

  const toggleToolOutputRequired = useCallback(
    (toolId: string, index: number) => {
      setTools((prev) =>
        prev.map((t) => {
          if (t.id !== toolId) return t;
          const mandatoryCount = t.mandatoryOutputCount ?? 0;
          if (index < mandatoryCount) return t;
          const next = [...t.outputRequired];
          next[index] = !next[index];
          return { ...t, outputRequired: next };
        })
      );
    },
    [setTools]
  );

  const toggleEval = useCallback(
    (evalId: string) => {
      setSelectedEvals((prev) =>
        prev.includes(evalId) ? prev.filter((id) => id !== evalId) : [...prev, evalId]
      );
    },
    [setSelectedEvals]
  );

  const handleRemoveConnection = useCallback(
    (connectionId: string) => {
      setConnections((prev) => {
        const next = prev.filter((conn) => conn.id !== connectionId);
        setBlocks((state) => recalcBlockPorts(next, state));
        return next;
      });
      setSelected((prev) => (prev?.type === "connection" && prev.id === connectionId ? null : prev));
    },
    [recalcBlockPorts, setBlocks, setConnections, setSelected]
  );

  const handleUpload = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const src = JSON.parse(ev.target?.result as string);
          const kind = detectWorkflowType(src);

          const bumpIdCounters = (args: {
            blocks?: Array<{ id: string }>;
            tools?: Array<{ id: string }>;
            connections?: Array<{ id: string }>;
          }) => {
            const maxSuffix = (items: Array<{ id: string }> | undefined, prefix: string) => {
              if (!items?.length) return 0;
              let max = 0;
              for (const item of items) {
                if (!item.id?.startsWith(prefix)) continue;
                const n = Number.parseInt(item.id.slice(prefix.length), 10);
                if (Number.isFinite(n) && n > max) max = n;
              }
              return max;
            };

            const maxBlock = maxSuffix(args.blocks, "block-");
            const maxTool = maxSuffix(args.tools, "tool-");
            const maxConn = maxSuffix(args.connections, "conn-");

            if (maxBlock > 0) nextBlockIdRef.current = Math.max(nextBlockIdRef.current, maxBlock + 1);
            if (maxTool > 0) nextToolIdRef.current = Math.max(nextToolIdRef.current, maxTool + 1);
            if (maxConn > 0) nextConnectionIdRef.current = Math.max(nextConnectionIdRef.current, maxConn + 1);
          };

          if (kind === "planning") {
            // Agent-view-only behavior: if we're currently in agent view, treat this as an
            // agent-view import of a plan JSON and hydrate blocks/connections.
            if (!showPlanningView) {
              const imported = importAgentViewPlanJson(src);
              agentPlanTemplateRef.current = imported.template;

              // Clear transient UI/linking state so we don't carry over stale hover/selection.
              setSelected(null);
              setHoveredInput(null);
              setHoveredOutput(null);
              setHoveredBlockId(null);
              setHoveredToolId(null);
              setLinking(null);
              linkingRef.current = false;

              setBlocks(imported.workflow.blocks);
              setTools([]);
              setSelectedEvals([]);
              setConnections(imported.workflow.connections);
              setBlocks((prev) => recalcBlockPorts(imported.workflow.connections, prev));

              // Ensure newly added blocks/connections get fresh IDs (avoid collisions like block-1).
              bumpIdCounters({
                blocks: imported.workflow.blocks,
                connections: imported.workflow.connections,
                tools: [],
              });
              return;
            }

            // Plan view behavior (will be reworked later)
            const plan = parsePlanningJSON(src);
            setUploadedPlan(plan);
            setPlans((prev) => {
              const exists = prev.some((p) => p.id === plan.id);
              if (exists) return prev;
              return [...prev, plan];
            });
            setShowPlanningView(true);
            return;
          }

          if (kind === "agent") {
            // Clear transient UI/linking state so we don't carry over stale hover/selection.
            setSelected(null);
            setHoveredInput(null);
            setHoveredOutput(null);
            setHoveredBlockId(null);
            setHoveredToolId(null);
            setLinking(null);
            linkingRef.current = false;

            setBlocks(src.blocks ?? []);
            setTools(src.tools ?? []);
            setSelectedEvals(src.evals ?? []);
            const loadedConnections = src.connections ?? [];
            setConnections(loadedConnections);
            setBlocks((prev) => recalcBlockPorts(loadedConnections, prev));
            agentPlanTemplateRef.current = null;

            bumpIdCounters({
              blocks: src.blocks ?? [],
              tools: src.tools ?? [],
              connections: loadedConnections,
            });
            return;
          }

          throw new Error("Unsupported workflow");
        } catch {
          alert("Invalid workflow file");
        }
      };

      reader.readAsText(file);
      e.target.value = "";
    },
    [recalcBlockPorts, setBlocks, setConnections, setSelectedEvals, setTools, setUploadedPlan, showPlanningView]
  );

  const handleDownload = useCallback(() => {
    // Agent view: export *plan JSON schema* (round-trippable with importAgentViewPlanJson).
    if (!showPlanningView) {
      const planJson = exportAgentViewPlanJson({
        blocks,
        connections,
        base: agentPlanTemplateRef.current,
      });
      const filename = `${String((planJson as any).plan_id ?? "plan")}.json`;
      downloadWorkflow(planJson, filename);
      return;
    }

    // Plan view download behavior will be reworked later.
    const rawTriples = connections
      .filter((conn) => conn.from.type === "block" && conn.to.type === "block")
      .map((conn) => ({ from: conn.from.id, to: conn.to.id }));

    const triples = inferTripleOpsByDegree(rawTriples);

    const metadata = {
      total_agents: blocks.length,
      operator_counts: countOperators(connections),
    };

    downloadWorkflow({
      blocks,
      tools,
      uploads: [],
      outputs: [],
      connections,
      triples,
      metadata,
      evals: selectedEvals,
    });
  }, [blocks, connections, selectedEvals, showPlanningView, tools]);

  const handleReset = useCallback(() => {
    // Reset behavior depends on which view you're in.
    // - Plan view: clear all plan blocks/connections.
    // - Agent view (when editing a workflow hydrated from a plan): reset the workflow back to the plan.
    reset();

    if (showPlanningView) {
      resetWorkspace();
      setUploadedPlan(null);
      setPlans([]);
      setPlanConnections([]);
      setLinkingPlanId(null);
      setLinkingPlanPoint(null);
      return;
    }

    resetWorkspace();

    if (uploadedPlan) {
      // Agent-view reset while editing a plan: clear the workflow inside that plan.
      const cleared = {
        ...uploadedPlan,
        triples: [],
        workflow: { notes: [], blocks: [], tools: [], uploads: [], outputs: [], connections: [], evals: [] },
      };
      setUploadedPlan(cleared);
      setPlans((prev) => {
        const exists = prev.some((p) => p.id === uploadedPlan.id);
        return exists
          ? prev.map((p) => (p.id === uploadedPlan.id ? cleared : p))
          : [...prev, cleared];
      });
      setSelectedEvals([]);
      // Keep plan blocks/plan connections intact; agent canvas stays empty after resetWorkspace().
      return;
    }

    // No uploaded plan: full reset to a blank agent workspace.
    setShowPlanningView(false);
    setUploadedPlan(null);
    setPlans([]);
    setPlanConnections([]);
    setLinkingPlanId(null);
    setLinkingPlanPoint(null);
  }, [reset, resetWorkspace, showPlanningView, uploadedPlan, setSelectedEvals]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;

      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const modKey = isMac ? event.metaKey : event.ctrlKey;
      const key = event.key.toLowerCase();

      if (modKey && key === "c" && selected) {
        event.preventDefault();
        if (selected.type === "block") {
          const block = blocks.find((b) => b.id === selected.id);
          if (block) setClipboard({ type: "block", data: block });
        }
        if (selected.type === "tool") {
          const tool = tools.find((t) => t.id === selected.id);
          if (tool) setClipboard({ type: "tool", data: tool });
        }
      }

      if (modKey && key === "v" && clipboard) {
        event.preventDefault();
        const OFFSET = 24;
        if (clipboard.type === "block") {
          const id = nextBlockIdRef.current++;
          setBlocks((prev) => [
            ...prev,
            {
              ...clipboard.data,
              id: `block-${id}`,
              x: clipboard.data.x + OFFSET,
              y: clipboard.data.y + OFFSET,
            },
          ]);
        }
        if (clipboard.type === "tool") {
          const id = nextToolIdRef.current++;
          setTools((prev) => [
            ...prev,
            { ...clipboard.data, id: `tool-${id}`, x: clipboard.data.x + OFFSET, y: clipboard.data.y + OFFSET },
          ]);
        }
      }

      if (selected && (event.key === "Backspace" || event.key === "Delete")) {
        event.preventDefault();
        if (selected.type === "block") handleRemoveBlock(selected.id);
        if (selected.type === "tool") handleRemoveTool(selected.id);
        if (selected.type === "connection") handleRemoveConnection(selected.id);
      }
    },
    [blocks, clipboard, handleRemoveBlock, handleRemoveConnection, handleRemoveTool, selected, setBlocks, setClipboard, setTools]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const showHandlesForId = useCallback(
    (id: string) =>
      Boolean(
        linking ||
          hoveredBlockId === id ||
          hoveredToolId === id ||
          draggingBlockId === id ||
          draggingToolId === id ||
          Boolean(selected?.id === id)
      ),
    [draggingBlockId, draggingToolId, hoveredBlockId, hoveredToolId, linking, selected]
  );

  const enterWorkflowFromPlan = useCallback(
    (plan: PlanningBlock) => {
      if (plan.workflow) {
        const wf = plan.workflow;
        setBlocks(wf.blocks ?? []);
        setTools(wf.tools ?? []);
        setSelectedEvals(wf.evals ?? []);
        setConnections(wf.connections ?? []);
        setBlocks((prev) => recalcBlockPorts(wf.connections ?? [], prev));
      } else {
        const hydrated = hydrateWorkflowFromPlan(plan);
        setBlocks(hydrated.blocks);
        setTools(hydrated.tools);
        setSelectedEvals([]);
        setConnections(hydrated.connections);
        setBlocks((prev) => recalcBlockPorts(hydrated.connections, prev));
      }
      setShowPlanningView(false);
      setLinkingPlanId(null);
      setLinkingPlanPoint(null);
      setUploadedPlan(plan);
    },
    [recalcBlockPorts, setBlocks, setConnections, setSelectedEvals, setTools]
  );

  const appThemeClass = theme === "dark" ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900";

  return (
    <div className={`relative h-screen w-screen overflow-hidden ${appThemeClass}`}>
      <Sidebar
        activePanel={activePanel}
        theme={theme}
        toolPalette={toolPalette}
        onPanelChange={setActivePanel}
        onThemeChange={(value) => {
          setTheme(value);
          setUserThemeLocked(true);
        }}
        onOpenPlanning={togglePlanningView}
        isPlanningView={showPlanningView}
        planningLoaded={Boolean(uploadedPlan)}
        planningName={uploadedPlan?.name}
        onAddPlanBlock={() => {
          const idx = plans.length + 1;
          const newPlan: PlanningBlock = {
            id: `plan-${idx}`,
            x: 160 + idx * 60,
            y: 160 + idx * 40,
            name: `Plan ${idx}`,
            query: "Describe this plan",
            triples: [],
          };
          setPlans((prev) => [...prev, newPlan]);
        }}
        onBlockDragStart={handleBlockDragStart}
        onToolDragStart={handleToolDragStart}
      />

      <Toolbar
        theme={theme}
        fileInputRef={fileInputRef}
        onC3ANClick={handleC3ANClick}
        onAboutClick={() => setActivePanel((prev) => (prev === "settings" ? null : "settings"))}
        onEvalsClick={() => setShowEvalsModal(true)}
        onDownloadClick={handleDownload}
        onUploadClick={() => fileInputRef.current?.click()}
        onRunClick={() => alert("Run triggered")}
        onResetClick={handleReset}
        onFileUpload={handleUpload}
      />

      <main className="relative z-0 h-full w-full">
        <div
          ref={containerRef}
          className="absolute inset-0"
          style={{ touchAction: "none" }}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
          onPointerDownCapture={handleCanvasPointerDown}
        >
          <Background transform={transform} theme={theme} />

          {!showPlanningView && (
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
                transformOrigin: "0 0",
                width: "100%",
                height: "100%",
                overflow: "visible",
                pointerEvents: "auto",
              }}
              onPointerMove={moveLinking}
              onPointerUp={() => linking && finalizeLinking()}
            >
              <ConnectionLines
                connections={connections}
                linking={linking}
                selected={selected}
                getOutputAnchor={getOutputAnchor}
                getInputAnchor={getInputAnchor}
                onConnectionPointerDown={handleConnectionPointerDown}
              />

              {blocks.map((block) => {
                const handles = getBlockHandles(block);
                return (
                  <AgentBlock
                    key={block.id}
                    block={block}
                    handles={handles}
                    isActive={selected?.type === "block" && selected.id === block.id}
                    isDragging={draggingBlockId === block.id}
                    showConnections={showHandlesForId(block.id)}
                    toolCount={connections.filter((c) => c.to.type === "block" && c.to.id === block.id && (c.to.inputIndex ?? 0) >= TOOL_PORT_OFFSET).length}
                    mode={getBlockMode(block)}
                    onPointerDown={blockDrag.onPointerDown}
                    onPointerMove={blockDrag.onPointerMove}
                    onPointerUp={blockDrag.onPointerUp}
                    onRemove={handleRemoveBlock}
                    onDetailsClick={setModalBlockId}
                    onHoverEnter={setHoveredBlockId}
                    onHoverLeave={() => setHoveredBlockId(null)}
                    onInputEnter={(target) => () => setHoveredInput(target)}
                    onInputLeave={(target) => () => {
                      void target;
                      setHoveredInput(null);
                    }}
                    onOutputEnter={(source) => () => setHoveredOutput(source)}
                    onOutputLeave={(source) => () => {
                      void source;
                      setHoveredOutput(null);
                    }}
                    onStartLinkingFromInput={startLinkingFromInput}
                    onStartLinkingFromOutput={startLinkingFromOutput}
                    onFinalizeLinking={finalizeLinking}
                    onMoveLinking={moveLinking}
                    onChangeInputs={changeBlockInputs}
                    onChangeOutputs={changeBlockOutputs}
                  />
                );
              })}

              {tools.map((tool) => (
                <ToolNode
                  key={tool.id}
                  tool={tool}
                  handles={getToolHandles(tool)}
                  isActive={selected?.type === "tool" && selected.id === tool.id}
                  isDragging={draggingToolId === tool.id}
                  showHandles={showHandlesForId(tool.id)}
                  onPointerDown={toolDrag.onPointerDown}
                  onPointerMove={toolDrag.onPointerMove}
                  onPointerUp={toolDrag.onPointerUp}
                  onRemove={handleRemoveTool}
                  onDetailsClick={setModalToolId}
                  onHoverEnter={setHoveredToolId}
                  onHoverLeave={() => setHoveredToolId(null)}
                  onOutputEnter={(source) => () => setHoveredOutput(source)}
                  onOutputLeave={(source) => () => {
                    void source;
                    setHoveredOutput(null);
                  }}
                  onStartLinkingFromOutput={startLinkingFromOutput}
                  onFinalizeLinking={finalizeLinking}
                  onMoveLinking={moveLinking}
                />
              ))}
            </div>
          )}

          {showPlanningView && (
            <PlanningCanvas
              theme={theme}
              plans={plans}
              connections={planConnections}
              linking={linkingPlanId && linkingPlanPoint ? { from: linkingPlanId, current: linkingPlanPoint } : null}
              onStartLink={(id: string, anchor) => {
                setLinkingPlanId(id);
                setLinkingPlanPoint(anchor);
              }}
              onMoveLink={(point) => setLinkingPlanPoint(point)}
              onCompleteLink={(id: string) => {
                if (linkingPlanId && linkingPlanId !== id) {
                  setPlanConnections((prev) => {
                    const exists = prev.some((c) => c.from === linkingPlanId && c.to === id);
                    return exists ? prev : [...prev, { from: linkingPlanId, to: id }];
                  });
                }
                setLinkingPlanId(null);
                setLinkingPlanPoint(null);
              }}
              onCancelLink={() => {
                setLinkingPlanId(null);
                setLinkingPlanPoint(null);
              }}
              onPlanMove={(id: string, x: number, y: number) =>
                setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, x, y } : p)))
              }
              onRemovePlan={handleRemovePlan}
              onEnterWorkflow={(plan: PlanningBlock) => {
                setUploadedPlan(plan);
                enterWorkflowFromPlan(plan);
                setShowPlanningView(false);
              }}
            />
          )}
        </div>
      </main>

      {modalBlockId && (
        <BlockDetailsModal
          block={blocks.find((b) => b.id === modalBlockId)!}
          connections={connections}
          toolPalette={toolPalette}
          modalToolChoice={modalToolChoice}
          onClose={() => setModalBlockId(null)}
          onToolChoiceChange={setModalToolChoice}
          onAddTool={addToolToBlock}
          onToggleInputRequired={toggleInputRequired}
          onToggleOutputRequired={toggleOutputRequired}
          getBlockMode={getBlockMode}
        />
      )}

      {modalToolId && (
        <ToolDetailsModal
          tool={tools.find((t) => t.id === modalToolId)!}
          connections={connections}
          onClose={() => setModalToolId(null)}
          onToggleInputRequired={toggleToolInputRequired}
          onToggleOutputRequired={toggleToolOutputRequired}
        />
      )}

      {showEvalsModal && (
        <EvalsModal
          evalOptions={evalOptions}
          selectedEvals={selectedEvals}
          onClose={() => setShowEvalsModal(false)}
          onToggleEval={toggleEval}
          onClearAll={() => setSelectedEvals([])}
        />
      )}
    </div>
  );
}


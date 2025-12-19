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
import { Sidebar, Toolbar } from "../components/ui";
import {
  AgentBlock,
  ConnectionLines,
  ToolNode,
} from "../components/canvas";
import PlanningCanvas from "../components/canvas/PlanningCanvas";
import {
  BlockDetailsModal,
  ToolDetailsModal,
  EvalsModal,
} from "../components/modals";
import { usePanZoom, useWorkspace } from "../hooks";
import {
  TOOL_PALETTE,
  EVAL_OPTIONS,
  MIN_IO,
  MAX_IO,
  TOOL_PORT_OFFSET,
  AGENT_REGISTRY_AGENTS,
  findAgentRegistryEntryByIdOrName,
  getAgentRegistryEntryById,
  listMandatoryOptional,
} from "../constants";
import { readCustomAgents } from "../utils/customAgents";
import { readCustomPlans } from "../utils/customPlans";
import { exportAgentViewPlanJson, importAgentViewPlanJson } from "../components/io_streams/handleIO";
import { normalizePlanOp } from "../components/canvas/planOps";
import type {
  AgentBlock as AgentBlockType,
  AnchorPoint,
  BlockHandles,
  Connection,
  LinkSource,
  LinkTarget,
  Selection,
  ToolNode as ToolNodeType,
  ToolHandles,
  ViewMode,
} from "../types";
import type { PlanningBlock } from "../types";
import type { PlanTemplate } from "../types/planning";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function resizeRequired(existing: boolean[] | undefined, desired: number) {
  return Array.from({ length: desired }, (_, i) => Boolean(existing?.[i]));
}

function clampNames(existing: string[] | undefined, desired: number) {
  return Array.from({ length: desired }, (_, i) => existing?.[i] ?? "");
}

function buildIoFromStreams(args: {
  input: { mandatory: string[]; optional?: string[] };
  output: { mandatory: string[]; optional?: string[] };
}) {
  const input = listMandatoryOptional(args.input);
  const output = listMandatoryOptional(args.output);

  const desiredInputs = clamp(input.mandatory.length + input.optional.length, MIN_IO, MAX_IO);
  const desiredOutputs = clamp(output.mandatory.length + output.optional.length, MIN_IO, MAX_IO);

  const mandatoryInputCount = Math.min(input.mandatory.length, desiredInputs);
  const mandatoryOutputCount = Math.min(output.mandatory.length, desiredOutputs);

  const inputNames = [...input.mandatory, ...input.optional].slice(0, desiredInputs);
  const outputNames = [...output.mandatory, ...output.optional].slice(0, desiredOutputs);

  const inputRequired = Array.from({ length: desiredInputs }, (_, i) => i < mandatoryInputCount);
  const outputRequired = Array.from({ length: desiredOutputs }, (_, i) => i < mandatoryOutputCount);

  return {
    inputCount: desiredInputs,
    outputCount: desiredOutputs,
    mandatoryInputCount,
    mandatoryOutputCount,
    inputRequired,
    outputRequired,
    inputNames,
    outputNames,
  };
}

function downloadWorkflow(data: unknown, filename = "workflow.json") {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function detectWorkflowType(src: unknown): "planning" | "agent" | "unknown" {
  if (!isRecord(src)) return "unknown";

  // Plan JSON schema: { plan_id, triples, ... }
  if (typeof src.plan_id === "string" || Array.isArray(src.triples)) return "planning";

  // Agent workflow snapshot: { blocks, tools, connections, ... }
  if (Array.isArray(src.blocks) && Array.isArray(src.connections)) return "agent";

  return "unknown";
}

export default function WorkflowEditorPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("agent");
  const [plans, setPlans] = useState<PlanningBlock[]>([]);
  const nextPlanIdRef = useRef(1);
  const [planCanvasKey, setPlanCanvasKey] = useState(0);

  const [planConnections, setPlanConnections] = useState<Array<{ from: string; to: string }>>([]);
  const planLinkFromRef = useRef<string | null>(null);

  // Agent-view-only IO: when the user uploads a plan JSON while in agent view,
  // we keep the original payload as a template so download keeps the same schema.
  const agentPlanTemplateRef = useRef<unknown | null>(null);

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

  const toolPalette = useMemo(() => TOOL_PALETTE, []);
  const evalOptions = useMemo(() => EVAL_OPTIONS, []);
  const customAgents = useMemo(() => readCustomAgents(), []);
  const customPlans = useMemo(() => readCustomPlans(), []);
  const availableAgents = useMemo(
    () => [...AGENT_REGISTRY_AGENTS, ...customAgents],
    [customAgents]
  );

  const handleC3ANClick = useCallback(() => {
    window.open("https://c3an.aiisc.ai/", "_blank", "noopener,noreferrer");
  }, []);

  const syncWorkflowToPlanView = useCallback(() => {
    const planJson: unknown = exportAgentViewPlanJson({
      blocks,
      connections,
      base: agentPlanTemplateRef.current,
    });

    const planRecord = isRecord(planJson) ? planJson : {};
    const planId = String(planRecord.plan_id ?? planRecord.id ?? `plan-${Date.now()}`);
    const triplesRaw = Array.isArray(planRecord.triples) ? planRecord.triples : [];
    const triples = triplesRaw.map((triple) => {
      const t = isRecord(triple) ? triple : {};
      return {
        from: String(t.from ?? ""),
        op: normalizePlanOp(String(t.op ?? "seq")),
        to: String(t.to ?? ""),
      };
    });

    const nextPlan: PlanningBlock = {
      id: planId,
      x: 220,
      y: 200,
      name: planId,
      query: String(planRecord.query ?? ""),
      triples,
      workflow: {
        blocks,
        tools,
        connections,
        evals: selectedEvals,
        notes: [],
        uploads: [],
        outputs: [],
      },
    };

    setPlans([nextPlan]);
  }, [blocks, connections, selectedEvals, tools]);

  const handleAgentDragStart = useCallback(
    (agentId: string) => (e: DragEvent<HTMLDivElement>) => {
      e.dataTransfer.effectAllowed = "copy";
      e.dataTransfer.setData(
        "application/json",
        JSON.stringify({ type: "agent-block", agentId })
      );
    },
    []
  );

  const handlePlanDragStart = useCallback(
    (template?: PlanTemplate) => (e: DragEvent<HTMLDivElement>) => {
      e.dataTransfer.effectAllowed = "copy";
      const payload = template
        ? { type: "plan-template", template }
        : { type: "plan-block" };
      e.dataTransfer.setData("application/json", JSON.stringify(payload));
    },
    []
  );

  const handleToolDragStart = useCallback(
    (toolName: string) => (e: DragEvent<HTMLDivElement>) => {
      e.dataTransfer.effectAllowed = "copy";
      e.dataTransfer.setData("application/json", JSON.stringify({ type: "tool", name: toolName }));
    },
    []
  );


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

  const handleCanvasDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const handleCanvasDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData("application/json");
      if (!raw) return;

      let payload: unknown;
      try {
        payload = JSON.parse(raw);
      } catch {
        return;
      }

      if (!isRecord(payload)) return;

      const world = toWorldPoint(event.clientX, event.clientY);
      if (!world) return;

      if (payload.type === "agent-block") {
        const agentId = typeof payload.agentId === "string" ? payload.agentId : "";
        const agent =
          getAgentRegistryEntryById(agentId, availableAgents) ??
          (availableAgents.length ? availableAgents[0] : null);

        const io = agent
          ? buildIoFromStreams({
              input: agent.input_data_streams,
              output: agent.output_data_streams,
            })
          : {
              inputCount: 1,
              outputCount: 1,
              mandatoryInputCount: 0,
              mandatoryOutputCount: 0,
              inputRequired: [false],
              outputRequired: [false],
              inputNames: [],
              outputNames: [],
            };

        const id = nextBlockIdRef.current++;
        setBlocks((prev) => [
          ...prev,
          {
            id: `block-${id}`,
            x: world.x,
            y: world.y,
            agentId: agent?.id,
            name: agent?.name ?? "Agent Block",
            description: agent?.description ?? "",
            inputCount: io.inputCount,
            outputCount: io.outputCount,
            inputRequired: io.inputRequired,
            outputRequired: io.outputRequired,
            inputNames: io.inputNames,
            outputNames: io.outputNames,
            presetId: agent?.id ?? "custom",
            mandatoryInputCount: io.mandatoryInputCount,
            mandatoryOutputCount: io.mandatoryOutputCount,
          },
        ]);
        return;
      }

      if (payload.type === "tool") {
        const name = typeof payload.name === "string" ? payload.name : "";
        const paletteItem = toolPalette.find((t) => t.name === name);
        if (!paletteItem) return;
        const id = nextToolIdRef.current++;
        setTools((prev) => [...prev, { ...paletteItem, id: `tool-${id}`, x: world.x, y: world.y }]);
      }
    },
    [availableAgents, nextBlockIdRef, nextToolIdRef, setBlocks, setTools, toWorldPoint, toolPalette]
  );

  const getBlockHandles = useCallback(
    (block: AgentBlockType): BlockHandles => {
      const width = 220;
      const baseHeight = 120;
      const lastRequiredInputIndex = Math.max(
        block.inputRequired?.lastIndexOf(true) ?? -1,
        (block.mandatoryInputCount ?? 0) - 1
      );
      const lastRequiredOutputIndex = Math.max(
        block.outputRequired?.lastIndexOf(true) ?? -1,
        (block.mandatoryOutputCount ?? 0) - 1
      );

      const baseInputs = Math.max(1, lastRequiredInputIndex + 1);
      const baseOutputs = Math.max(1, lastRequiredOutputIndex + 1);

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
      const toolSlots = hasToolConnection ? 1 : hoverIsOnBottom ? 1 : 0;

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
        Array.from({ length: Math.max(0, count) }, (_, idx) => ({
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
    [connections, hoveredBlockId, linking]
  );

  const getToolHandles = useCallback(
    (tool: ToolNodeType): ToolHandles => {
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
    [setBlocks, setConnections]
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
        const sourceBlock = blocks.find((b) => b.id === from.id);
        if (!sourceBlock) return;

        const enabledPorts = (sourceBlock.outputRequired ?? [])
          .map((enabled, idx) => (enabled ? idx : null))
          .filter((idx): idx is number => typeof idx === "number");

        // If the user hasn't enabled any outputs (shouldn't happen), do nothing.
        if (enabledPorts.length === 0) return;

        const usedPorts = new Set(
          connections
            .filter((c) => c.from.type === "block" && c.from.id === from.id)
            .map((c) => c.from.port)
        );

        // If this port is already used, advance to the next enabled free port.
        if (usedPorts.has(from.port)) {
          const nextFree = enabledPorts.find((p) => !usedPorts.has(p));
          if (typeof nextFree !== "number") return;
          effectiveFrom = { ...from, port: nextFree };
        } else if (!enabledPorts.includes(from.port)) {
          // Shouldn't happen because hidden ports don't render handles, but keep safe.
          return;
        }
      }

      const anchor = getOutputAnchor(effectiveFrom);
      if (!anchor) return;
      linkingRef.current = true;
      setLinking({ origin: "output", from: effectiveFrom, current: anchor });
    },
    [blocks, connections, getOutputAnchor, linkingRef, setHoveredInput, setHoveredOutput, setLinking]
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
            const targetBlock = blocks.find((b) => b.id === normalizedTarget.id);
            const enabledInputs = (targetBlock?.inputRequired ?? [])
              .map((enabled, idx) => (enabled ? idx : null))
              .filter((idx): idx is number => typeof idx === "number");

            if (enabledInputs.length === 0) return prev;

            const inbound = base.filter(
              (c) =>
                c.to.type === "block" &&
                c.to.id === normalizedTarget.id &&
                (c.to.inputIndex ?? 0) < TOOL_PORT_OFFSET
            );
            const occupied = new Set(inbound.map((c) => c.to.inputIndex ?? 0));

            // First inbound always uses slot 0.
            if (inbound.length === 0) {
              targetSlot = enabledInputs.includes(targetSlot) ? targetSlot : enabledInputs[0];
            } else if (occupied.has(targetSlot) || !enabledInputs.includes(targetSlot)) {
              // Additional inbound: pick the next free *enabled* slot.
              const free = enabledInputs.find((i) => !occupied.has(i));
              if (typeof free === "number") targetSlot = free;
              else return prev;
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
    [blocks, hoveredBlockId, hoveredInput, hoveredOutput, linking, nextConnectionIdRef, recalcBlockPorts, setBlocks, setConnections, setHoveredInput, setHoveredOutput, setLinking, linkingRef]
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

  type DraggableItem = { id: string; x: number; y: number };

  const makeDragHandlers = useCallback(
    <T extends DraggableItem>(
      type: NonNullable<Selection>["type"],
      getItem: (id: string) => DraggableItem | undefined,
      setItem: React.Dispatch<React.SetStateAction<T[]>>,
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
            prev.map((item) =>
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

            const loadedBlocks = imported.workflow.blocks;
            const loadedConnections = imported.workflow.connections;

            const normalizedBlocks = loadedBlocks.map((b) => {
              const maybeAgent =
                getAgentRegistryEntryById((b as AgentBlockType).agentId, availableAgents) ??
                findAgentRegistryEntryByIdOrName((b as AgentBlockType).name, availableAgents);

              if (!maybeAgent) return b;

              const io = buildIoFromStreams({
                input: maybeAgent.input_data_streams,
                output: maybeAgent.output_data_streams,
              });

              const rawInputCount = Number((b as AgentBlockType).inputCount);
              const rawOutputCount = Number((b as AgentBlockType).outputCount);
              const inputCount = Math.max(1, Number.isFinite(rawInputCount) ? rawInputCount : 1, io.inputCount);
              const outputCount = Math.max(1, Number.isFinite(rawOutputCount) ? rawOutputCount : 1, io.outputCount);

              const mergeNames = (existing: unknown, fallback: string[], length: number) => {
                const ex = Array.isArray(existing) ? (existing as unknown[]).map((v) => String(v)) : [];
                return Array.from({ length }, (_, i) => ex[i] ?? fallback[i] ?? "");
              };

              const ensureRequired = (existing: unknown, length: number, mandatoryCount: number) => {
                const ex = Array.isArray(existing) ? (existing as unknown[]).map((v) => Boolean(v)) : [];
                return Array.from({ length }, (_, i) => (i < mandatoryCount ? true : ex[i] ?? false));
              };

              return {
                ...b,
                agentId: (b as AgentBlockType).agentId ?? maybeAgent.id,
                name: maybeAgent.name ?? (b as AgentBlockType).name,
                description: maybeAgent.description ?? (b as AgentBlockType).description,
                inputCount,
                outputCount,
                mandatoryInputCount: io.mandatoryInputCount,
                mandatoryOutputCount: io.mandatoryOutputCount,
                inputNames: mergeNames((b as AgentBlockType).inputNames, io.inputNames, inputCount),
                outputNames: mergeNames((b as AgentBlockType).outputNames, io.outputNames, outputCount),
                inputRequired: ensureRequired((b as AgentBlockType).inputRequired, inputCount, io.mandatoryInputCount),
                outputRequired: ensureRequired((b as AgentBlockType).outputRequired, outputCount, io.mandatoryOutputCount),
              } satisfies AgentBlockType;
            });

            const byId = new Map(normalizedBlocks.map((b) => [b.id, b] as const));

            const normalizedConnections = loadedConnections.map((c: Connection) => {
              const next = { ...c } as Connection;
              if (next.from.type === "block") {
                const fromBlock = byId.get(next.from.id);
                const maxPort = Math.max(0, (fromBlock?.outputCount ?? 1) - 1);
                next.from = { ...next.from, port: Math.max(0, Math.min(maxPort, next.from.port)) };
              }
              if (next.to.type === "block") {
                const toBlock = byId.get(next.to.id);
                const idx = next.to.inputIndex ?? 0;
                if (idx < TOOL_PORT_OFFSET) {
                  const maxIdx = Math.max(0, (toBlock?.inputCount ?? 1) - 1);
                  next.to = { ...next.to, inputIndex: Math.max(0, Math.min(maxIdx, idx)) };
                }
              }
              return next;
            });

            // Auto-enable any ports referenced by uploaded connections so anchors/lines align.
            const blocksWithUsedPorts: AgentBlockType[] = normalizedBlocks.map((b) => ({
              ...b,
              inputRequired: [...(b.inputRequired ?? [])],
              outputRequired: [...(b.outputRequired ?? [])],
            }));
            const mutableById = new Map(blocksWithUsedPorts.map((b) => [b.id, b] as const));
            for (const conn of normalizedConnections) {
              if (conn.from.type === "block") {
                const b = mutableById.get(conn.from.id);
                if (b && conn.from.port >= 0 && conn.from.port < b.outputRequired.length) {
                  b.outputRequired[conn.from.port] = true;
                }
              }
              if (conn.to.type === "block") {
                const idx = conn.to.inputIndex ?? 0;
                if (idx >= 0 && idx < TOOL_PORT_OFFSET) {
                  const b = mutableById.get(conn.to.id);
                  if (b && idx < b.inputRequired.length) b.inputRequired[idx] = true;
                }
              }
            }

            setBlocks(blocksWithUsedPorts);
            setTools([]);
            setSelectedEvals([]);
            setConnections(normalizedConnections);
            setBlocks((prev) => recalcBlockPorts(normalizedConnections, prev));

            // Ensure newly added blocks/connections get fresh IDs (avoid collisions like block-1).
            bumpIdCounters({
              blocks: blocksWithUsedPorts,
              connections: normalizedConnections,
              tools: [],
            });
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

            const loadedBlocks = Array.isArray(src.blocks) ? (src.blocks as AgentBlockType[]) : [];

            // Try to attach/validate agentId from the local registry on upload.
            const normalizedBlocks = loadedBlocks.map((b) => {
              const maybeAgent =
                getAgentRegistryEntryById((b as AgentBlockType).agentId, availableAgents) ??
                findAgentRegistryEntryByIdOrName((b as AgentBlockType).name, availableAgents);

              if (!maybeAgent) return b;

              const io = buildIoFromStreams({
                input: maybeAgent.input_data_streams,
                output: maybeAgent.output_data_streams,
              });

              const rawInputCount = Number((b as AgentBlockType).inputCount);
              const rawOutputCount = Number((b as AgentBlockType).outputCount);
              // Match "freshly placed" behavior: expose full registry IO (mandatory + optional),
              // while still preserving any user-expanded sizing from the uploaded JSON.
              const inputCount = Math.max(
                1,
                Number.isFinite(rawInputCount) ? rawInputCount : 1,
                io.inputCount
              );
              const outputCount = Math.max(
                1,
                Number.isFinite(rawOutputCount) ? rawOutputCount : 1,
                io.outputCount
              );

              const mergeNames = (existing: unknown, fallback: string[], length: number) => {
                const ex = Array.isArray(existing) ? (existing as unknown[]).map((v) => String(v)) : [];
                return Array.from({ length }, (_, i) => ex[i] ?? fallback[i] ?? "");
              };

              const ensureRequired = (existing: unknown, length: number, mandatoryCount: number) => {
                const ex = Array.isArray(existing) ? (existing as unknown[]).map((v) => Boolean(v)) : [];
                return Array.from({ length }, (_, i) => (i < mandatoryCount ? true : ex[i] ?? false));
              };

              // Preserve user-edited IO sizing; only fill in missing registry linkage + missing labels.
              const next: AgentBlockType = {
                ...b,
                agentId: (b as AgentBlockType).agentId ?? maybeAgent.id,
                name: maybeAgent.name ?? (b as AgentBlockType).name,
                description: maybeAgent.description ?? (b as AgentBlockType).description,

                // Ensure mandatory IO is always present/marked required, even if upload omitted it.
                inputCount,
                outputCount,
                mandatoryInputCount: io.mandatoryInputCount,
                mandatoryOutputCount: io.mandatoryOutputCount,
                inputNames: mergeNames((b as AgentBlockType).inputNames, io.inputNames, inputCount),
                outputNames: mergeNames((b as AgentBlockType).outputNames, io.outputNames, outputCount),
                inputRequired: ensureRequired((b as AgentBlockType).inputRequired, inputCount, io.mandatoryInputCount),
                outputRequired: ensureRequired((b as AgentBlockType).outputRequired, outputCount, io.mandatoryOutputCount),
              };
              return next;
            });

            const normalizedBlockById = new Map(normalizedBlocks.map((b) => [b.id, b] as const));

            // Normalize uploaded connections so they reference valid port indices after IO rehydration.
            const loadedConnections = (src.connections ?? []).map((c: Connection) => {
              const next = { ...c } as Connection;
              if (next.from.type === "block") {
                const fromBlock = normalizedBlockById.get(next.from.id);
                const maxPort = Math.max(0, (fromBlock?.outputCount ?? 1) - 1);
                next.from = { ...next.from, port: Math.max(0, Math.min(maxPort, next.from.port)) };
              }
              if (next.to.type === "block") {
                const toBlock = normalizedBlockById.get(next.to.id);
                const idx = next.to.inputIndex ?? 0;
                if (idx < TOOL_PORT_OFFSET) {
                  const maxIdx = Math.max(0, (toBlock?.inputCount ?? 1) - 1);
                  next.to = { ...next.to, inputIndex: Math.max(0, Math.min(maxIdx, idx)) };
                }
              }
              return next;
            });

            // Auto-enable any ports referenced by uploaded connections so anchors/lines align.
            const blocksWithUsedPorts: AgentBlockType[] = normalizedBlocks.map((b) => ({
              ...b,
              inputRequired: [...(b.inputRequired ?? [])],
              outputRequired: [...(b.outputRequired ?? [])],
            }));
            const mutableById = new Map(blocksWithUsedPorts.map((b) => [b.id, b] as const));
            for (const conn of loadedConnections) {
              if (conn.from.type === "block") {
                const b = mutableById.get(conn.from.id);
                if (b && conn.from.port >= 0 && conn.from.port < b.outputRequired.length) {
                  b.outputRequired[conn.from.port] = true;
                }
              }
              if (conn.to.type === "block") {
                const idx = conn.to.inputIndex ?? 0;
                if (idx >= 0 && idx < TOOL_PORT_OFFSET) {
                  const b = mutableById.get(conn.to.id);
                  if (b && idx < b.inputRequired.length) b.inputRequired[idx] = true;
                }
              }
            }

            setBlocks(blocksWithUsedPorts);
            setTools(src.tools ?? []);
            setSelectedEvals(src.evals ?? []);
            setConnections(loadedConnections);
            setBlocks((prev) => recalcBlockPorts(loadedConnections, prev));
            agentPlanTemplateRef.current = null;

            bumpIdCounters({
              blocks: blocksWithUsedPorts,
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
    [
      linkingRef,
      nextBlockIdRef,
      nextConnectionIdRef,
      nextToolIdRef,
      availableAgents,
      recalcBlockPorts,
      setBlocks,
      setConnections,
      setHoveredBlockId,
      setHoveredInput,
      setHoveredOutput,
      setHoveredToolId,
      setLinking,
      setSelected,
      setSelectedEvals,
      setTools,
    ]
  );

  const handleDownload = useCallback(() => {
    const planJson = exportAgentViewPlanJson({
      blocks,
      connections,
      base: agentPlanTemplateRef.current,
    });
    const filename = `${String(planJson.plan_id ?? "plan")}.json`;
    downloadWorkflow(planJson, filename);
  }, [blocks, connections]);

  const handleReset = useCallback(() => {
    reset();
    resetWorkspace();

    setPlans([]);
    setPlanCanvasKey((k) => k + 1);

    agentPlanTemplateRef.current = null;
    setSelectedEvals([]);
  }, [reset, resetWorkspace, setSelectedEvals]);

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
    [
      blocks,
      clipboard,
      handleRemoveBlock,
      handleRemoveConnection,
      handleRemoveTool,
      nextBlockIdRef,
      nextToolIdRef,
      selected,
      setBlocks,
      setClipboard,
      setTools,
      tools,
    ]
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

  const appThemeClass = theme === "dark" ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900";

  const modalBlock = modalBlockId ? blocks.find((b) => b.id === modalBlockId) ?? null : null;
  const modalTool = modalToolId ? tools.find((t) => t.id === modalToolId) ?? null : null;

  return (
    <div className={`relative h-screen w-screen overflow-hidden ${appThemeClass}`}>
      <Sidebar
        activePanel={activePanel}
        theme={theme}
        viewMode={viewMode}
        registryAgents={AGENT_REGISTRY_AGENTS}
        customAgents={customAgents}
        planTemplates={customPlans}
        toolPalette={toolPalette}
        onPanelChange={setActivePanel}
        onThemeChange={(value) => {
          setTheme(value);
          setUserThemeLocked(true);
        }}
        onViewModeChange={(mode) => {
          if (mode === "plan" && activePanel === "tools") setActivePanel("blocks");
          if (mode === "plan") {
            syncWorkflowToPlanView();
            setPlanConnections([]);
            planLinkFromRef.current = null;
          }
          setViewMode(mode);
          setModalBlockId(null);
          setModalToolId(null);
          setLinking(null);
          setHoveredInput(null);
          setHoveredOutput(null);
          setSelected(null);
        }}
        onAgentDragStart={handleAgentDragStart}
        onPlanDragStart={handlePlanDragStart}
        onToolDragStart={handleToolDragStart}
      />

      <Toolbar
        theme={theme}
        fileInputRef={fileInputRef}
        onC3ANClick={handleC3ANClick}
        onAboutClick={() => setActivePanel((prev) => (prev === "settings" ? null : "settings"))}
        onPlanningClick={() => {
          window.location.hash = "#/planning";
        }}
        onAgentGenClick={() => {
          window.location.hash = "#/agentgen";
        }}
        onEvalsClick={() => setShowEvalsModal(true)}
        onDownloadClick={handleDownload}
        onUploadClick={() => fileInputRef.current?.click()}
        onRunClick={() => alert("Run triggered")}
        onResetClick={handleReset}
        onFileUpload={handleUpload}
      />

      <main className="relative z-0 h-full w-full">
        {viewMode === "plan" ? (
          <PlanningCanvas
            key={planCanvasKey}
            theme={theme}
            plans={plans}
            connections={planConnections}
            onStartLink={(fromId) => {
              planLinkFromRef.current = fromId;
            }}
            onCompleteLink={(toId) => {
              const fromId = planLinkFromRef.current;
              planLinkFromRef.current = null;
              if (!fromId || fromId === toId) return;
              setPlanConnections((prev) => {
                if (prev.some((c) => c.from === fromId && c.to === toId)) return prev;
                return [...prev, { from: fromId, to: toId }];
              });
            }}
            onCancelLink={() => {
              planLinkFromRef.current = null;
            }}
            onPlanMove={(id, x, y) => {
              setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, x, y } : p)));
            }}
            onRemovePlan={(id) => {
              setPlans((prev) => prev.filter((p) => p.id !== id));
              setPlanConnections((prev) => prev.filter((c) => c.from !== id && c.to !== id));
              if (planLinkFromRef.current === id) planLinkFromRef.current = null;
            }}
            onDropPlanBlock={(point, payload) => {
              const id = `plan-${nextPlanIdRef.current++}`;
              const template = payload?.type === "plan-template" ? payload.template : null;
              setPlans((prev) => [
                ...prev,
                {
                  id,
                  x: point.x,
                  y: point.y,
                  name: template?.name ?? "Plan",
                  query: template?.query ?? "",
                  triples: template?.triples ?? [],
                },
              ]);
            }}
            onEnterWorkflow={(plan) => {
              if (plan.workflow) {
                const loadedConnections = plan.workflow.connections ?? [];

                setSelected(null);
                setHoveredInput(null);
                setHoveredOutput(null);
                setHoveredBlockId(null);
                setHoveredToolId(null);
                setLinking(null);
                linkingRef.current = false;

                setBlocks(plan.workflow.blocks ?? []);
                setTools(plan.workflow.tools ?? []);
                setSelectedEvals(plan.workflow.evals ?? []);
                setConnections(loadedConnections);
                setBlocks((prev) => recalcBlockPorts(loadedConnections, prev));
              }
              setViewMode("agent");
            }}
          />
        ) : (
          <div
            ref={containerRef}
            className="absolute inset-0"
            style={{ touchAction: "none" }}
            onDragOver={handleCanvasDragOver}
            onDrop={handleCanvasDrop}
            onPointerDownCapture={handleCanvasPointerDown}
          >
            <Background transform={transform} theme={theme} />

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

              {tools.map((tool) => {
                const handles = getToolHandles(tool);
                return (
                  <ToolNode
                    key={tool.id}
                    tool={tool}
                    handles={handles}
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
                );
              })}
            </div>
          </div>
        )}
      </main>

      {modalBlock && (
        <BlockDetailsModal
          block={modalBlock}
          registryAgents={availableAgents}
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

      {modalTool && (
        <ToolDetailsModal
          tool={modalTool}
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

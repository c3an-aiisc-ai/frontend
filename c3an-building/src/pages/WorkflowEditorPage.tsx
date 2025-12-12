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
} from "react";

import { Background } from "../components";
import { Sidebar } from "../components/panels";
import { Toolbar, ConnectionLines } from "../components/ui";
import {
  AgentBlock,
  ToolNode,
  UploadNode,
  OutputNode,
  StickyNote,
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
  countOperators,
  downloadWorkflow,
  clamp,
  resizeRequired,
  clampNames,
} from "../utils";
import type {
  AgentBlock as AgentBlockType,
  ToolNode as ToolNodeType,
  Connection,
  LinkSource,
  LinkTarget,
  AnchorPoint,
  BlockHandles,
} from "../types";

export default function WorkflowEditorPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Workspace state
  const workspace = useWorkspace();
  const {
    notes,
    setNotes,
    blocks,
    setBlocks,
    tools,
    setTools,
    uploads,
    setUploads,
    outputs,
    setOutputs,
    connections,
    setConnections,
    theme,
    setTheme,
    userThemeLocked,
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
    hoveredUploadId,
    setHoveredUploadId,
    hoveredOutputId,
    setHoveredOutputId,
    draggingNoteId,
    setDraggingNoteId,
    draggingBlockId,
    setDraggingBlockId,
    draggingToolId,
    setDraggingToolId,
    draggingUploadId,
    setDraggingUploadId,
    draggingOutputId,
    setDraggingOutputId,
    dragOffsetRef,
    blockDragOffsetRef,
    toolDragOffsetRef,
    uploadDragOffsetRef,
    outputDragOffsetRef,
    modalBlockId,
    setModalBlockId,
    modalToolId,
    setModalToolId,
    modalToolChoice,
    setModalToolChoice,
    showEvalsModal,
    setShowEvalsModal,
    agentJsonInput,
    setAgentJsonInput,
    agentParseError,
    setAgentParseError,
    nextIdRef,
    nextBlockIdRef,
    nextToolIdRef,
    nextUploadIdRef,
    nextOutputIdRef,
    nextConnectionIdRef,
    resetWorkspace,
    recalcBlockPorts,
    getBlockMode,
  } = workspace;

  // Pan/zoom
  const { containerRef, transform, reset } = usePanZoom({
    initial: { x: 0, y: 0, zoom: 1 },
    shouldAllowPan: (event) => {
      if (linkingRef.current) return false;
      const target = event.target as HTMLElement | null;
      return !target?.closest(
        "[data-note],[data-block],[data-tool],[data-upload],[data-output]"
      );
    },
    isPanDisabled: () => linkingRef.current,
  });

  // Convert screen coordinates to world coordinates
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

  // Tool palette memo
  const toolPalette = useMemo(() => TOOL_PALETTE, []);
  const agentPresets = useMemo(() => AGENT_PRESETS, []);
  const evalOptions = useMemo(() => EVAL_OPTIONS, []);

  // ==========================================================================
  // DRAG HANDLERS
  // ==========================================================================

  const handleBlockDragStart = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(
      "application/json",
      JSON.stringify({ type: "agent-block" })
    );
  }, []);

  const handleToolDragStart = useCallback(
    (toolName: string) => (event: DragEvent<HTMLDivElement>) => {
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData(
        "application/json",
        JSON.stringify({ type: "tool", name: toolName })
      );
    },
    []
  );

  const handleUploadDragStart = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(
      "application/json",
      JSON.stringify({ type: "upload-block" })
    );
  }, []);

  const handleOutputDragStart = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(
      "application/json",
      JSON.stringify({ type: "output-block" })
    );
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

      const payloadRaw = event.dataTransfer.getData("application/json");
      let payloadType: string | null = null;
      let payloadToolName: string | null = null;
      
      try {
        const parsed = payloadRaw ? JSON.parse(payloadRaw) : null;
        payloadType = parsed?.type ?? null;
        payloadToolName = parsed?.name ?? null;
      } catch {
        // ignore
      }

      if (!payloadType) return;

      const rect = el.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      const worldX = (localX - transform.x) / transform.zoom;
      const worldY = (localY - transform.y) / transform.zoom;

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
            outputCount: preset?.outputCount ?? 1,
            inputRequired: Array(preset?.inputCount ?? 1).fill(false),
            outputRequired: Array(preset?.outputCount ?? 1).fill(false),
            inputNames: [],
            outputNames: [],
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
            format: "Describe the format here.",
          },
        ]);
      }

      if (payloadType === "tool" && payloadToolName) {
        const paletteItem = toolPalette.find((t) => t.name === payloadToolName);
        if (paletteItem) {
          const id = nextToolIdRef.current++;
          setTools((prev) => [
            ...prev,
            { ...paletteItem, id: `tool-${id}`, x: worldX, y: worldY },
          ]);
        }
      }
    },
    [
      agentPresets,
      containerRef,
      toolPalette,
      transform.x,
      transform.y,
      transform.zoom,
      setBlocks,
      setTools,
      setUploads,
      setOutputs,
    ]
  );

  // ==========================================================================
  // HANDLE CALCULATIONS
  // ==========================================================================

  const getBlockHandles = useCallback(
    (block: AgentBlockType): BlockHandles => {
      const width = 220;
      const baseHeight = 120;
      const baseInputs = Math.max(1, block.inputCount);
      const baseOutputs = Math.max(1, block.outputCount);
      const topPadding = 18;
      const slotGap = 28;

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

      const inputSlots = Math.min(MAX_IO, Math.max(baseInputs, maxConnectedInput + 1));
      const outputSlots = Math.min(MAX_IO, Math.max(baseOutputs, maxConnectedOutput + 1));
      const toolSlots = hasToolConnection ? 1 : 1;

      const maxSlots = Math.max(inputSlots, outputSlots);
      const height =
        maxSlots > 1
          ? Math.max(baseHeight, topPadding * 2 + slotGap * (maxSlots - 1))
          : baseHeight;

      const buildAnchors = (
        count: number,
        side: "left" | "right"
      ): AnchorPoint[] => {
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

      const buildBottomAnchors = (
        count: number
      ): { anchor: AnchorPoint; slot: number }[] => {
        return Array.from({ length: count }, (_, idx) => ({
          anchor: { x: block.x + width / 2 + 4, y: block.y + height, dir: "down" as const },
          slot: TOOL_PORT_OFFSET + idx,
        }));
      };

      return {
        width,
        height,
        inputAnchors: buildAnchors(inputSlots, "left"),
        outputAnchors: buildAnchors(outputSlots, "right"),
        toolAnchors: buildBottomAnchors(toolSlots),
      };
    },
    [connections]
  );

  const getToolHandles = useCallback((tool: ToolNodeType) => {
    const width = 180;
    const height = 110;
    const output: AnchorPoint = { x: tool.x + width / 2, y: tool.y - 6, dir: "up" };
    return { width, height, output, input: output };
  }, []);

  const getUploadHandles = useCallback((upload: { x: number; y: number }) => {
    const width = 240;
    const height = 210;
    return {
      width,
      height,
      output: { x: upload.x + width, y: upload.y + height / 2, dir: "right" as const },
    };
  }, []);

  const getOutputHandles = useCallback((output: { x: number; y: number }) => {
    const width = 240;
    const height = 240;
    return {
      width,
      height,
      input: { x: output.x, y: output.y + height / 2, dir: "left" as const },
    };
  }, []);

  // ==========================================================================
  // ANCHOR GETTERS
  // ==========================================================================

  const getOutputAnchor = useCallback(
    (endpoint: LinkSource) => {
      if (endpoint.type === "block") {
        const block = blocks.find((b) => b.id === endpoint.id);
        if (!block) return null;
        const handles = getBlockHandles(block);
        const index = Math.min(
          handles.outputAnchors.length - 1,
          Math.max(0, endpoint.port)
        );
        return handles.outputAnchors[index];
      }
      if (endpoint.type === "tool") {
        const tool = tools.find((t) => t.id === endpoint.id);
        if (!tool) return null;
        return getToolHandles(tool).output;
      }
      if (endpoint.type === "upload") {
        const upload = uploads.find((u) => u.id === endpoint.id);
        if (!upload) return null;
        return getUploadHandles(upload).output;
      }
      return null;
    },
    [blocks, getBlockHandles, getToolHandles, getUploadHandles, tools, uploads]
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
        const boundedIndex = Math.min(
          handles.inputAnchors.length - 1,
          Math.max(0, inputIndex)
        );
        return handles.inputAnchors[boundedIndex];
      }
      if (target.type === "tool") {
        const tool = tools.find((t) => t.id === target.id);
        if (!tool) return null;
        return getToolHandles(tool).input;
      }
      if (target.type === "output") {
        const output = outputs.find((o) => o.id === target.id);
        if (!output) return null;
        return getOutputHandles(output).input;
      }
      return null;
    },
    [blocks, getBlockHandles, getOutputHandles, getToolHandles, outputs, tools]
  );

  // ==========================================================================
  // CONNECTION HANDLERS
  // ==========================================================================

  const handleConnectionPointerDown = useCallback(
    (conn: Connection) => (event: ReactPointerEvent<SVGPathElement>) => {
      event.stopPropagation();
      event.preventDefault();
      setConnections((prev) => {
        const next = prev.filter((c) => c.id !== conn.id);
        setBlocks((blocksState) => recalcBlockPorts(next, blocksState));
        return next;
      });
    },
    [recalcBlockPorts, setBlocks, setConnections]
  );

  // ==========================================================================
  // LINKING HANDLERS
  // ==========================================================================

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
    [getInputAnchor, setLinking]
  );

  const startLinkingFromOutput = useCallback(
    (from: LinkSource) =>
      (event: ReactPointerEvent<HTMLButtonElement | HTMLDivElement>) => {
        event.stopPropagation();
        event.preventDefault();
        setHoveredInput(null);
        setHoveredOutput(null);
        const anchor = getOutputAnchor(from);
        if (!anchor) return;
        linkingRef.current = true;
        setLinking({ origin: "output", from, current: anchor });
      },
    [getOutputAnchor, setHoveredInput, setHoveredOutput, setLinking]
  );

  const moveLinking = useCallback(
    (event: ReactPointerEvent<HTMLDivElement | HTMLButtonElement>) => {
      if (!linking) return;
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!world) return;
      setLinking((prev) => (prev ? { ...prev, current: world } : prev));
    },
    [linking, setLinking, toWorldPoint]
  );

  const finalizeLinking = useCallback(
    (overrideTarget?: LinkTarget) => {
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
        setConnections((prev) => {
          const targetSlot = target.inputIndex ?? 0;
          const next = [
            ...prev.filter(
              (conn) =>
                !(
                  conn.to.type === target.type &&
                  conn.to.id === target.id &&
                  (conn.to.inputIndex ?? 0) === targetSlot
                )
            ),
            { id: `conn-${id}`, from, to: target },
          ];
          setBlocks((blocksState) => recalcBlockPorts(next, blocksState));
          return next;
        });
      }

      setLinking(null);
      linkingRef.current = false;
      setHoveredInput(null);
      setHoveredOutput(null);
    },
    [
      hoveredInput,
      hoveredOutput,
      linking,
      recalcBlockPorts,
      setBlocks,
      setConnections,
      setHoveredInput,
      setHoveredOutput,
      setLinking,
    ]
  );

  // ==========================================================================
  // NODE POINTER HANDLERS
  // ==========================================================================

  const handleBlockPointerDown = useCallback(
    (blockId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (linkingRef.current || target?.closest("[data-connector]")) return;
      event.stopPropagation();
      event.preventDefault();
      setSelected({ type: "block", id: blockId });
      const block = blocks.find((b) => b.id === blockId);
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!block || !world) return;
      blockDragOffsetRef.current = { x: world.x - block.x, y: world.y - block.y };
      setDraggingBlockId(blockId);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [blocks, setDraggingBlockId, setSelected, toWorldPoint]
  );

  const handleBlockPointerMove = useCallback(
    (blockId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingBlockId !== blockId) return;
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!world) return;
      setBlocks((prev) =>
        prev.map((b) =>
          b.id === blockId
            ? {
                ...b,
                x: world.x - blockDragOffsetRef.current.x,
                y: world.y - blockDragOffsetRef.current.y,
              }
            : b
        )
      );
    },
    [draggingBlockId, setBlocks, toWorldPoint]
  );

  const handleBlockPointerUp = useCallback(
    (blockId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingBlockId !== blockId) return;
      setDraggingBlockId(null);
      blockDragOffsetRef.current = { x: 0, y: 0 };
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    },
    [draggingBlockId, setDraggingBlockId]
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
            )
        )
      );
    },
    [draggingBlockId, selected, setBlocks, setConnections, setDraggingBlockId, setSelected]
  );

  // Similar handlers for tools, uploads, outputs, notes...
  // (Abbreviated for brevity - full implementation would include all handlers)

  const handleToolPointerDown = useCallback(
    (toolId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (linkingRef.current || target?.closest("[data-connector]")) return;
      event.stopPropagation();
      event.preventDefault();
      setSelected({ type: "tool", id: toolId });
      const tool = tools.find((t) => t.id === toolId);
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!tool || !world) return;
      toolDragOffsetRef.current = { x: world.x - tool.x, y: world.y - tool.y };
      setDraggingToolId(toolId);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [setDraggingToolId, setSelected, toWorldPoint, tools]
  );

  const handleToolPointerMove = useCallback(
    (toolId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingToolId !== toolId) return;
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!world) return;
      setTools((prev) =>
        prev.map((t) =>
          t.id === toolId
            ? {
                ...t,
                x: world.x - toolDragOffsetRef.current.x,
                y: world.y - toolDragOffsetRef.current.y,
              }
            : t
        )
      );
    },
    [draggingToolId, setTools, toWorldPoint]
  );

  const handleToolPointerUp = useCallback(
    (toolId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingToolId !== toolId) return;
      setDraggingToolId(null);
      toolDragOffsetRef.current = { x: 0, y: 0 };
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    },
    [draggingToolId, setDraggingToolId]
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
            )
        )
      );
    },
    [draggingToolId, selected, setConnections, setDraggingToolId, setSelected, setTools]
  );

  // ==========================================================================
  // INPUT/OUTPUT HOVER HANDLERS
  // ==========================================================================

  const handleInputEnter = useCallback(
    (target: { type: "block" | "tool" | "output"; id: string; inputIndex?: number }) =>
      () => {
        if (linking) setHoveredInput(target);
      },
    [linking, setHoveredInput]
  );

  const handleInputLeave = useCallback(
    (target: { type: "block" | "tool" | "output"; id: string; inputIndex?: number }) =>
      () => {
        if (
          hoveredInput &&
          hoveredInput.type === target.type &&
          hoveredInput.id === target.id
        ) {
          setHoveredInput(null);
        }
      },
    [hoveredInput, setHoveredInput]
  );

  const handleOutputEnter = useCallback(
    (source: LinkSource) => () => {
      if (linking) setHoveredOutput(source);
    },
    [linking, setHoveredOutput]
  );

  const handleOutputLeave = useCallback(
    (source: LinkSource) => () => {
      if (
        hoveredOutput &&
        hoveredOutput.type === source.type &&
        hoveredOutput.id === source.id
      ) {
        setHoveredOutput(null);
      }
    },
    [hoveredOutput, setHoveredOutput]
  );

  // ==========================================================================
  // BLOCK IO HANDLERS
  // ==========================================================================

  const applyBlockIO = useCallback(
    (
      blockId: string,
      nextInputCount: number,
      nextOutputCount: number,
      extra?: Partial<{ name: string; description: string; presetId: string }>
    ) => {
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
                ...extra,
              }
            : b
        )
      );
    },
    [setBlocks]
  );

  const changeBlockInputs = useCallback(
    (blockId: string, delta: number) => {
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;
      const newInputs = clamp(block.inputCount + delta, MIN_IO, MAX_IO);
      applyBlockIO(blockId, newInputs, block.outputCount, { presetId: "custom" });
    },
    [applyBlockIO, blocks]
  );

  const changeBlockOutputs = useCallback(
    (blockId: string, delta: number) => {
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;
      const newOutputs = clamp(block.outputCount + delta, MIN_IO, MAX_IO);
      applyBlockIO(blockId, block.inputCount, newOutputs, { presetId: "custom" });
    },
    [applyBlockIO, blocks]
  );

  const toggleInputRequired = useCallback(
    (blockId: string, index: number) => {
      setBlocks((prev) =>
        prev.map((b) => {
          if (b.id !== blockId) return b;
          if (index < 0 || index >= b.inputCount) return b;
          if (index < (b.mandatoryInputCount ?? 0)) return b;
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
          if (index < 0 || index >= b.outputCount) return b;
          if (index < (b.mandatoryOutputCount ?? 0)) return b;
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
          if (index < 0 || index >= t.inputCount) return t;
          if (index < (t.mandatoryInputCount ?? 0)) return t;
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
          if (index < 0 || index >= t.outputCount) return t;
          if (index < (t.mandatoryOutputCount ?? 0)) return t;
          const next = [...t.outputRequired];
          next[index] = !next[index];
          return { ...t, outputRequired: next };
        })
      );
    },
    [setTools]
  );

  // ==========================================================================
  // TOOLBAR HANDLERS
  // ==========================================================================

  const handleDownload = useCallback(() => {
    const triples = connections
      .filter((conn) => conn.from.type === "block" && conn.to.type === "block")
      .map((conn) => {
        const fromBlock = blocks.find((b) => b.id === conn.from.id);
        const toBlock = blocks.find((b) => b.id === conn.to.id);
        return {
          from: fromBlock?.name || conn.from.id,
          op: "seq",
          to: toBlock?.name || conn.to.id,
        };
      });

    const snapshot = {
      triples,
      metadata: {
        total_agents: blocks.length,
        total_triples: triples.length,
        operator_counts: countOperators(connections),
        estimated_latency_ms: 0,
        estimated_cost: 0,
      },
    };
    downloadWorkflow(snapshot);
  }, [blocks, connections]);

  const handleUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const src = JSON.parse(ev.target?.result as string);
          if (Array.isArray(src.blocks) && Array.isArray(src.connections)) {
            setNotes(src.notes ?? []);
            setBlocks(src.blocks ?? []);
            setTools(src.tools ?? []);
            setUploads(src.uploads ?? []);
            setOutputs(src.outputs ?? []);
            setSelectedEvals(src.evals ?? []);
            setTimeout(() => setConnections(src.connections ?? []), 50);
          }
        } catch {
          alert("Invalid workflow file");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [setBlocks, setConnections, setNotes, setOutputs, setSelectedEvals, setTools, setUploads]
  );

  const handleReset = useCallback(() => {
    resetWorkspace(reset);
  }, [reset, resetWorkspace]);

  const toggleEval = useCallback(
    (evalId: string) => {
      setSelectedEvals((prev) =>
        prev.includes(evalId)
          ? prev.filter((id) => id !== evalId)
          : [...prev, evalId]
      );
    },
    [setSelectedEvals]
  );

  // Add tool to block
  const addToolToBlock = useCallback(
    (blockId: string, toolName: string) => {
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;
      const palette = toolPalette.find((t) => t.name === toolName) ?? toolPalette[0];
      if (!palette) return;
      const handles = getBlockHandles(block);
      const toolId = `tool-${nextToolIdRef.current++}`;
      const toolX = block.x + handles.width / 2 - 90;
      const toolY = block.y + handles.height + 60;
      setTools((prev) => [...prev, { ...palette, id: toolId, x: toolX, y: toolY }]);
      const connId = `conn-${nextConnectionIdRef.current++}`;
      setConnections((prev) => [
        ...prev,
        {
          id: connId,
          from: { type: "tool", id: toolId, port: 0 },
          to: { type: "block", id: blockId, inputIndex: TOOL_PORT_OFFSET },
        },
      ]);
    },
    [blocks, getBlockHandles, setConnections, setTools, toolPalette]
  );

  // Set modal tool choice when modal opens
  useEffect(() => {
    if (modalBlockId) {
      setModalToolChoice(toolPalette[0]?.name ?? "");
    }
  }, [modalBlockId, setModalToolChoice, toolPalette]);

  // Theme classes
  const appThemeClass =
    theme === "dark"
      ? "bg-slate-950 text-slate-100"
      : "bg-slate-50 text-slate-900";

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div
      className={`relative h-screen w-screen overflow-hidden transition-colors duration-200 ${appThemeClass}`}
    >
      {/* Sidebar */}
      <Sidebar
        activePanel={activePanel}
        theme={theme}
        toolPalette={toolPalette}
        agentJsonInput={agentJsonInput}
        agentParseError={agentParseError}
        onPanelChange={setActivePanel}
        onThemeChange={(t) => {
          setUserThemeLocked(true);
          setTheme(t);
        }}
        onAgentJsonInputChange={setAgentJsonInput}
        onGenerateAgentsFromJson={() => {}}
        onBlockDragStart={handleBlockDragStart}
        onUploadDragStart={handleUploadDragStart}
        onOutputDragStart={handleOutputDragStart}
        onToolDragStart={handleToolDragStart}
      />

      {/* Main canvas area */}
      <main className="relative z-0 h-full w-full">
        {/* Toolbar */}
        <Toolbar
          theme={theme}
          fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
          onC3ANClick={() => window.open("https://c3an.aiisc.ai/", "_blank")}
          onAboutClick={() => setActivePanel("settings")}
          onEvalsClick={() => setShowEvalsModal(true)}
          onDownloadClick={handleDownload}
          onUploadClick={() => fileInputRef.current?.click()}
          onRunClick={() => {
            setActivePanel(null);
            setSelected(null);
          }}
          onResetClick={handleReset}
          onFileUpload={handleUpload}
        />

        {/* Canvas container */}
        <div
          ref={containerRef}
          className="absolute inset-0"
          style={{ touchAction: "none" }}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
          onPointerDownCapture={(event) => {
            const target = event.target as HTMLElement | null;
            if (
              target?.closest(
                "[data-note],[data-block],[data-tool],[data-upload],[data-output]"
              )
            )
              return;
            setSelected(null);
            setLinking(null);
            linkingRef.current = false;
          }}
        >
          <Background transform={transform} theme={theme} />

          {/* Transform layer */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
              transformOrigin: "0 0",
              width: "100%",
              height: "100%",
              pointerEvents: "auto",
            }}
            onPointerMove={moveLinking}
            onPointerUp={() => {
              if (linking) finalizeLinking();
            }}
          >
            {/* Connection lines */}
            <ConnectionLines
              connections={connections}
              linking={linking}
              selected={selected}
              getOutputAnchor={getOutputAnchor}
              getInputAnchor={getInputAnchor}
              onConnectionPointerDown={handleConnectionPointerDown}
            />

            {/* Agent blocks */}
            {blocks.map((block) => {
              const isActive =
                selected?.type === "block" && selected.id === block.id;
              const showConnections =
                isActive ||
                draggingBlockId === block.id ||
                Boolean(linking) ||
                hoveredBlockId === block.id;
              const toolIds = connections
                .filter(
                  (conn) =>
                    conn.from.type === "tool" &&
                    conn.to.type === "block" &&
                    conn.to.id === block.id
                )
                .map((conn) => conn.from.id);
              const toolCount = new Set(toolIds).size;
              const handles = getBlockHandles(block);

              return (
                <AgentBlock
                  key={block.id}
                  block={block}
                  handles={handles}
                  isActive={isActive}
                  isDragging={draggingBlockId === block.id}
                  showConnections={showConnections}
                  toolCount={toolCount}
                  mode={getBlockMode(block)}
                  onPointerDown={handleBlockPointerDown}
                  onPointerMove={handleBlockPointerMove}
                  onPointerUp={handleBlockPointerUp}
                  onRemove={handleRemoveBlock}
                  onDetailsClick={setModalBlockId}
                  onHoverEnter={setHoveredBlockId}
                  onHoverLeave={(id) =>
                    setHoveredBlockId((prev) => (prev === id ? null : prev))
                  }
                  onInputEnter={handleInputEnter}
                  onInputLeave={handleInputLeave}
                  onOutputEnter={handleOutputEnter}
                  onOutputLeave={handleOutputLeave}
                  onStartLinkingFromInput={startLinkingFromInput}
                  onStartLinkingFromOutput={startLinkingFromOutput}
                  onFinalizeLinking={finalizeLinking}
                  onMoveLinking={moveLinking}
                  onChangeInputs={changeBlockInputs}
                  onChangeOutputs={changeBlockOutputs}
                />
              );
            })}

            {/* Tool nodes */}
            {tools.map((tool) => {
              const isActive =
                selected?.type === "tool" && selected.id === tool.id;
              const handles = getToolHandles(tool);
              const showHandles =
                isActive ||
                draggingToolId === tool.id ||
                hoveredToolId === tool.id ||
                Boolean(linking);

              return (
                <ToolNode
                  key={tool.id}
                  tool={tool}
                  handles={handles}
                  isActive={isActive}
                  isDragging={draggingToolId === tool.id}
                  showHandles={showHandles}
                  onPointerDown={handleToolPointerDown}
                  onPointerMove={handleToolPointerMove}
                  onPointerUp={handleToolPointerUp}
                  onRemove={handleRemoveTool}
                  onDetailsClick={setModalToolId}
                  onHoverEnter={setHoveredToolId}
                  onHoverLeave={(id) =>
                    setHoveredToolId((prev) => (prev === id ? null : prev))
                  }
                  onOutputEnter={handleOutputEnter}
                  onOutputLeave={handleOutputLeave}
                  onStartLinkingFromOutput={startLinkingFromOutput}
                  onFinalizeLinking={finalizeLinking}
                  onMoveLinking={moveLinking}
                />
              );
            })}

            {/* Upload and Output nodes would be rendered here similarly */}
          </div>
        </div>
      </main>

      {/* Modals */}
      {modalBlockId &&
        (() => {
          const block = blocks.find((b) => b.id === modalBlockId);
          if (!block) return null;
          return (
            <BlockDetailsModal
              block={block}
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
          );
        })()}

      {modalToolId &&
        (() => {
          const tool = tools.find((t) => t.id === modalToolId);
          if (!tool) return null;
          return (
            <ToolDetailsModal
              tool={tool}
              connections={connections}
              onClose={() => setModalToolId(null)}
              onToggleInputRequired={toggleToolInputRequired}
              onToggleOutputRequired={toggleToolOutputRequired}
            />
          );
        })()}

      {showEvalsModal && (
        <EvalsModal
          evalOptions={evalOptions}
          selectedEvals={selectedEvals}
          onClose={() => setShowEvalsModal(false)}
          onToggleEval={toggleEval}
          onClearAll={() => setSelectedEvals([])}
        />
      )}

      {/* Footer */}
      <div className="absolute bottom-3 right-4 z-20 text-xs font-semibold text-slate-400">
        © 2025 All rights reserved
      </div>
    </div>
  );
}

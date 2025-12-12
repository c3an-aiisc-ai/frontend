// =============================================================================
// useWorkspace Hook - Manages workspace state and persistence
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Note,
  AgentBlock,
  ToolNode,
  UploadNode,
  OutputNode,
  Connection,
  Selection,
  ClipboardItem,
  Theme,
  PanelKey,
  LinkingState,
  LinkSource,
  LinkTarget,
  AnchorPoint,
  BlockHandles,
} from "../types";
import {
  STORAGE_KEY,
  AGENT_PRESETS,
  TOOL_PALETTE,
  MIN_IO,
  MAX_IO,
  TOOL_PORT_OFFSET,
} from "../constants";
import { clamp, resizeRequired, clampNames } from "../utils";

export function useWorkspace() {
  // Refs for ID counters
  const nextIdRef = useRef(1);
  const nextBlockIdRef = useRef(1);
  const nextToolIdRef = useRef(1);
  const nextUploadIdRef = useRef(1);
  const nextOutputIdRef = useRef(1);
  const nextConnectionIdRef = useRef(1);

  // Main state
  const [notes, setNotes] = useState<Note[]>([]);
  const [blocks, setBlocks] = useState<AgentBlock[]>([]);
  const [tools, setTools] = useState<ToolNode[]>([]);
  const [uploads, setUploads] = useState<UploadNode[]>([]);
  const [outputs, setOutputs] = useState<OutputNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [theme, setTheme] = useState<Theme>("dark");
  const [userThemeLocked, setUserThemeLocked] = useState(false);
  const [selectedEvals, setSelectedEvals] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<ClipboardItem | null>(null);
  const [selected, setSelected] = useState<Selection>(null);
  const [activePanel, setActivePanel] = useState<PanelKey | null>("blocks");

  // Linking state
  const [linking, setLinking] = useState<LinkingState>(null);
  const linkingRef = useRef(false);
  const [hoveredInput, setHoveredInput] = useState<{
    type: "block" | "tool" | "output";
    id: string;
    inputIndex?: number;
  } | null>(null);
  const [hoveredOutput, setHoveredOutput] = useState<LinkSource | null>(null);

  // Hover state
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [hoveredToolId, setHoveredToolId] = useState<string | null>(null);
  const [hoveredUploadId, setHoveredUploadId] = useState<string | null>(null);
  const [hoveredOutputId, setHoveredOutputId] = useState<string | null>(null);

  // Dragging state
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [draggingToolId, setDraggingToolId] = useState<string | null>(null);
  const [draggingUploadId, setDraggingUploadId] = useState<string | null>(null);
  const [draggingOutputId, setDraggingOutputId] = useState<string | null>(null);

  // Drag offset refs
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const blockDragOffsetRef = useRef({ x: 0, y: 0 });
  const toolDragOffsetRef = useRef({ x: 0, y: 0 });
  const uploadDragOffsetRef = useRef({ x: 0, y: 0 });
  const outputDragOffsetRef = useRef({ x: 0, y: 0 });

  // Modal state
  const [modalBlockId, setModalBlockId] = useState<string | null>(null);
  const [modalToolId, setModalToolId] = useState<string | null>(null);
  const [modalToolChoice, setModalToolChoice] = useState<string>("");
  const [showEvalsModal, setShowEvalsModal] = useState(false);

  // JSON input state
  const [agentJsonInput, setAgentJsonInput] = useState<string>("input json here");
  const [agentParseError, setAgentParseError] = useState<string | null>(null);

  // Update linkingRef when linking changes
  useEffect(() => {
    linkingRef.current = Boolean(linking);
  }, [linking]);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      setNotes(parsed.notes ?? []);
      setBlocks(parsed.blocks ?? []);
      setTools(parsed.tools ?? []);
      setUploads(parsed.uploads ?? []);
      setOutputs(parsed.outputs ?? []);
      setConnections(parsed.connections ?? []);
      setTheme(parsed.theme ?? "dark");
      nextBlockIdRef.current = parsed.nextBlockId ?? nextBlockIdRef.current;
      nextToolIdRef.current = parsed.nextToolId ?? nextToolIdRef.current;
      nextUploadIdRef.current = parsed.nextUploadId ?? nextUploadIdRef.current;
      nextOutputIdRef.current = parsed.nextOutputId ?? nextOutputIdRef.current;
      nextConnectionIdRef.current = parsed.nextConnectionId ?? nextConnectionIdRef.current;
      nextIdRef.current = parsed.nextNoteId ?? nextIdRef.current;
    } catch {
      // ignore bad saves
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    const snapshot = {
      notes,
      blocks,
      tools,
      uploads,
      outputs,
      connections,
      theme,
      nextBlockId: nextBlockIdRef.current,
      nextToolId: nextToolIdRef.current,
      nextUploadId: nextUploadIdRef.current,
      nextOutputId: nextOutputIdRef.current,
      nextConnectionId: nextConnectionIdRef.current,
      nextNoteId: nextIdRef.current,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }, [notes, blocks, tools, uploads, outputs, connections, theme]);

  // System theme detection
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

  // Reset workspace
  const resetWorkspace = useCallback((resetZoom: () => void) => {
    resetZoom();
    setNotes([]);
    setBlocks([]);
    setTools([]);
    setUploads([]);
    setOutputs([]);
    setConnections([]);
    setLinking(null);
    setHoveredInput(null);
    setHoveredOutput(null);
    setSelected(null);
    setDraggingNoteId(null);
    setDraggingBlockId(null);
    setDraggingToolId(null);
    setDraggingUploadId(null);
    setDraggingOutputId(null);
    setHoveredBlockId(null);
    setHoveredToolId(null);
    setHoveredUploadId(null);
    setHoveredOutputId(null);
    dragOffsetRef.current = { x: 0, y: 0 };
    blockDragOffsetRef.current = { x: 0, y: 0 };
    toolDragOffsetRef.current = { x: 0, y: 0 };
    uploadDragOffsetRef.current = { x: 0, y: 0 };
    outputDragOffsetRef.current = { x: 0, y: 0 };
    linkingRef.current = false;
    nextIdRef.current = 1;
    nextBlockIdRef.current = 1;
    nextToolIdRef.current = 1;
    nextUploadIdRef.current = 1;
    nextOutputIdRef.current = 1;
    nextConnectionIdRef.current = 1;
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Recalculate block ports based on connections
  const recalcBlockPorts = useCallback(
    (conns: Connection[], blocksState: AgentBlock[]) => {
      const maxInputs: Record<string, number> = {};
      const maxOutputs: Record<string, number> = {};
      conns.forEach((conn) => {
        if (conn.to.type === "block") {
          const idx = conn.to.inputIndex ?? 0;
          if (idx < TOOL_PORT_OFFSET) {
            maxInputs[conn.to.id] = Math.max(maxInputs[conn.to.id] ?? -1, idx);
          }
        }
        if (conn.from.type === "block") {
          maxOutputs[conn.from.id] = Math.max(
            maxOutputs[conn.from.id] ?? -1,
            conn.from.port
          );
        }
      });
      return blocksState.map((b) => {
        const desiredInputs = clamp((maxInputs[b.id] ?? -1) + 1, MIN_IO, MAX_IO);
        const desiredOutputs = clamp((maxOutputs[b.id] ?? -1) + 1, MIN_IO, MAX_IO);
        if (b.inputCount === desiredInputs && b.outputCount === desiredOutputs)
          return b;
        return {
          ...b,
          inputCount: desiredInputs,
          outputCount: desiredOutputs,
          inputRequired: resizeRequired(b.inputRequired, desiredInputs),
          outputRequired: resizeRequired(b.outputRequired, desiredOutputs),
          inputNames: clampNames(b.inputNames, desiredInputs),
          outputNames: clampNames(b.outputNames, desiredOutputs),
          presetId: "custom",
        };
      });
    },
    []
  );

  // Get block mode based on connections
  const getBlockMode = useCallback(
    (block: AgentBlock) => {
      const inbound = connections.filter(
        (conn) =>
          conn.to.type === "block" &&
          conn.to.id === block.id &&
          (conn.to.inputIndex ?? 0) < TOOL_PORT_OFFSET
      ).length;
      const outbound = connections.filter(
        (conn) => conn.from.type === "block" && conn.from.id === block.id
      ).length;

      if (block.inputCount > 1 || inbound > 1) return "aggregate";
      if (block.outputCount > 1 || outbound > 1) return "branch";
      if (inbound > 0 && outbound > 0) return "sequential";
      if (outbound > 0) return "sequential";
      return null;
    },
    [connections]
  );

  return {
    // State
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

    // Methods
    resetWorkspace,
    recalcBlockPorts,
    getBlockMode,
  };
}

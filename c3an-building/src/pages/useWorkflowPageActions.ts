import { useCallback } from "react";
import type { Dispatch, MutableRefObject, PointerEvent as ReactPointerEvent, SetStateAction } from "react";
import type {
  AgentBlock,
  AgentSpecTemplate,
  ClipboardItem,
  Connection,
  Note,
  OutputNode,
  PanelKey,
  Selection,
  ThemeMode,
  ToolNode,
  ToolPreset,
  UploadNode,
  LinkSource,
  LinkingState,
} from "../types/workflow";
import type { HoveredInput } from "../workflow/useLinkingState";

type Params = {
  toolPalette: ToolPreset[];
  setActivePanel: Dispatch<SetStateAction<PanelKey | null>>;
  setSelected: Dispatch<SetStateAction<Selection>>;
  setClipboard: Dispatch<SetStateAction<ClipboardItem | null>>;
  setHoveredBlockId: Dispatch<SetStateAction<string | null>>;
  setHoveredToolId: Dispatch<SetStateAction<string | null>>;
  setHoveredUploadId: Dispatch<SetStateAction<string | null>>;
  setHoveredOutputId: Dispatch<SetStateAction<string | null>>;
  setHoveredInput: Dispatch<SetStateAction<HoveredInput>>;
  setHoveredOutput: Dispatch<SetStateAction<LinkSource | null>>;
  setLinking: Dispatch<SetStateAction<LinkingState | null>>;
  linkingRef: MutableRefObject<boolean>;
  setDraggingNoteId: Dispatch<SetStateAction<string | null>>;
  setDraggingBlockId: Dispatch<SetStateAction<string | null>>;
  setDraggingToolId: Dispatch<SetStateAction<string | null>>;
  setDraggingUploadId: Dispatch<SetStateAction<string | null>>;
  setDraggingOutputId: Dispatch<SetStateAction<string | null>>;
  setUserThemeLocked: Dispatch<SetStateAction<boolean>>;
  setTheme: Dispatch<SetStateAction<ThemeMode>>;
  setModalToolChoice: Dispatch<SetStateAction<string>>;
  setModalBlockId: Dispatch<SetStateAction<string | null>>;
  setNotes: Dispatch<SetStateAction<Note[]>>;
  setBlocks: Dispatch<SetStateAction<AgentBlock[]>>;
  setTools: Dispatch<SetStateAction<ToolNode[]>>;
  setUploads: Dispatch<SetStateAction<UploadNode[]>>;
  setOutputs: Dispatch<SetStateAction<OutputNode[]>>;
  setConnections: Dispatch<SetStateAction<Connection[]>>;
  setSelectedEvals: Dispatch<SetStateAction<string[]>>;
  setAgentSpecTemplate: Dispatch<SetStateAction<AgentSpecTemplate | null>>;
  reset: () => void;
  nextBlockIdRef: MutableRefObject<number>;
  nextToolIdRef: MutableRefObject<number>;
  nextUploadIdRef: MutableRefObject<number>;
  nextOutputIdRef: MutableRefObject<number>;
  nextConnectionIdRef: MutableRefObject<number>;
  nextIdRef: MutableRefObject<number>;
};

export function useWorkflowPageActions({
  toolPalette,
  setActivePanel,
  setSelected,
  setClipboard,
  setHoveredBlockId,
  setHoveredToolId,
  setHoveredUploadId,
  setHoveredOutputId,
  setHoveredInput,
  setHoveredOutput,
  setLinking,
  linkingRef,
  setDraggingNoteId,
  setDraggingBlockId,
  setDraggingToolId,
  setDraggingUploadId,
  setDraggingOutputId,
  setUserThemeLocked,
  setTheme,
  setModalToolChoice,
  setModalBlockId,
  setNotes,
  setBlocks,
  setTools,
  setUploads,
  setOutputs,
  setConnections,
  setSelectedEvals,
  setAgentSpecTemplate,
  reset,
  nextBlockIdRef,
  nextToolIdRef,
  nextUploadIdRef,
  nextOutputIdRef,
  nextConnectionIdRef,
  nextIdRef,
}: Params) {
  const resetInteractionState = useCallback(() => {
    setSelected(null);
    setClipboard(null);
    setHoveredBlockId(null);
    setHoveredToolId(null);
    setHoveredUploadId(null);
    setHoveredOutputId(null);
    setHoveredInput(null);
    setHoveredOutput(null);
    setLinking(null);
    linkingRef.current = false;
    setDraggingNoteId(null);
    setDraggingBlockId(null);
    setDraggingToolId(null);
    setDraggingUploadId(null);
    setDraggingOutputId(null);
  }, [
    linkingRef,
    setClipboard,
    setDraggingBlockId,
    setDraggingNoteId,
    setDraggingOutputId,
    setDraggingToolId,
    setDraggingUploadId,
    setHoveredBlockId,
    setHoveredInput,
    setHoveredOutput,
    setHoveredOutputId,
    setHoveredToolId,
    setHoveredUploadId,
    setLinking,
    setSelected,
  ]);

  const handleTogglePanel = useCallback(
    (panel: PanelKey) => {
      setActivePanel((prev) => (prev === panel ? null : panel));
    },
    [setActivePanel],
  );

  const handleOpenAbout = useCallback(() => {
    setActivePanel("settings");
  }, [setActivePanel]);

  const handleOpenC3an = useCallback(() => {
    window.open("https://c3an.aiisc.ai/", "_blank");
  }, []);

  const handleSelectTheme = useCallback(
    (mode: ThemeMode) => {
      setUserThemeLocked(true);
      setTheme(mode);
    },
    [setTheme, setUserThemeLocked],
  );

  const handleClearSelection = useCallback(() => setSelected(null), [setSelected]);

  const openBlockModal = useCallback(
    (blockId: string) => {
      setModalToolChoice(toolPalette[0]?.name ?? "");
      setModalBlockId(blockId);
    },
    [setModalBlockId, setModalToolChoice, toolPalette],
  );

  const handleCanvasPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-note],[data-block],[data-tool],[data-upload],[data-output]")) return;
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
    [
      linkingRef,
      setHoveredBlockId,
      setHoveredInput,
      setHoveredOutput,
      setHoveredOutputId,
      setHoveredToolId,
      setHoveredUploadId,
      setLinking,
      setSelected,
    ],
  );

  const handleRun = useCallback(() => {
    setActivePanel(null);
    setSelected(null);
  }, [setActivePanel, setSelected]);

  const handleResetWorkspace = useCallback(() => {
    resetInteractionState();
    reset();
    setNotes([]);
    setBlocks([]);
    setTools([]);
    setUploads([]);
    setOutputs([]);
    setConnections([]);
    setSelectedEvals([]);
    setAgentSpecTemplate(null);
    nextBlockIdRef.current = 1;
    nextToolIdRef.current = 1;
    nextUploadIdRef.current = 1;
    nextOutputIdRef.current = 1;
    nextConnectionIdRef.current = 1;
    nextIdRef.current = 1;
  }, [
    nextBlockIdRef,
    nextConnectionIdRef,
    nextIdRef,
    nextOutputIdRef,
    nextToolIdRef,
    nextUploadIdRef,
    reset,
    resetInteractionState,
    setAgentSpecTemplate,
    setBlocks,
    setConnections,
    setNotes,
    setOutputs,
    setSelectedEvals,
    setTools,
    setUploads,
  ]);

  const toggleEval = useCallback(
    (evalId: string) => {
      setSelectedEvals((prev) => (prev.includes(evalId) ? prev.filter((id) => id !== evalId) : [...prev, evalId]));
    },
    [setSelectedEvals],
  );

  return {
    resetInteractionState,
    handleTogglePanel,
    handleOpenAbout,
    handleOpenC3an,
    handleSelectTheme,
    handleClearSelection,
    openBlockModal,
    handleCanvasPointerDown,
    handleRun,
    handleResetWorkspace,
    toggleEval,
  };
}

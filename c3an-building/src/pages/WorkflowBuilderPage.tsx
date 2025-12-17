import { useCallback } from "react";
import Canvas from "../components/canvas/Canvas";
import Sidebar from "../components/layout/Sidebar";
import TopBar from "../components/layout/TopBar";
import { usePanZoom } from "../hooks/zoom";
import "../App.css";
import { evalOptions, panelTabs, panelTitles, toolPalette } from "../workflow/constants";
import { useCanvasDnD } from "../workflow/useCanvasDnD";
import { useCanvasGeometry } from "../workflow/useCanvasGeometry";
import { useLinkingHandlers } from "../workflow/useLinkingHandlers";
import { useLinkingState } from "../workflow/useLinkingState";
import { usePanelDragHandlers } from "../workflow/usePanelDragHandlers";
import { useThemeMode } from "../workflow/useThemeMode";
import { useToolActions } from "../workflow/useToolActions";
import { useWorkflowImportExport } from "../workflow/useWorkflowImportExport";
import { useWorkflowIO } from "../workflow/useWorkflowIO";
import { useWorkflowNodeHandlers } from "../workflow/useWorkflowNodeHandlers";
import { useWorkflowPersistence } from "../workflow/useWorkflowPersistence";
import { useWorkflowShortcuts } from "../workflow/useWorkflowShortcuts";
import { useWorkflowState } from "../workflow/useWorkflowState";
import { useWorldPoint } from "../workflow/useWorldPoint";
import { formatBytes } from "../workflow/utils";
import { useWorkflowPageActions } from "./useWorkflowPageActions";
import WorkflowModals from "./WorkflowModals";
import WorkflowSidebarPanels from "./WorkflowSidebarPanels";

export default function WorkflowBuilderPage() {
  const {
    activePanel,
    setActivePanel,
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
    clipboard,
    setClipboard,
    agentJsonInput,
    setAgentJsonInput,
    agentParseError,
    setAgentParseError,
    agentSpecTemplate,
    setAgentSpecTemplate,
    selected,
    setSelected,
    modalBlockId,
    setModalBlockId,
    modalToolId,
    setModalToolId,
    modalToolChoice,
    setModalToolChoice,
    showEvalsModal,
    setShowEvalsModal,
    selectedEvals,
    setSelectedEvals,
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
    fileInputRef,
    nextIdRef,
    nextBlockIdRef,
    nextToolIdRef,
    nextUploadIdRef,
    nextOutputIdRef,
    nextConnectionIdRef,
    dragOffsetRef,
    blockDragOffsetRef,
    toolDragOffsetRef,
    outputDragOffsetRef,
    uploadDragOffsetRef,
  } = useWorkflowState();

  const { theme, setTheme, setUserThemeLocked, appThemeClass, actionButtonClass } = useThemeMode("dark");

  const { linking, setLinking, hoveredInput, setHoveredInput, hoveredOutput, setHoveredOutput, linkingRef } =
    useLinkingState();

  const shouldAllowPan = useCallback(
    (event: PointerEvent) => {
      if (linkingRef.current) return false;
      const target = event.target as HTMLElement | null;
      return !target?.closest("[data-note],[data-block],[data-tool],[data-upload],[data-output]");
    },
    [linkingRef],
  );

  const { containerRef, transform, reset } = usePanZoom({
    initial: { x: 0, y: 0, zoom: 1 },
    shouldAllowPan,
    isPanDisabled: () => linkingRef.current,
  });

  const toWorldPoint = useWorldPoint({ containerRef, transform });

  const io = useWorkflowIO({
    blocks,
    setBlocks,
    setTools,
    setConnections,
  });

  const geometry = useCanvasGeometry({
    blocks,
    tools,
    uploads,
    outputs,
    connections,
    linking,
    hoveredInput,
    hoveredBlockId,
  });

  const linkingHandlers = useLinkingHandlers({
    blocks,
    connections,
    setBlocks,
    setConnections,
    getInputAnchor: geometry.getInputAnchor,
    getOutputAnchor: geometry.getOutputAnchor,
    toWorldPoint,
    applyBlockIO: io.applyBlockIO,
    recalcBlockPorts: io.recalcBlockPorts,
    nextConnectionIdRef,
    hoveredBlockId,
    linking,
    setLinking,
    hoveredInput,
    setHoveredInput,
    hoveredOutput,
    setHoveredOutput,
    linkingRef,
  });

  const nodeHandlers = useWorkflowNodeHandlers({
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
    setConnections,
    selected,
    setSelected,
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
    toWorldPoint,
    linkingRef,
    recalcBlockPorts: io.recalcBlockPorts,
  });

  const { handleCanvasDragOver, handleCanvasDrop } = useCanvasDnD({
    containerRef,
    transform,
    toolPalette,
    setNotes,
    setBlocks,
    setTools,
    setUploads,
    setOutputs,
    nextIdRef,
    nextBlockIdRef,
    nextToolIdRef,
    nextUploadIdRef,
    nextOutputIdRef,
  });

  const { handleBlockDragStart, handleUploadDragStart, handleOutputDragStart, handleToolDragStart } =
    usePanelDragHandlers();

  const {
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
  } = useWorkflowPageActions({
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
  });

  const { handleGenerateAgentsFromJson, handleUpload, handleDownloadJson, applyImportedWorkspace, persistWorkspace } =
    useWorkflowImportExport({
      agentJsonInput,
      setAgentParseError,
      agentSpecTemplate,
      setAgentSpecTemplate,
      notes,
      blocks,
      tools,
      uploads,
      outputs,
      connections,
      selectedEvals,
      theme,
      setTheme,
      setNotes,
      setBlocks,
      setTools,
      setUploads,
      setOutputs,
      setConnections,
      setSelectedEvals,
      nextIdRef,
      nextBlockIdRef,
      nextToolIdRef,
      nextUploadIdRef,
      nextOutputIdRef,
      nextConnectionIdRef,
      toolPalette,
      resetInteractionState,
    });

  useWorkflowPersistence({
    applyImportedWorkspace,
    persistWorkspace,
    nextBlockIdRef,
    nextToolIdRef,
    nextUploadIdRef,
    nextOutputIdRef,
    nextConnectionIdRef,
    nextIdRef,
  });

  useWorkflowShortcuts({
    selected,
    clipboard,
    setClipboard,
    setSelected,
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
    nextIdRef,
    nextBlockIdRef,
    nextToolIdRef,
    nextUploadIdRef,
    nextOutputIdRef,
    onRemoveNote: nodeHandlers.handleRemoveNote,
    onRemoveBlock: nodeHandlers.handleRemoveBlock,
    onRemoveTool: nodeHandlers.handleRemoveTool,
    onRemoveUpload: nodeHandlers.handleRemoveUpload,
    onRemoveOutput: nodeHandlers.handleRemoveOutput,
    onRemoveConnection: nodeHandlers.handleRemoveConnection,
  });

  const { addToolToBlock } = useToolActions({
    blocks,
    toolPalette,
    getBlockHandles: geometry.getBlockHandles,
    setTools,
    setBlocks,
    setConnections,
    recalcBlockPorts: io.recalcBlockPorts,
    nextToolIdRef,
    nextConnectionIdRef,
  });

  return (
    <div className={`relative h-screen w-screen overflow-hidden transition-colors duration-200 ${appThemeClass}`}>
      <Sidebar
        activePanel={activePanel}
        panelTabs={panelTabs}
        panelTitles={panelTitles}
        theme={theme}
        onTogglePanel={handleTogglePanel}
        onClosePanel={() => setActivePanel(null)}
      >
        <WorkflowSidebarPanels
          activePanel={activePanel}
          theme={theme}
          agentJsonInput={agentJsonInput}
          agentParseError={agentParseError}
          onAgentJsonChange={setAgentJsonInput}
          onGenerateAgents={handleGenerateAgentsFromJson}
          onBlockDragStart={handleBlockDragStart}
          onUploadDragStart={handleUploadDragStart}
          onOutputDragStart={handleOutputDragStart}
          toolPalette={toolPalette}
          onToolDragStart={handleToolDragStart}
          onSelectTheme={handleSelectTheme}
          onClearSelection={handleClearSelection}
        />
      </Sidebar>

      <main className="relative z-0 h-full w-full">
        <TopBar
          actionButtonClass={actionButtonClass}
          fileInputRef={fileInputRef}
          onUploadChange={handleUpload}
          onOpenC3AN={handleOpenC3an}
          onOpenAbout={handleOpenAbout}
          onNavigatePlanning={() => {
            window.location.hash = "#/planning";
          }}
          onNavigateEvaluation={() => {
            window.location.hash = "#/evaluation";
          }}
          onShowEvals={() => setShowEvalsModal(true)}
          onDownloadJson={handleDownloadJson}
          onRun={handleRun}
          onReset={handleResetWorkspace}
        />
        <Canvas
          containerRef={containerRef}
          transform={transform}
          theme={theme}
          state={{
            linking,
            selected,
            connections,
            blocks,
            tools,
            uploads,
            outputs,
            notes,
            draggingBlockId,
            draggingToolId,
            draggingUploadId,
            draggingOutputId,
            draggingNoteId,
            hoveredBlockId,
            hoveredToolId,
            hoveredUploadId,
            hoveredOutputId,
          }}
          handlers={{
            onCanvasDragOver: handleCanvasDragOver,
            onCanvasDrop: handleCanvasDrop,
            onCanvasPointerDown: handleCanvasPointerDown,
            onMoveLinking: linkingHandlers.moveLinking,
            onFinalizeLinking: linkingHandlers.finalizeLinking,
            onClearSelection: handleClearSelection,
            onOpenBlockModal: openBlockModal,
            onOpenToolModal: setModalToolId,
            onRemoveBlock: nodeHandlers.handleRemoveBlock,
            onRemoveTool: nodeHandlers.handleRemoveTool,
            onRemoveUpload: nodeHandlers.handleRemoveUpload,
            onRemoveOutput: nodeHandlers.handleRemoveOutput,
            onRemoveNote: nodeHandlers.handleRemoveNote,
            onClearUpload: nodeHandlers.handleClearUpload,
            onUploadFileChange: nodeHandlers.handleUploadFileChange,
            onOutputFormatChange: nodeHandlers.handleOutputFormatChange,
            onOutputFormatBlur: nodeHandlers.handleOutputFormatBlur,
            onBlockPointerDown: nodeHandlers.handleBlockPointerDown,
            onBlockPointerMove: nodeHandlers.handleBlockPointerMove,
            onBlockPointerUp: nodeHandlers.handleBlockPointerUp,
            onToolPointerDown: nodeHandlers.handleToolPointerDown,
            onToolPointerMove: nodeHandlers.handleToolPointerMove,
            onToolPointerUp: nodeHandlers.handleToolPointerUp,
            onUploadPointerDown: nodeHandlers.handleUploadPointerDown,
            onUploadPointerMove: nodeHandlers.handleUploadPointerMove,
            onUploadPointerUp: nodeHandlers.handleUploadPointerUp,
            onOutputPointerDown: nodeHandlers.handleOutputPointerDown,
            onOutputPointerMove: nodeHandlers.handleOutputPointerMove,
            onOutputPointerUp: nodeHandlers.handleOutputPointerUp,
            onNotePointerDown: nodeHandlers.handleNotePointerDown,
            onNotePointerMove: nodeHandlers.handleNotePointerMove,
            onNotePointerUp: nodeHandlers.handleNotePointerUp,
            onStartLinkingFromInput: linkingHandlers.startLinkingFromInput,
            onStartLinkingFromOutput: linkingHandlers.startLinkingFromOutput,
            onInputEnter: linkingHandlers.handleInputEnter,
            onInputLeave: linkingHandlers.handleInputLeave,
            onOutputEnter: linkingHandlers.handleOutputEnter,
            onOutputLeave: linkingHandlers.handleOutputLeave,
            onConnectionPointerDown: linkingHandlers.handleConnectionPointerDown,
            onChangeBlockInputs: io.changeBlockInputs,
            onChangeBlockOutputs: io.changeBlockOutputs,
          }}
          helpers={{
            getBlockHandles: geometry.getBlockHandles,
            getToolHandles: geometry.getToolHandles,
            getUploadHandles: geometry.getUploadHandles,
            getOutputHandles: geometry.getOutputHandles,
            getBlockMode: geometry.getBlockMode,
            getOutputAnchor: geometry.getOutputAnchor,
            getInputAnchor: geometry.getInputAnchor,
            buildConnectionPath: geometry.buildConnectionPath,
            formatBytes,
          }}
          setHoveredBlockId={setHoveredBlockId}
          setHoveredToolId={setHoveredToolId}
          setHoveredUploadId={setHoveredUploadId}
          setHoveredOutputId={setHoveredOutputId}
        />
      </main>

      <WorkflowModals
        modalBlockId={modalBlockId}
        modalToolId={modalToolId}
        showEvalsModal={showEvalsModal}
        blocks={blocks}
        tools={tools}
        connections={connections}
        toolPalette={toolPalette}
        modalToolChoice={modalToolChoice}
        onChangeToolChoice={setModalToolChoice}
        onAddTool={addToolToBlock}
        onCloseBlock={() => setModalBlockId(null)}
        onCloseTool={() => setModalToolId(null)}
        getBlockMode={geometry.getBlockMode}
        toggleInputRequired={io.toggleInputRequired}
        toggleOutputRequired={io.toggleOutputRequired}
        toggleToolInputRequired={io.toggleToolInputRequired}
        toggleToolOutputRequired={io.toggleToolOutputRequired}
        evalOptions={evalOptions}
        selectedEvals={selectedEvals}
        onToggleEval={toggleEval}
        onClearEvals={() => setSelectedEvals([])}
        onCloseEvals={() => setShowEvalsModal(false)}
      />

      <div className="absolute bottom-3 right-4 z-20 text-xs font-semibold text-slate-400">
        © 2025 All rights reserved
      </div>
    </div>
  );
}

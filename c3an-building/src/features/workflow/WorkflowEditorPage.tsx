// =============================================================================
// Workflow Editor Page - Main canvas page component
// =============================================================================

import { useCallback, useMemo, useRef, useState } from "react";
import { Sidebar, Toolbar } from "./components/ui";
import { AgentCanvasView, PlanCanvasView } from "./components/canvas";
import { BlockDetailsModal, ToolDetailsModal, EvalsModal } from "./components/modals";
import { usePanZoom, useWorkspace } from "./hooks";
import { usePlanBench } from "./hooks/usePlanBench";
import { usePlanWorkflow } from "./hooks/usePlanWorkflow";
import { useWorkflowImport } from "./hooks/useWorkflowImport";
import { useWorkflowDownload } from "./hooks/useWorkflowDownload";
import { useNodeHandles } from "./hooks/useNodeHandles";
import { useBlockIO } from "./hooks/useBlockIO";
import { useCanvasDrop } from "./hooks/useCanvasDrop";
import { useCanvasDragHandlers } from "./hooks/useCanvasDragHandlers";
import { useCanvasLinking } from "./hooks/useCanvasLinking";
import { useCanvasSelection } from "./hooks/useCanvasSelection";
import { useWorkspaceActions } from "./hooks/useWorkspaceActions";
import { useWorkflowHotkeys } from "./hooks/useWorkflowHotkeys";
import { useIdCounters } from "./hooks/useIdCounters";
import { useSidebarDragHandlers } from "./hooks/useSidebarDragHandlers";
import { useHandleVisibility } from "./hooks/useHandleVisibility";
import { useWorkflowReset } from "./hooks/useWorkflowReset";
import { TOOL_PALETTE, EVAL_OPTIONS, AGENT_REGISTRY_AGENTS } from "../../shared/constants";
import { readCustomAgents } from "../../shared/utils/customAgents";
import { readCustomPlans } from "../../shared/utils/customPlans";
import type { PlanningBlock, ViewMode } from "../../shared/types";

export default function WorkflowEditorPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("agent");
  const [plans, setPlans] = useState<PlanningBlock[]>([]);
  const nextPlanIdRef = useRef(1);
  const [planCanvasKey, setPlanCanvasKey] = useState(0);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);

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
  const availableAgents = useMemo(() => [...AGENT_REGISTRY_AGENTS, ...customAgents], [customAgents]);

  const { bumpIdCounters } = useIdCounters({ nextBlockIdRef, nextToolIdRef, nextConnectionIdRef });

  const { applyPlanJson, handleUpload } = useWorkflowImport({
    availableAgents,
    agentPlanTemplateRef,
    bumpIdCounters,
    linkingRef,
    recalcBlockPorts,
    setBlocks,
    setTools,
    setConnections,
    setSelectedEvals,
    setSelected,
    setHoveredInput,
    setHoveredOutput,
    setHoveredBlockId,
    setHoveredToolId,
    setLinking,
    setViewMode,
  });

  const {
    buildPlanWorkflowSnapshot,
    saveActivePlanWorkflow,
    clearWorkspaceUIState,
    handleEnterPlanWorkflow,
  } = usePlanWorkflow({
    activePlanId,
    setActivePlanId,
    blocks,
    tools,
    connections,
    selectedEvals,
    setPlans,
    setViewMode,
    setBlocks,
    setTools,
    setConnections,
    setSelectedEvals,
    setSelected,
    setHoveredInput,
    setHoveredOutput,
    setHoveredBlockId,
    setHoveredToolId,
    setLinking,
    linkingRef,
    recalcBlockPorts,
    bumpIdCounters,
    applyPlanJson,
    agentPlanTemplateRef,
  });

  usePlanBench({
    applyPlanJson,
    nextPlanIdRef,
    planLinkFromRef,
    setPlans,
    setPlanConnections,
    setActivePlanId,
    setViewMode,
    setActivePanel,
  });

  const handleC3ANClick = useCallback(() => {
    window.open("https://c3an.aiisc.ai/", "_blank", "noopener,noreferrer");
  }, []);

  const { handleAgentDragStart, handlePlanDragStart, handleToolDragStart } = useSidebarDragHandlers();


  const { containerRef, containerEl, transform, reset } = usePanZoom({
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
      const el = containerEl;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      return {
        x: (localX - transform.x) / transform.zoom,
        y: (localY - transform.y) / transform.zoom,
      };
    },
    [containerEl, transform.x, transform.y, transform.zoom]
  );

  const { getBlockHandles, getToolHandles } = useNodeHandles({
    connections,
    linking,
    hoveredBlockId,
  });

  const { addToolToBlock, changeBlockInputs, changeBlockOutputs } = useBlockIO({
    blocks,
    toolPalette,
    setBlocks,
    setTools,
    setConnections,
    getBlockHandles,
    nextToolIdRef,
    nextConnectionIdRef,
    recalcBlockPorts,
  });

  const { handleCanvasDragOver, handleCanvasDrop } = useCanvasDrop({
    availableAgents,
    toolPalette,
    nextBlockIdRef,
    nextToolIdRef,
    setBlocks,
    setTools,
    toWorldPoint,
  });

  const { blockDrag, toolDrag } = useCanvasDragHandlers({
    blocks,
    tools,
    setBlocks,
    setTools,
    setSelected,
    draggingBlockId,
    draggingToolId,
    setDraggingBlockId,
    setDraggingToolId,
    blockDragOffsetRef,
    toolDragOffsetRef,
    linkingRef,
    toWorldPoint,
  });

  const {
    getOutputAnchor,
    getInputAnchor,
    handleConnectionPointerDown,
    startLinkingFromInput,
    startLinkingFromOutput,
    moveLinking,
    finalizeLinking,
  } = useCanvasLinking({
    blocks,
    tools,
    linking,
    hoveredBlockId,
    hoveredInput,
    hoveredOutput,
    setLinking,
    setHoveredInput,
    setHoveredOutput,
    setConnections,
    setBlocks,
    recalcBlockPorts,
    linkingRef,
    nextConnectionIdRef,
    getBlockHandles,
    getToolHandles,
    toWorldPoint,
  });

  const { handleCanvasPointerDown } = useCanvasSelection({
    linkingRef,
    setSelected,
    setHoveredInput,
    setHoveredOutput,
    setHoveredBlockId,
    setHoveredToolId,
    setLinking,
  });

  const {
    handleRemoveBlock,
    handleRemoveTool,
    handleRemoveConnection,
    toggleInputRequired,
    toggleOutputRequired,
    toggleToolInputRequired,
    toggleToolOutputRequired,
    toggleEval,
  } = useWorkspaceActions({
    selected,
    setBlocks,
    setTools,
    setConnections,
    setSelected,
    setSelectedEvals,
    recalcBlockPorts,
  });

  useWorkflowHotkeys({
    blocks,
    tools,
    selected,
    clipboard,
    setBlocks,
    setTools,
    setClipboard,
    nextBlockIdRef,
    nextToolIdRef,
    handleRemoveBlock,
    handleRemoveTool,
    handleRemoveConnection,
  });

  const { downloadLabel, handleDownload } = useWorkflowDownload({ viewMode, activePlanId, plans, availableAgents, buildPlanWorkflowSnapshot });

  const { handleReset } = useWorkflowReset({
    reset,
    resetWorkspace,
    setPlans,
    setPlanCanvasKey,
    setActivePlanId,
    agentPlanTemplateRef,
    setSelectedEvals,
  });

  const { showHandlesForId } = useHandleVisibility({
    linking,
    hoveredBlockId,
    hoveredToolId,
    draggingBlockId,
    draggingToolId,
    selected,
  });

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
            saveActivePlanWorkflow();
            planLinkFromRef.current = null;
          }
          setViewMode(mode);
          setModalBlockId(null);
          setModalToolId(null);
          clearWorkspaceUIState();
        }}
        onAgentDragStart={handleAgentDragStart}
        onPlanDragStart={handlePlanDragStart}
        onToolDragStart={handleToolDragStart}
      />

      <Toolbar
        theme={theme}
        fileInputRef={fileInputRef}
        downloadLabel={downloadLabel}
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
          <PlanCanvasView
            key={planCanvasKey}
            theme={theme}
            plans={plans}
            connections={planConnections}
            planLinkFromRef={planLinkFromRef}
            setPlans={setPlans}
            setPlanConnections={setPlanConnections}
            setActivePlanId={setActivePlanId}
            activePlanId={activePlanId}
            nextPlanIdRef={nextPlanIdRef}
            onEnterWorkflow={handleEnterPlanWorkflow}
          />
        ) : (
          <AgentCanvasView
            containerRef={containerRef}
            transform={transform}
            theme={theme}
            blocks={blocks}
            tools={tools}
            connections={connections}
            linking={linking}
            selected={selected}
            draggingBlockId={draggingBlockId}
            draggingToolId={draggingToolId}
            getBlockHandles={getBlockHandles}
            getToolHandles={getToolHandles}
            getBlockMode={getBlockMode}
            showHandlesForId={showHandlesForId}
            blockDrag={blockDrag}
            toolDrag={toolDrag}
            onCanvasDragOver={handleCanvasDragOver}
            onCanvasDrop={handleCanvasDrop}
            onCanvasPointerDown={handleCanvasPointerDown}
            onMoveLinking={moveLinking}
            onFinalizeLinking={finalizeLinking}
            onConnectionPointerDown={handleConnectionPointerDown}
            onRemoveBlock={handleRemoveBlock}
            onRemoveTool={handleRemoveTool}
            onBlockDetailsClick={setModalBlockId}
            onToolDetailsClick={setModalToolId}
            onBlockHoverEnter={setHoveredBlockId}
            onBlockHoverLeave={() => setHoveredBlockId(null)}
            onToolHoverEnter={setHoveredToolId}
            onToolHoverLeave={() => setHoveredToolId(null)}
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
            onChangeInputs={changeBlockInputs}
            onChangeOutputs={changeBlockOutputs}
            getInputAnchor={getInputAnchor}
            getOutputAnchor={getOutputAnchor}
          />
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

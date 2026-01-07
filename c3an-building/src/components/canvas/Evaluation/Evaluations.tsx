import React, { useState } from 'react'
import Sidebar from "../../panels/Sidebar";
import BlocksPanel from "../../panels/BlocksPanel";  
import Background from "../../ui/Background";
import AgentBlock from "../AgentBlock";
import ToolNode from "../ToolNode";
import UploadNode from "../UploadNode";
import type { PanelKey, Theme, LinkSource, LinkTarget } from "../../../types";

const EvalsDashboard = () => {
  // State management
  const [activePanel, setActivePanel] = useState<PanelKey>('agents');
  const [theme, setTheme] = useState<Theme>('light');
  const [agentJsonInput, setAgentJsonInput] = useState('');
  const [agentParseError, setAgentParseError] = useState<string | null>(null);
  const [planningName, setPlanningName] = useState('');
  
  // Canvas state
  const [blocks, setBlocks] = useState<any[]>([]);
  const [tools, setTools] = useState<any[]>([]);
  const [uploads, setUploads] = useState<any[]>([]);

  // Tool palette
  const toolPalette = [
    {
      id: 'search',
      name: 'Web Search',
      tagline: 'Search the web',
      gradient: 'from-blue-500 to-cyan-500',
      ring: 'ring-blue-500',
      accent: 'bg-blue-500',
      x: 0,
      y: 0,
      inputCount: 1,
      outputCount: 1,
      inputRequired: [true],
      outputRequired: [true],
    },
  ];

  // Sidebar handlers - MAKE SURE THESE ARE CURRIED FUNCTIONS
  const handlePanelChange = (panel: PanelKey | null) => {
    if (panel) {
      setActivePanel(panel);
    }
  };
  
  const handleThemeChange = (newTheme: Theme) => setTheme(newTheme);
  const handleAgentJsonInputChange = (value: string) => setAgentJsonInput(value);
  const handleGenerateAgentsFromJson = () => console.log('Generate agents');
  const handleOpenPlanning = () => console.log('Open planning');
  const handleAddPlanBlock = () => console.log('Add plan block');
  
  // These must be curried functions: (name: string) => (event) => void
  const handleBlockDragStart = (blockName: string) => (e: React.DragEvent<HTMLDivElement>) => {
    console.log('Block drag start:', blockName);
  };

  const handleUploadDragStart = (uploadName: string) => (e: React.DragEvent<HTMLDivElement>) => {
    console.log('Upload drag start:', uploadName);
  };

  const handleOutputDragStart = (outputName: string) => (e: React.DragEvent<HTMLDivElement>) => {
    console.log('Output drag start:', outputName);
  };

  const handleToolDragStart = (toolName: string) => (e: React.DragEvent<HTMLDivElement>) => {
    console.log('Tool drag start:', toolName);
  };

  // Block handlers
  const createPointerDownHandler = (id: string) => (e: React.PointerEvent<HTMLDivElement>) => {
    console.log('Pointer down:', id);
  };

  const createPointerMoveHandler = (id: string) => (e: React.PointerEvent<HTMLDivElement>) => {
    console.log('Pointer move:', id);
  };

  const createPointerUpHandler = (id: string) => (e: React.PointerEvent<HTMLDivElement>) => {
    console.log('Pointer up:', id);
  };

  const handleRemove = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
    setTools(prev => prev.filter(t => t.id !== id));
    setUploads(prev => prev.filter(u => u.id !== id));
  };

  const handleDetailsClick = (id: string) => {
    console.log('Details clicked:', id);
  };

  const handleHoverEnter = (id: string) => {
    console.log('Hover enter:', id);
  };

  const handleHoverLeave = (id: string) => {
    console.log('Hover leave:', id);
  };

  const createInputEnterHandler = (target: { type: "block"; id: string; inputIndex: number }) => () => {
    console.log('Input enter:', target);
  };

  const createInputLeaveHandler = (target: { type: "block"; id: string; inputIndex: number }) => () => {
    console.log('Input leave:', target);
  };

  const createOutputEnterHandler = (source: LinkSource) => () => {
    console.log('Output enter:', source);
  };

  const createOutputLeaveHandler = (source: LinkSource) => () => {
    console.log('Output leave:', source);
  };

  const createStartLinkingFromInputHandler = (target: LinkTarget) => (e: React.PointerEvent<HTMLDivElement>) => {
    console.log('Start linking from input:', target);
  };

  const createStartLinkingFromOutputHandler = (source: LinkSource) => (e: React.PointerEvent<HTMLDivElement>) => {
    console.log('Start linking from output:', source);
  };

  const handleFinalizeLinking = (target?: LinkTarget) => {
    console.log('Finalize linking:', target);
  };

  const handleMoveLinking = (e: React.PointerEvent<HTMLDivElement>) => {
    console.log('Move linking');
  };

  const handleChangeInputs = (blockId: string, delta: number) => {
    console.log('Change inputs:', blockId, delta);
  };

  const handleChangeOutputs = (blockId: string, delta: number) => {
    console.log('Change outputs:', blockId, delta);
  };

  const handleFileChange = (id: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File change:', id);
  };

  const handleClearFile = (id: string) => {
    console.log('Clear file:', id);
  };
  
const handleBlockDragStart = (blockName: string) => (e: React.DragEvent<HTMLDivElement>) => {
  console.log('Block drag start:', blockName);
};

   // Sidebar handlers
  const handlePanelChange = (panel: PanelKey | null) => {
    if (panel) {
      setActivePanel(panel);
    }
  }

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <Sidebar
        activePanel={activePanel}
        theme={theme}
        isPlanningView={false}
        toolPalette={toolPalette}
        agentJsonInput={agentJsonInput}
        agentParseError={agentParseError}
        onPanelChange={handlePanelChange}
        onThemeChange={handleThemeChange}
        onAgentJsonInputChange={handleAgentJsonInputChange}
        onGenerateAgentsFromJson={handleGenerateAgentsFromJson}
        onOpenPlanning={handleOpenPlanning}
        planningLoaded={false}
        planningName={planningName}
        onAddPlanBlock={handleAddPlanBlock}
        onBlockDragStart={handleBlockDragStart}
        onUploadDragStart={handleUploadDragStart}
        onOutputDragStart={handleOutputDragStart}
        onToolDragStart={handleToolDragStart}
      />


      
      <BlocksPanel 
        agentJsonInput={agentJsonInput}
        agentParseError={agentParseError}
        onAgentJsonInputChange={handleAgentJsonInputChange}
        onGenerateAgentsFromJson={handleGenerateAgentsFromJson}
        onBlockDragStart={handleBlockDragStart}
        onUploadDragStart={handleUploadDragStart}
        onOutputDragStart={handleOutputDragStart}
      />
      
      <div style={{ display: "flex", flexDirection: "column", flex: 1, position: "relative" }}>
        <Background />
        
        {blocks.map(block => (
          <AgentBlock 
            key={block.id} 
            block={block}
            handles={block.handles}
            isActive={false}
            isDragging={false}
            showConnections={false}
            toolCount={0}
            mode={null}
            onPointerDown={createPointerDownHandler}
            onPointerMove={createPointerMoveHandler}
            onPointerUp={createPointerUpHandler}
            onRemove={handleRemove}
            onDetailsClick={handleDetailsClick}
            onHoverEnter={handleHoverEnter}
            onHoverLeave={handleHoverLeave}
            onInputEnter={createInputEnterHandler}
            onInputLeave={createInputLeaveHandler}
            onOutputEnter={createOutputEnterHandler}
            onOutputLeave={createOutputLeaveHandler}
            onStartLinkingFromInput={createStartLinkingFromInputHandler}
            onStartLinkingFromOutput={createStartLinkingFromOutputHandler}
            onFinalizeLinking={handleFinalizeLinking}
            onMoveLinking={handleMoveLinking}
            onChangeInputs={handleChangeInputs}
            onChangeOutputs={handleChangeOutputs}
          />
        ))}
        
        {tools.map(tool => (
          <ToolNode 
            key={tool.id} 
            tool={tool}
            handles={tool.handles}
            isActive={false}
            isDragging={false}
            showHandles={false}
            onPointerDown={createPointerDownHandler}
            onPointerMove={createPointerMoveHandler}
            onPointerUp={createPointerUpHandler}
            onRemove={handleRemove}
            onDetailsClick={handleDetailsClick}
            onHoverEnter={handleHoverEnter}
            onHoverLeave={handleHoverLeave}
            onOutputEnter={createOutputEnterHandler}
            onOutputLeave={createOutputLeaveHandler}
            onStartLinkingFromOutput={createStartLinkingFromOutputHandler}
            onFinalizeLinking={handleFinalizeLinking}
            onMoveLinking={handleMoveLinking}
          />
        ))}
        
        {uploads.map(upload => (
          <UploadNode 
            key={upload.id} 
            upload={upload}
            handles={upload.handles}
            isActive={false}
            isDragging={false}
            showHandles={false}
            onPointerDown={createPointerDownHandler}
            onPointerMove={createPointerMoveHandler}
            onPointerUp={createPointerUpHandler}
            onRemove={handleRemove}
            onHoverEnter={handleHoverEnter}
            onHoverLeave={handleHoverLeave}
            onFileChange={handleFileChange}
            onClearFile={handleClearFile}
            onOutputEnter={createOutputEnterHandler}
            onOutputLeave={createOutputLeaveHandler}
            onStartLinkingFromOutput={createStartLinkingFromOutputHandler}
            onFinalizeLinking={handleFinalizeLinking}
            onMoveLinking={handleMoveLinking}
          />
        ))}
      </div>
    </div>
  );
};

export default EvalsDashboard;
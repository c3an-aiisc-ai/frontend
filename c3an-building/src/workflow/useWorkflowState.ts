import { useRef, useState } from "react";
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import type {
  AgentBlock,
  AgentSpecTemplate,
  ClipboardItem,
  Connection,
  Note,
  OutputNode,
  PanelKey,
  Selection,
  ToolNode,
  UploadNode,
} from "../types/workflow";

type WorkflowState = {
  activePanel: PanelKey | null;
  setActivePanel: Dispatch<SetStateAction<PanelKey | null>>;
  notes: Note[];
  setNotes: Dispatch<SetStateAction<Note[]>>;
  blocks: AgentBlock[];
  setBlocks: Dispatch<SetStateAction<AgentBlock[]>>;
  tools: ToolNode[];
  setTools: Dispatch<SetStateAction<ToolNode[]>>;
  uploads: UploadNode[];
  setUploads: Dispatch<SetStateAction<UploadNode[]>>;
  outputs: OutputNode[];
  setOutputs: Dispatch<SetStateAction<OutputNode[]>>;
  connections: Connection[];
  setConnections: Dispatch<SetStateAction<Connection[]>>;
  clipboard: ClipboardItem | null;
  setClipboard: Dispatch<SetStateAction<ClipboardItem | null>>;
  agentJsonInput: string;
  setAgentJsonInput: Dispatch<SetStateAction<string>>;
  agentParseError: string | null;
  setAgentParseError: Dispatch<SetStateAction<string | null>>;
  agentSpecTemplate: AgentSpecTemplate | null;
  setAgentSpecTemplate: Dispatch<SetStateAction<AgentSpecTemplate | null>>;
  selected: Selection;
  setSelected: Dispatch<SetStateAction<Selection>>;
  modalBlockId: string | null;
  setModalBlockId: Dispatch<SetStateAction<string | null>>;
  modalToolId: string | null;
  setModalToolId: Dispatch<SetStateAction<string | null>>;
  modalToolChoice: string;
  setModalToolChoice: Dispatch<SetStateAction<string>>;
  showEvalsModal: boolean;
  setShowEvalsModal: Dispatch<SetStateAction<boolean>>;
  selectedEvals: string[];
  setSelectedEvals: Dispatch<SetStateAction<string[]>>;
  hoveredBlockId: string | null;
  setHoveredBlockId: Dispatch<SetStateAction<string | null>>;
  hoveredToolId: string | null;
  setHoveredToolId: Dispatch<SetStateAction<string | null>>;
  hoveredUploadId: string | null;
  setHoveredUploadId: Dispatch<SetStateAction<string | null>>;
  hoveredOutputId: string | null;
  setHoveredOutputId: Dispatch<SetStateAction<string | null>>;
  draggingNoteId: string | null;
  setDraggingNoteId: Dispatch<SetStateAction<string | null>>;
  draggingBlockId: string | null;
  setDraggingBlockId: Dispatch<SetStateAction<string | null>>;
  draggingToolId: string | null;
  setDraggingToolId: Dispatch<SetStateAction<string | null>>;
  draggingUploadId: string | null;
  setDraggingUploadId: Dispatch<SetStateAction<string | null>>;
  draggingOutputId: string | null;
  setDraggingOutputId: Dispatch<SetStateAction<string | null>>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  nextIdRef: MutableRefObject<number>;
  nextBlockIdRef: MutableRefObject<number>;
  nextToolIdRef: MutableRefObject<number>;
  nextUploadIdRef: MutableRefObject<number>;
  nextOutputIdRef: MutableRefObject<number>;
  nextConnectionIdRef: MutableRefObject<number>;
  dragOffsetRef: MutableRefObject<{ x: number; y: number }>;
  blockDragOffsetRef: MutableRefObject<{ x: number; y: number }>;
  toolDragOffsetRef: MutableRefObject<{ x: number; y: number }>;
  outputDragOffsetRef: MutableRefObject<{ x: number; y: number }>;
  uploadDragOffsetRef: MutableRefObject<{ x: number; y: number }>;
};

export function useWorkflowState(): WorkflowState {
  const [activePanel, setActivePanel] = useState<PanelKey | null>("blocks");
  const [notes, setNotes] = useState<Note[]>([]);
  const [blocks, setBlocks] = useState<AgentBlock[]>([]);
  const [tools, setTools] = useState<ToolNode[]>([]);
  const [uploads, setUploads] = useState<UploadNode[]>([]);
  const [outputs, setOutputs] = useState<OutputNode[]>([]);
  const [agentJsonInput, setAgentJsonInput] = useState<string>("input json here");
  const [agentParseError, setAgentParseError] = useState<string | null>(null);
  const [agentSpecTemplate, setAgentSpecTemplate] = useState<AgentSpecTemplate | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [clipboard, setClipboard] = useState<ClipboardItem | null>(null);
  const [selected, setSelected] = useState<Selection>(null);
  const [modalBlockId, setModalBlockId] = useState<string | null>(null);
  const [modalToolId, setModalToolId] = useState<string | null>(null);
  const [modalToolChoice, setModalToolChoice] = useState<string>("");
  const [showEvalsModal, setShowEvalsModal] = useState(false);
  const [selectedEvals, setSelectedEvals] = useState<string[]>([]);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [hoveredToolId, setHoveredToolId] = useState<string | null>(null);
  const [hoveredUploadId, setHoveredUploadId] = useState<string | null>(null);
  const [hoveredOutputId, setHoveredOutputId] = useState<string | null>(null);
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [draggingToolId, setDraggingToolId] = useState<string | null>(null);
  const [draggingUploadId, setDraggingUploadId] = useState<string | null>(null);
  const [draggingOutputId, setDraggingOutputId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nextIdRef = useRef(1);
  const nextBlockIdRef = useRef(1);
  const nextToolIdRef = useRef(1);
  const nextUploadIdRef = useRef(1);
  const nextOutputIdRef = useRef(1);
  const nextConnectionIdRef = useRef(1);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const blockDragOffsetRef = useRef({ x: 0, y: 0 });
  const toolDragOffsetRef = useRef({ x: 0, y: 0 });
  const outputDragOffsetRef = useRef({ x: 0, y: 0 });
  const uploadDragOffsetRef = useRef({ x: 0, y: 0 });

  return {
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
  };
}

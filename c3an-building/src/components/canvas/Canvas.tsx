import type { ChangeEvent, Dispatch, DragEvent, PointerEvent, RefObject, SetStateAction } from "react";
import Background from "../background";
import type { Transform } from "../../hooks/zoom";
import type {
  AgentBlock,
  AnchorPoint,
  BlockHandles,
  Connection,
  LinkSource,
  LinkTarget,
  LinkingState,
  Note,
  OutputHandles,
  OutputNode,
  Selection,
  ThemeMode,
  ToolHandles,
  ToolNode,
  UploadHandles,
  UploadNode,
} from "../../types/workflow";
import ConnectionsLayer from "./ConnectionsLayer";
import BlockNode from "./nodes/BlockNode";
import ToolNodeItem from "./nodes/ToolNode";
import UploadNodeItem from "./nodes/UploadNode";
import OutputNodeItem from "./nodes/OutputNode";
import NoteNode from "./nodes/NoteNode";

type CanvasState = {
  linking: LinkingState | null;
  selected: Selection;
  connections: Connection[];
  blocks: AgentBlock[];
  tools: ToolNode[];
  uploads: UploadNode[];
  outputs: OutputNode[];
  notes: Note[];
  draggingBlockId: string | null;
  draggingToolId: string | null;
  draggingUploadId: string | null;
  draggingOutputId: string | null;
  draggingNoteId: string | null;
  hoveredBlockId: string | null;
  hoveredToolId: string | null;
  hoveredUploadId: string | null;
  hoveredOutputId: string | null;
};

type CanvasHandlers = {
  onCanvasDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onCanvasDrop: (event: DragEvent<HTMLDivElement>) => void;
  onCanvasPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onMoveLinking: (event: PointerEvent<HTMLDivElement>) => void;
  onFinalizeLinking: (overrideTarget?: LinkTarget) => void;
  onClearSelection: () => void;
  onOpenBlockModal: (id: string) => void;
  onOpenToolModal: (id: string) => void;
  onRemoveBlock: (id: string) => void;
  onRemoveTool: (id: string) => void;
  onRemoveUpload: (id: string) => void;
  onRemoveOutput: (id: string) => void;
  onRemoveNote: (id: string) => void;
  onClearUpload: (id: string) => void;
  onUploadFileChange: (id: string) => (event: ChangeEvent<HTMLInputElement>) => void;
  onOutputFormatChange: (id: string) => (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onOutputFormatBlur: (id: string) => () => void;
  onBlockPointerDown: (id: string) => (event: PointerEvent<HTMLDivElement>) => void;
  onBlockPointerMove: (id: string) => (event: PointerEvent<HTMLDivElement>) => void;
  onBlockPointerUp: (id: string) => (event: PointerEvent<HTMLDivElement>) => void;
  onToolPointerDown: (id: string) => (event: PointerEvent<HTMLDivElement>) => void;
  onToolPointerMove: (id: string) => (event: PointerEvent<HTMLDivElement>) => void;
  onToolPointerUp: (id: string) => (event: PointerEvent<HTMLDivElement>) => void;
  onUploadPointerDown: (id: string) => (event: PointerEvent<HTMLDivElement>) => void;
  onUploadPointerMove: (id: string) => (event: PointerEvent<HTMLDivElement>) => void;
  onUploadPointerUp: (id: string) => (event: PointerEvent<HTMLDivElement>) => void;
  onOutputPointerDown: (id: string) => (event: PointerEvent<HTMLDivElement>) => void;
  onOutputPointerMove: (id: string) => (event: PointerEvent<HTMLDivElement>) => void;
  onOutputPointerUp: (id: string) => (event: PointerEvent<HTMLDivElement>) => void;
  onNotePointerDown: (id: string) => (event: PointerEvent<HTMLDivElement>) => void;
  onNotePointerMove: (id: string) => (event: PointerEvent<HTMLDivElement>) => void;
  onNotePointerUp: (id: string) => (event: PointerEvent<HTMLDivElement>) => void;
  onStartLinkingFromInput: (target: LinkTarget) => (event: PointerEvent<HTMLDivElement>) => void;
  onStartLinkingFromOutput: (source: LinkSource) => (event: PointerEvent<HTMLDivElement>) => void;
  onInputEnter: (target: LinkTarget) => (event: PointerEvent<HTMLDivElement>) => void;
  onInputLeave: (target: LinkTarget) => (event: PointerEvent<HTMLDivElement>) => void;
  onOutputEnter: (source: LinkSource) => (event: PointerEvent<HTMLDivElement>) => void;
  onOutputLeave: (source: LinkSource) => (event: PointerEvent<HTMLDivElement>) => void;
  onConnectionPointerDown: (conn: Connection) => (event: PointerEvent<SVGPathElement>) => void;
  onChangeBlockInputs: (blockId: string, delta: number) => void;
  onChangeBlockOutputs: (blockId: string, delta: number) => void;
};

type CanvasHelpers = {
  getBlockHandles: (block: AgentBlock) => BlockHandles;
  getToolHandles: (tool: ToolNode) => ToolHandles;
  getUploadHandles: (upload: UploadNode) => UploadHandles;
  getOutputHandles: (output: OutputNode) => OutputHandles;
  getBlockMode: (block: AgentBlock) => string | null;
  getOutputAnchor: (source: LinkSource) => AnchorPoint | null;
  getInputAnchor: (target: LinkTarget) => AnchorPoint | null;
  buildConnectionPath: (start: AnchorPoint, end: AnchorPoint) => string;
  formatBytes: (size?: number) => string;
};

type Props = {
  containerRef: RefObject<HTMLDivElement | null>;
  transform: Transform;
  theme: ThemeMode;
  state: CanvasState;
  handlers: CanvasHandlers;
  helpers: CanvasHelpers;
  setHoveredBlockId: Dispatch<SetStateAction<string | null>>;
  setHoveredToolId: Dispatch<SetStateAction<string | null>>;
  setHoveredUploadId: Dispatch<SetStateAction<string | null>>;
  setHoveredOutputId: Dispatch<SetStateAction<string | null>>;
};

export default function Canvas({
  containerRef,
  transform,
  theme,
  state,
  handlers,
  helpers,
  setHoveredBlockId,
  setHoveredToolId,
  setHoveredUploadId,
  setHoveredOutputId,
}: Props) {
  const {
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
  } = state;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ touchAction: "none" }}
      onDragOver={handlers.onCanvasDragOver}
      onDrop={handlers.onCanvasDrop}
      onPointerDownCapture={handlers.onCanvasPointerDown}
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
          transition: "none",
          willChange: "transform",
          pointerEvents: "auto",
        }}
        onPointerMove={handlers.onMoveLinking}
        onPointerUp={() => {
          if (linking) handlers.onFinalizeLinking();
        }}
      >
        <ConnectionsLayer
          connections={connections}
          linking={linking}
          selectedConnectionId={selected?.type === "connection" ? selected.id : null}
          getOutputAnchor={helpers.getOutputAnchor}
          getInputAnchor={helpers.getInputAnchor}
          buildConnectionPath={helpers.buildConnectionPath}
          onConnectionPointerDown={handlers.onConnectionPointerDown}
        />

        {blocks.map((block) => {
          const isActive = selected?.type === "block" && selected.id === block.id;
          const linkingActive = Boolean(linking);
          const showConnections =
            isActive ||
            draggingBlockId === block.id ||
            linkingActive ||
            hoveredBlockId === block.id;
          const toolIds = connections
            .filter(
              (conn) =>
                conn.from.type === "tool" && conn.to.type === "block" && conn.to.id === block.id,
            )
            .map((conn) => conn.from.id);
          const toolCount = new Set(toolIds).size;
          const handles = helpers.getBlockHandles(block);
          return (
            <BlockNode
              key={block.id}
              block={block}
              handles={handles}
              isActive={isActive}
              showConnections={showConnections}
              toolCount={toolCount}
              mode={helpers.getBlockMode(block)}
              onPointerEnter={() => setHoveredBlockId(block.id)}
              onPointerLeave={() =>
                setHoveredBlockId((prev) => (prev === block.id ? null : prev))
              }
              onRemove={() => handlers.onRemoveBlock(block.id)}
              onOpenDetails={() => handlers.onOpenBlockModal(block.id)}
              onClearSelection={handlers.onClearSelection}
              onBlockPointerDown={handlers.onBlockPointerDown(block.id)}
              onBlockPointerMove={handlers.onBlockPointerMove(block.id)}
              onBlockPointerUp={handlers.onBlockPointerUp(block.id)}
              startLinkingFromInput={handlers.onStartLinkingFromInput}
              startLinkingFromOutput={handlers.onStartLinkingFromOutput}
              handleInputEnter={handlers.onInputEnter}
              handleInputLeave={handlers.onInputLeave}
              handleOutputEnter={handlers.onOutputEnter}
              handleOutputLeave={handlers.onOutputLeave}
              onMoveLinking={handlers.onMoveLinking}
              finalizeLinking={handlers.onFinalizeLinking}
              changeBlockInputs={handlers.onChangeBlockInputs}
              changeBlockOutputs={handlers.onChangeBlockOutputs}
            />
          );
        })}

        {uploads.map((upload) => {
          const isActive = selected?.type === "upload" && selected.id === upload.id;
          const isDragging = draggingUploadId === upload.id;
          const handles = helpers.getUploadHandles(upload);
          const showHandles =
            isActive || isDragging || hoveredUploadId === upload.id || Boolean(linking);
          const fileLabel = upload.fileName ?? "No file attached";
          const fileMeta =
            upload.status === "ready"
              ? `${upload.fileType ?? "File"}${upload.fileSize ? ` • ${helpers.formatBytes(upload.fileSize)}` : ""}`
              : "Accepted: PDF, CSV, Excel, JSON, TXT";

          return (
            <UploadNodeItem
              key={upload.id}
              upload={upload}
              handles={handles}
              isActive={isActive}
              isDragging={isDragging}
              showHandles={showHandles}
              fileLabel={fileLabel}
              fileMeta={fileMeta}
              onPointerEnter={() => setHoveredUploadId(upload.id)}
              onPointerLeave={() =>
                setHoveredUploadId((prev) => (prev === upload.id ? null : prev))
              }
              onRemove={() => handlers.onRemoveUpload(upload.id)}
              onUploadPointerDown={handlers.onUploadPointerDown(upload.id)}
              onUploadPointerMove={handlers.onUploadPointerMove(upload.id)}
              onUploadPointerUp={handlers.onUploadPointerUp(upload.id)}
              onUploadFileChange={handlers.onUploadFileChange(upload.id)}
              onClearFile={() => handlers.onClearUpload(upload.id)}
              startLinkingFromOutput={handlers.onStartLinkingFromOutput}
              handleOutputEnter={handlers.onOutputEnter}
              handleOutputLeave={handlers.onOutputLeave}
              onMoveLinking={handlers.onMoveLinking}
              finalizeLinking={() => handlers.onFinalizeLinking()}
            />
          );
        })}

        {outputs.map((output) => {
          const isActive = selected?.type === "output" && selected.id === output.id;
          const isDragging = draggingOutputId === output.id;
          const handles = helpers.getOutputHandles(output);
          const showHandles =
            isActive || isDragging || hoveredOutputId === output.id || Boolean(linking);

          return (
            <OutputNodeItem
              key={output.id}
              output={output}
              handles={handles}
              isActive={isActive}
              isDragging={isDragging}
              showHandles={showHandles}
              onPointerEnter={() => setHoveredOutputId(output.id)}
              onPointerLeave={() =>
                setHoveredOutputId((prev) => (prev === output.id ? null : prev))
              }
              onRemove={() => handlers.onRemoveOutput(output.id)}
              onOutputPointerDown={handlers.onOutputPointerDown(output.id)}
              onOutputPointerMove={handlers.onOutputPointerMove(output.id)}
              onOutputPointerUp={handlers.onOutputPointerUp(output.id)}
              onFormatChange={handlers.onOutputFormatChange(output.id)}
              onFormatBlur={handlers.onOutputFormatBlur(output.id)}
              startLinkingFromInput={handlers.onStartLinkingFromInput}
              handleInputEnter={handlers.onInputEnter}
              handleInputLeave={handlers.onInputLeave}
              finalizeLinking={handlers.onFinalizeLinking}
            />
          );
        })}

        {tools.map((tool) => {
          const isActive = selected?.type === "tool" && selected.id === tool.id;
          const isDragging = draggingToolId === tool.id;
          const handles = helpers.getToolHandles(tool);
          const width = handles.width;
          const height = handles.height;
          const showHandles =
            isActive ||
            isDragging ||
            hoveredToolId === tool.id ||
            (linking?.origin === "output" && linking.from.id === tool.id) ||
            (linking?.origin === "input" && linking.target.id === tool.id) ||
            (linking
              ? Math.hypot(
                  linking.current.x - (tool.x + width / 2),
                  linking.current.y - (tool.y + height / 2),
                ) < 140
              : false);

          return (
            <ToolNodeItem
              key={tool.id}
              tool={tool}
              handles={handles}
              isActive={isActive}
              isDragging={isDragging}
              showHandles={showHandles}
              onPointerEnter={() => setHoveredToolId(tool.id)}
              onPointerLeave={() =>
                setHoveredToolId((prev) => (prev === tool.id ? null : prev))
              }
              onRemove={() => handlers.onRemoveTool(tool.id)}
              onOpenDetails={() => handlers.onOpenToolModal(tool.id)}
              onToolPointerDown={handlers.onToolPointerDown(tool.id)}
              onToolPointerMove={handlers.onToolPointerMove(tool.id)}
              onToolPointerUp={handlers.onToolPointerUp(tool.id)}
              startLinkingFromOutput={handlers.onStartLinkingFromOutput}
              handleOutputEnter={handlers.onOutputEnter}
              handleOutputLeave={handlers.onOutputLeave}
              onMoveLinking={handlers.onMoveLinking}
              finalizeLinking={handlers.onFinalizeLinking}
            />
          );
        })}

        {notes.map((note) => {
          const isDragging = draggingNoteId === note.id;
          const isSelected = selected?.type === "note" && selected.id === note.id;
          return (
            <NoteNode
              key={note.id}
              note={note}
              isSelected={isSelected}
              isDragging={isDragging}
              onPointerDown={handlers.onNotePointerDown(note.id)}
              onPointerMove={handlers.onNotePointerMove(note.id)}
              onPointerUp={handlers.onNotePointerUp(note.id)}
              onRemove={() => handlers.onRemoveNote(note.id)}
            />
          );
        })}

        <div style={{ padding: 40 }}>{/* canvas placeholder card removed per request */}</div>
      </div>
    </div>
  );
}

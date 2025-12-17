import { useCallback } from "react";
import type { ChangeEvent, Dispatch, MutableRefObject, PointerEvent as ReactPointerEvent, SetStateAction } from "react";
import type { AgentBlock, Connection, Note, OutputNode, Selection, ToolNode, UploadNode } from "../types/workflow";

type Params = {
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
  setConnections: Dispatch<SetStateAction<Connection[]>>;
  selected: Selection;
  setSelected: Dispatch<SetStateAction<Selection>>;
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
  dragOffsetRef: MutableRefObject<{ x: number; y: number }>;
  blockDragOffsetRef: MutableRefObject<{ x: number; y: number }>;
  toolDragOffsetRef: MutableRefObject<{ x: number; y: number }>;
  uploadDragOffsetRef: MutableRefObject<{ x: number; y: number }>;
  outputDragOffsetRef: MutableRefObject<{ x: number; y: number }>;
  toWorldPoint: (clientX: number, clientY: number) => { x: number; y: number } | null;
  linkingRef: MutableRefObject<boolean>;
  recalcBlockPorts: (conns: Connection[], blocksState: AgentBlock[]) => AgentBlock[];
};

export function useWorkflowNodeHandlers({
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
  recalcBlockPorts,
}: Params) {
  const handleNotePointerDown = useCallback(
    (noteId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      event.stopPropagation();
      event.preventDefault();
      setSelected((prev) => (prev?.type === "note" && prev.id === noteId ? null : { type: "note", id: noteId }));
      const note = notes.find((n) => n.id === noteId);
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!note || !world) return;
      dragOffsetRef.current = { x: world.x - note.x, y: world.y - note.y };
      setDraggingNoteId(noteId);
      setSelected({ type: "note", id: noteId });
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [dragOffsetRef, notes, setDraggingNoteId, setSelected, toWorldPoint],
  );

  const handleNotePointerMove = useCallback(
    (noteId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingNoteId !== noteId) return;
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!world) return;
      const newX = world.x - dragOffsetRef.current.x;
      const newY = world.y - dragOffsetRef.current.y;
      setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, x: newX, y: newY } : n)));
    },
    [dragOffsetRef, draggingNoteId, setNotes, toWorldPoint],
  );

  const handleNotePointerUp = useCallback(
    (noteId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingNoteId !== noteId) return;
      setDraggingNoteId(null);
      dragOffsetRef.current = { x: 0, y: 0 };
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    },
    [dragOffsetRef, draggingNoteId, setDraggingNoteId],
  );

  const handleRemoveNote = useCallback(
    (noteId: string) => {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      if (draggingNoteId === noteId) setDraggingNoteId(null);
      if (selected?.type === "note" && selected.id === noteId) setSelected(null);
    },
    [draggingNoteId, selected, setDraggingNoteId, setNotes, setSelected],
  );

  const handleBlockPointerDown = useCallback(
    (blockId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (linkingRef.current || target?.closest("[data-connector]")) return;
      event.stopPropagation();
      event.preventDefault();
      setSelected((prev) => (prev?.type === "block" && prev.id === blockId ? null : { type: "block", id: blockId }));
      const block = blocks.find((b) => b.id === blockId);
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!block || !world) return;
      blockDragOffsetRef.current = { x: world.x - block.x, y: world.y - block.y };
      setDraggingBlockId(blockId);
      setSelected({ type: "block", id: blockId });
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [blockDragOffsetRef, blocks, linkingRef, setDraggingBlockId, setSelected, toWorldPoint],
  );

  const handleBlockPointerMove = useCallback(
    (blockId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingBlockId !== blockId) return;
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!world) return;
      const newX = world.x - blockDragOffsetRef.current.x;
      const newY = world.y - blockDragOffsetRef.current.y;
      setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, x: newX, y: newY } : b)));
    },
    [blockDragOffsetRef, draggingBlockId, setBlocks, toWorldPoint],
  );

  const handleBlockPointerUp = useCallback(
    (blockId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingBlockId !== blockId) return;
      setDraggingBlockId(null);
      blockDragOffsetRef.current = { x: 0, y: 0 };
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    },
    [blockDragOffsetRef, draggingBlockId, setDraggingBlockId],
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
            ),
        ),
      );
    },
    [draggingBlockId, selected, setBlocks, setConnections, setDraggingBlockId, setSelected],
  );

  const handleToolPointerDown = useCallback(
    (toolId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (linkingRef.current || target?.closest("[data-connector]")) return;
      event.stopPropagation();
      event.preventDefault();
      setSelected((prev) => (prev?.type === "tool" && prev.id === toolId ? null : { type: "tool", id: toolId }));
      const tool = tools.find((t) => t.id === toolId);
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!tool || !world) return;
      toolDragOffsetRef.current = { x: world.x - tool.x, y: world.y - tool.y };
      setDraggingToolId(toolId);
      setSelected({ type: "tool", id: toolId });
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [linkingRef, setDraggingToolId, setSelected, toWorldPoint, toolDragOffsetRef, tools],
  );

  const handleToolPointerMove = useCallback(
    (toolId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingToolId !== toolId) return;
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!world) return;
      const newX = world.x - toolDragOffsetRef.current.x;
      const newY = world.y - toolDragOffsetRef.current.y;
      setTools((prev) => prev.map((tool) => (tool.id === toolId ? { ...tool, x: newX, y: newY } : tool)));
    },
    [draggingToolId, setTools, toWorldPoint, toolDragOffsetRef],
  );

  const handleToolPointerUp = useCallback(
    (toolId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingToolId !== toolId) return;
      setDraggingToolId(null);
      toolDragOffsetRef.current = { x: 0, y: 0 };
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    },
    [draggingToolId, setDraggingToolId, toolDragOffsetRef],
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
            ),
        ),
      );
    },
    [draggingToolId, selected, setConnections, setDraggingToolId, setSelected, setTools],
  );

  const handleUploadPointerDown = useCallback(
    (uploadId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (
        linkingRef.current ||
        target?.closest("[data-connector]") ||
        target?.closest("[data-upload-control]")
      ) {
        return;
      }
      event.stopPropagation();
      event.preventDefault();
      setSelected((prev) => (prev?.type === "upload" && prev.id === uploadId ? null : { type: "upload", id: uploadId }));
      const upload = uploads.find((u) => u.id === uploadId);
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!upload || !world) return;
      uploadDragOffsetRef.current = { x: world.x - upload.x, y: world.y - upload.y };
      setDraggingUploadId(uploadId);
      setSelected({ type: "upload", id: uploadId });
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [linkingRef, setDraggingUploadId, setSelected, toWorldPoint, uploadDragOffsetRef, uploads],
  );

  const handleUploadPointerMove = useCallback(
    (uploadId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingUploadId !== uploadId) return;
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!world) return;
      const newX = world.x - uploadDragOffsetRef.current.x;
      const newY = world.y - uploadDragOffsetRef.current.y;
      setUploads((prev) =>
        prev.map((upload) => (upload.id === uploadId ? { ...upload, x: newX, y: newY } : upload)),
      );
    },
    [draggingUploadId, setUploads, toWorldPoint, uploadDragOffsetRef],
  );

  const handleUploadPointerUp = useCallback(
    (uploadId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingUploadId !== uploadId) return;
      setDraggingUploadId(null);
      uploadDragOffsetRef.current = { x: 0, y: 0 };
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    },
    [draggingUploadId, setDraggingUploadId, uploadDragOffsetRef],
  );

  const handleRemoveUpload = useCallback(
    (uploadId: string) => {
      setUploads((prev) => prev.filter((upload) => upload.id !== uploadId));
      if (draggingUploadId === uploadId) setDraggingUploadId(null);
      if (selected?.type === "upload" && selected.id === uploadId) setSelected(null);
      setConnections((prev) => prev.filter((conn) => !(conn.from.type === "upload" && conn.from.id === uploadId)));
    },
    [draggingUploadId, selected, setConnections, setDraggingUploadId, setSelected, setUploads],
  );

  const handleUploadFileChange = useCallback(
    (uploadId: string) => (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      setUploads((prev) =>
        prev.map((upload) =>
          upload.id === uploadId
            ? {
                ...upload,
                status: file ? "ready" : "idle",
                fileName: file?.name,
                fileSize: file?.size,
                fileType: file?.type || (file?.name ? `.${file.name.split(".").pop() ?? ""}` : undefined),
              }
            : upload,
        ),
      );
      event.target.value = "";
    },
    [setUploads],
  );

  const handleClearUpload = useCallback(
    (uploadId: string) => {
      setUploads((prev) =>
        prev.map((item) =>
          item.id === uploadId
            ? { ...item, status: "idle", fileName: undefined, fileSize: undefined, fileType: undefined }
            : item,
        ),
      );
    },
    [setUploads],
  );

  const handleOutputPointerDown = useCallback(
    (outputId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (linkingRef.current || target?.closest("[data-connector]") || target?.closest("[data-output-control]")) {
        return;
      }
      event.stopPropagation();
      event.preventDefault();
      setSelected((prev) => (prev?.type === "output" && prev.id === outputId ? null : { type: "output", id: outputId }));
      const output = outputs.find((o) => o.id === outputId);
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!output || !world) return;
      outputDragOffsetRef.current = { x: world.x - output.x, y: world.y - output.y };
      setDraggingOutputId(outputId);
      setSelected({ type: "output", id: outputId });
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [linkingRef, outputDragOffsetRef, outputs, setDraggingOutputId, setSelected, toWorldPoint],
  );

  const handleOutputPointerMove = useCallback(
    (outputId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingOutputId !== outputId) return;
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!world) return;
      const newX = world.x - outputDragOffsetRef.current.x;
      const newY = world.y - outputDragOffsetRef.current.y;
      setOutputs((prev) =>
        prev.map((output) => (output.id === outputId ? { ...output, x: newX, y: newY } : output)),
      );
    },
    [draggingOutputId, outputDragOffsetRef, setOutputs, toWorldPoint],
  );

  const handleOutputPointerUp = useCallback(
    (outputId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingOutputId !== outputId) return;
      setDraggingOutputId(null);
      outputDragOffsetRef.current = { x: 0, y: 0 };
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    },
    [draggingOutputId, outputDragOffsetRef, setDraggingOutputId],
  );

  const handleRemoveOutput = useCallback(
    (outputId: string) => {
      setOutputs((prev) => prev.filter((output) => output.id !== outputId));
      if (draggingOutputId === outputId) setDraggingOutputId(null);
      if (selected?.type === "output" && selected.id === outputId) setSelected(null);
      setConnections((prev) => prev.filter((conn) => !(conn.to.type === "output" && conn.to.id === outputId)));
    },
    [draggingOutputId, selected, setConnections, setDraggingOutputId, setSelected, setOutputs],
  );

  const handleOutputFormatChange = useCallback(
    (outputId: string) => (event: ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value;
      setOutputs((prev) => prev.map((output) => (output.id === outputId ? { ...output, format: value } : output)));
    },
    [setOutputs],
  );

  const handleOutputFormatBlur = useCallback(
    (outputId: string) => () => {
      setTimeout(() => {
        setSelected((prev) => (prev?.type === "output" && prev.id === outputId ? null : prev));
      }, 0);
    },
    [setSelected],
  );

  const handleRemoveConnection = useCallback(
    (connectionId: string) => {
      setConnections((prev) => {
        const next = prev.filter((conn) => conn.id !== connectionId);
        setBlocks((blocksState) => recalcBlockPorts(next, blocksState));
        return next;
      });
      setSelected((prev) => (prev?.type === "connection" && prev.id === connectionId ? null : prev));
    },
    [recalcBlockPorts, setBlocks, setConnections, setSelected],
  );

  return {
    handleNotePointerDown,
    handleNotePointerMove,
    handleNotePointerUp,
    handleRemoveNote,
    handleBlockPointerDown,
    handleBlockPointerMove,
    handleBlockPointerUp,
    handleRemoveBlock,
    handleToolPointerDown,
    handleToolPointerMove,
    handleToolPointerUp,
    handleRemoveTool,
    handleUploadPointerDown,
    handleUploadPointerMove,
    handleUploadPointerUp,
    handleRemoveUpload,
    handleUploadFileChange,
    handleClearUpload,
    handleOutputPointerDown,
    handleOutputPointerMove,
    handleOutputPointerUp,
    handleRemoveOutput,
    handleOutputFormatChange,
    handleOutputFormatBlur,
    handleRemoveConnection,
  };
}

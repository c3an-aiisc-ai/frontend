import { useEffect } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { AgentBlock, ClipboardItem, Note, OutputNode, Selection, ToolNode, UploadNode } from "../types/workflow";
import { clamp } from "./utils";
import { MAX_IO, MIN_IO } from "./constants";

type Params = {
  selected: Selection;
  clipboard: ClipboardItem | null;
  setClipboard: Dispatch<SetStateAction<ClipboardItem | null>>;
  setSelected: Dispatch<SetStateAction<Selection>>;
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
  nextIdRef: MutableRefObject<number>;
  nextBlockIdRef: MutableRefObject<number>;
  nextToolIdRef: MutableRefObject<number>;
  nextUploadIdRef: MutableRefObject<number>;
  nextOutputIdRef: MutableRefObject<number>;
  onRemoveNote: (id: string) => void;
  onRemoveBlock: (id: string) => void;
  onRemoveTool: (id: string) => void;
  onRemoveUpload: (id: string) => void;
  onRemoveOutput: (id: string) => void;
  onRemoveConnection: (id: string) => void;
};

export function useWorkflowShortcuts({
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
  onRemoveNote,
  onRemoveBlock,
  onRemoveTool,
  onRemoveUpload,
  onRemoveOutput,
  onRemoveConnection,
}: Params) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const modKey = isMac ? event.metaKey : event.ctrlKey;
      const key = event.key.toLowerCase();

      if (modKey && key === "c" && selected) {
        event.preventDefault();
        if (selected.type === "block") {
          const block = blocks.find((b) => b.id === selected.id);
          if (block) setClipboard({ type: "block", data: block });
        } else if (selected.type === "tool") {
          const tool = tools.find((t) => t.id === selected.id);
          if (tool) setClipboard({ type: "tool", data: tool });
        } else if (selected.type === "upload") {
          const upload = uploads.find((u) => u.id === selected.id);
          if (upload) setClipboard({ type: "upload", data: upload });
        } else if (selected.type === "output") {
          const output = outputs.find((o) => o.id === selected.id);
          if (output) setClipboard({ type: "output", data: output });
        } else if (selected.type === "note") {
          const note = notes.find((n) => n.id === selected.id);
          if (note) setClipboard({ type: "note", data: note });
        }
        return;
      }

      if (modKey && key === "v" && clipboard) {
        event.preventDefault();
        const OFFSET = 26;
        if (clipboard.type === "block") {
          const base = clipboard.data;
          const id = nextBlockIdRef.current++;
          const newBlock: AgentBlock = {
            ...base,
            id: `block-${id}`,
            x: base.x + OFFSET,
            y: base.y + OFFSET,
            inputCount: clamp(base.inputCount, MIN_IO, MAX_IO),
            outputCount: clamp(base.outputCount, MIN_IO, MAX_IO),
          };
          setBlocks((prev) => [...prev, newBlock]);
          setSelected({ type: "block", id: newBlock.id });
        } else if (clipboard.type === "tool") {
          const base = clipboard.data;
          const id = nextToolIdRef.current++;
          const newTool: ToolNode = { ...base, id: `tool-${id}`, x: base.x + OFFSET, y: base.y + OFFSET };
          setTools((prev) => [...prev, newTool]);
          setSelected({ type: "tool", id: newTool.id });
        } else if (clipboard.type === "upload") {
          const base = clipboard.data;
          const id = nextUploadIdRef.current++;
          const newUpload: UploadNode = { ...base, id: `upload-${id}`, x: base.x + OFFSET, y: base.y + OFFSET };
          setUploads((prev) => [...prev, newUpload]);
          setSelected({ type: "upload", id: newUpload.id });
        } else if (clipboard.type === "output") {
          const base = clipboard.data;
          const id = nextOutputIdRef.current++;
          const newOutput: OutputNode = { ...base, id: `output-${id}`, x: base.x + OFFSET, y: base.y + OFFSET };
          setOutputs((prev) => [...prev, newOutput]);
          setSelected({ type: "output", id: newOutput.id });
        } else if (clipboard.type === "note") {
          const base = clipboard.data;
          const id = nextIdRef.current++;
          const newNote: Note = { ...base, id: `note-${id}`, x: base.x + OFFSET, y: base.y + OFFSET };
          setNotes((prev) => [...prev, newNote]);
          setSelected({ type: "note", id: newNote.id });
        }
        return;
      }

      if ((key === "backspace" || key === "delete") && selected) {
        event.preventDefault();
        if (selected.type === "note") {
          onRemoveNote(selected.id);
        } else if (selected.type === "block") {
          onRemoveBlock(selected.id);
        } else if (selected.type === "tool") {
          onRemoveTool(selected.id);
        } else if (selected.type === "upload") {
          onRemoveUpload(selected.id);
        } else if (selected.type === "output") {
          onRemoveOutput(selected.id);
        } else if (selected.type === "connection") {
          onRemoveConnection(selected.id);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    blocks,
    clipboard,
    notes,
    outputs,
    selected,
    setBlocks,
    setClipboard,
    setNotes,
    setOutputs,
    setSelected,
    setTools,
    setUploads,
    tools,
    uploads,
    nextBlockIdRef,
    nextIdRef,
    nextOutputIdRef,
    nextToolIdRef,
    nextUploadIdRef,
    onRemoveBlock,
    onRemoveConnection,
    onRemoveNote,
    onRemoveOutput,
    onRemoveTool,
    onRemoveUpload,
  ]);
}

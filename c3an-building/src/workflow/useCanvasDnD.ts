import { useCallback } from "react";
import type { DragEvent, Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import type { AgentBlock, Note, ToolNode, UploadNode, OutputNode, ToolPreset } from "../types/workflow";
import { agentPresets } from "./constants";

type Params = {
  containerRef: RefObject<HTMLDivElement>;
  transform: { x: number; y: number; zoom: number };
  toolPalette: ToolPreset[];
  setNotes: Dispatch<SetStateAction<Note[]>>;
  setBlocks: Dispatch<SetStateAction<AgentBlock[]>>;
  setTools: Dispatch<SetStateAction<ToolNode[]>>;
  setUploads: Dispatch<SetStateAction<UploadNode[]>>;
  setOutputs: Dispatch<SetStateAction<OutputNode[]>>;
  nextIdRef: MutableRefObject<number>;
  nextBlockIdRef: MutableRefObject<number>;
  nextToolIdRef: MutableRefObject<number>;
  nextUploadIdRef: MutableRefObject<number>;
  nextOutputIdRef: MutableRefObject<number>;
};

export function useCanvasDnD({
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
}: Params) {
  const handleCanvasDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const handleCanvasDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const el = containerRef.current;
      if (!el) return;

      const payloadRaw =
        event.dataTransfer.getData("application/json") || event.dataTransfer.getData("text/plain");

      let payloadType: string | null = null;
      let payloadToolName: string | null = null;
      try {
        const parsed = payloadRaw ? JSON.parse(payloadRaw) : null;
        payloadType = parsed?.type ?? null;
        payloadToolName = parsed?.name ?? null;
      } catch {
        // ignore JSON parse errors
      }

      if (!payloadType && payloadRaw?.includes("sticky-note")) payloadType = "sticky-note";
      if (!payloadType && payloadRaw?.includes("agent-block")) payloadType = "agent-block";
      if (!payloadType && payloadRaw?.includes("upload-block")) payloadType = "upload-block";
      if (!payloadType && payloadRaw?.includes("output-block")) payloadType = "output-block";
      if (!payloadType && payloadRaw?.includes("tool")) payloadType = "tool";
      if (payloadType === "tool" && !payloadToolName && payloadRaw) {
        payloadToolName = payloadRaw.replace(/^tool-/, "");
      }
      if (!payloadType) return;

      const rect = el.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      const worldX = (localX - transform.x) / transform.zoom;
      const worldY = (localY - transform.y) / transform.zoom;

      if (payloadType === "sticky-note") {
        const id = nextIdRef.current++;
        setNotes((prev) => [
          ...prev,
          {
            id: `note-${id}`,
            x: worldX,
            y: worldY,
            text: "Sticky note",
          },
        ]);
      }

      if (payloadType === "agent-block") {
        const id = nextBlockIdRef.current++;
        const preset = agentPresets[0];
        const inCount = preset?.inputCount ?? 1;
        const outCount = preset?.outputCount ?? 1;
        setBlocks((prev) => [
          ...prev,
          {
            id: `block-${id}`,
            x: worldX,
            y: worldY,
            sourceAgentId: `block-${id}`,
            name: preset?.name ?? "Agent Block",
            description: preset?.description ?? "1 input, 2 outputs",
            inputCount: inCount,
            outputCount: outCount,
            inputRequired: Array(inCount).fill(false),
            outputRequired: Array(outCount).fill(false),
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
            format: "Describe the format here (e.g., JSON summary, Markdown bullets, CSV schema).",
          },
        ]);
      }

      if (payloadType === "tool") {
        const paletteItem = toolPalette.find((tool) => tool.name === payloadToolName);
        if (!paletteItem) return;
        const id = nextToolIdRef.current++;
        setTools((prev) => [
          ...prev,
          {
            ...paletteItem,
            id: `tool-${id}`,
            x: worldX,
            y: worldY,
          },
        ]);
      }
    },
    [
      containerRef,
      nextBlockIdRef,
      nextIdRef,
      nextOutputIdRef,
      nextToolIdRef,
      nextUploadIdRef,
      setBlocks,
      setNotes,
      setOutputs,
      setTools,
      setUploads,
      toolPalette,
      transform.x,
      transform.y,
      transform.zoom,
    ],
  );

  return { handleCanvasDragOver, handleCanvasDrop };
}

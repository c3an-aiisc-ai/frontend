import { useCallback } from "react";
import type { DragEvent } from "react";

const setDragPayload = (
  event: DragEvent<HTMLDivElement>,
  payload: { type: string; name?: string },
  fallback: string,
) => {
  event.dataTransfer.setData("application/json", JSON.stringify(payload));
  event.dataTransfer.setData("text/plain", fallback);
};

export function usePanelDragHandlers() {
  const handleBlockDragStart = useCallback((event: DragEvent<HTMLDivElement>) => {
    setDragPayload(event, { type: "agent-block" }, "agent-block");
  }, []);

  const handleUploadDragStart = useCallback((event: DragEvent<HTMLDivElement>) => {
    setDragPayload(event, { type: "upload-block" }, "upload-block");
  }, []);

  const handleOutputDragStart = useCallback((event: DragEvent<HTMLDivElement>) => {
    setDragPayload(event, { type: "output-block" }, "output-block");
  }, []);

  const handleToolDragStart = useCallback(
    (toolName: string) => (event: DragEvent<HTMLDivElement>) => {
      setDragPayload(event, { type: "tool", name: toolName }, `tool-${toolName}`);
    },
    [],
  );

  return {
    handleBlockDragStart,
    handleUploadDragStart,
    handleOutputDragStart,
    handleToolDragStart,
  };
}

import { useCallback } from "react";
import type {
  AgentBlock,
  AnchorPoint,
  BlockHandles,
  Connection,
  LinkSource,
  LinkTarget,
  LinkingState,
  OutputHandles,
  OutputNode,
  ToolHandles,
  ToolNode,
  UploadHandles,
  UploadNode,
} from "../types/workflow";
import { MAX_IO, TOOL_PORT_OFFSET } from "./constants";

type Params = {
  blocks: AgentBlock[];
  tools: ToolNode[];
  uploads: UploadNode[];
  outputs: OutputNode[];
  connections: Connection[];
  linking: LinkingState | null;
  hoveredInput: { type: "block" | "tool" | "output"; id: string; inputIndex?: number } | null;
  hoveredBlockId: string | null;
};

export function useCanvasGeometry({
  blocks,
  tools,
  uploads,
  outputs,
  connections,
  linking,
  hoveredInput,
  hoveredBlockId,
}: Params) {
  const getBlockMode = useCallback(
    (block: AgentBlock) => {
      const inbound = connections.filter(
        (conn) =>
          conn.to.type === "block" && conn.to.id === block.id && (conn.to.inputIndex ?? 0) < TOOL_PORT_OFFSET,
      ).length;
      const outbound = connections.filter((conn) => conn.from.type === "block" && conn.from.id === block.id).length;

      if (block.inputCount > 1 || inbound > 1) return "aggregate";
      if (block.outputCount > 1 || outbound > 1) return "branch";
      if (inbound > 0 && outbound > 0) return "sequential";
      if (outbound > 0) return "sequential";
      return null;
    },
    [connections],
  );

  const getBlockHandles = useCallback(
    (block: AgentBlock): BlockHandles => {
      const width = 220;
      const baseHeight = 120;
      const baseInputs = Math.max(1, block.inputCount);
      const baseOutputs = Math.max(1, block.outputCount);

      const maxConnectedInput = connections
        .filter(
          (conn) =>
            conn.to.type === "block" &&
            conn.to.id === block.id &&
            (conn.to.inputIndex ?? -1) < TOOL_PORT_OFFSET,
        )
        .reduce((max, conn) => Math.max(max, conn.to.inputIndex ?? 0), -1);

      const hasToolConnection = connections.some(
        (conn) =>
          conn.to.type === "block" && conn.to.id === block.id && (conn.to.inputIndex ?? -1) >= TOOL_PORT_OFFSET,
      );

      const maxConnectedOutput = connections
        .filter((conn) => conn.from.type === "block" && conn.from.id === block.id)
        .reduce((max, conn) => Math.max(max, conn.from.port), -1);

      const hasInputConnections = maxConnectedInput >= 0;
      const hoverIsOnLeft =
        linking?.origin === "output" &&
        linking.from.type !== "tool" &&
        ((hoveredInput?.type === "block" && hoveredInput.id === block.id) || hoveredBlockId === block.id);
      const showInputPreview = hasInputConnections && hoverIsOnLeft;
      const desiredInputs = Math.max(baseInputs, maxConnectedInput + 1);
      const previewInputs = showInputPreview && desiredInputs < MAX_IO ? desiredInputs + 1 : desiredInputs;
      const inputSlots = Math.min(MAX_IO, previewInputs);

      const hasOutputConnections = maxConnectedOutput >= 0;
      const hoverIsOnRight =
        linking?.origin === "output" && linking.from.type === "block" && linking.from.id === block.id;
      const showOutputPreview = hasOutputConnections && hoverIsOnRight;
      const desiredOutputs = Math.max(baseOutputs, maxConnectedOutput + 1);
      const effectiveOutputs = Math.max(1, desiredOutputs);
      const outputSlots = Math.min(MAX_IO, showOutputPreview ? effectiveOutputs + 1 : effectiveOutputs);

      const hoverIsOnBottom =
        linking?.origin === "output" && linking.from.type === "tool" && hoveredBlockId === block.id;
      const showToolPreview = !hasToolConnection && hoverIsOnBottom;
      const toolSlots = 1 + (showToolPreview ? 1 : 0);

      const maxSlots = Math.max(inputSlots, outputSlots);
      const topPadding = 18;
      const slotGap = 28;
      const height =
        maxSlots > 1
          ? Math.max(baseHeight, topPadding * 2 + slotGap * (maxSlots - 1))
          : baseHeight;

      const buildAnchors = (count: number, side: "left" | "right"): AnchorPoint[] => {
        if (count <= 1) {
          return [
            {
              x: side === "left" ? block.x : block.x + width,
              y: block.y + height / 2,
              dir: side,
            },
          ];
        }
        const gap = (height - topPadding * 2) / (count - 1);
        return Array.from({ length: count }, (_, idx) => ({
          x: side === "left" ? block.x : block.x + width,
          y: block.y + topPadding + idx * gap,
          dir: side,
        }));
      };

      const buildBottomAnchors = (count: number): { anchor: AnchorPoint; slot: number }[] => {
        const slots = Math.max(1, count);
        return Array.from({ length: slots }, (_, idx) => ({
          anchor: { x: block.x + width / 2 + 4, y: block.y + height, dir: "down" },
          slot: TOOL_PORT_OFFSET + idx,
        }));
      };

      const inputAnchors = buildAnchors(inputSlots, "left");
      const outputAnchors = buildAnchors(outputSlots, "right");
      const toolAnchors = buildBottomAnchors(toolSlots);
      return { width, height, inputAnchors, outputAnchors, toolAnchors };
    },
    [connections, hoveredBlockId, hoveredInput, linking],
  );

  const getToolHandles = useCallback((tool: ToolNode): ToolHandles => {
    const width = 180;
    const height = 110;
    const output: AnchorPoint = { x: tool.x + width / 2, y: tool.y - 6, dir: "up" };
    const input: AnchorPoint = output;
    return { width, height, output, input };
  }, []);

  const getUploadHandles = useCallback((upload: UploadNode): UploadHandles => {
    const width = 240;
    const height = 210;
    const output: AnchorPoint = { x: upload.x + width, y: upload.y + height / 2, dir: "right" };
    return { width, height, output };
  }, []);

  const getOutputHandles = useCallback((output: OutputNode): OutputHandles => {
    const width = 240;
    const height = 240;
    const input: AnchorPoint = { x: output.x, y: output.y + height / 2, dir: "left" };
    return { width, height, input };
  }, []);

  const getOutputAnchor = useCallback(
    (endpoint: LinkSource) => {
      if (endpoint.type === "block") {
        const block = blocks.find((b) => b.id === endpoint.id);
        if (!block) return null;
        const handles = getBlockHandles(block);
        const index = Math.min(handles.outputAnchors.length - 1, Math.max(0, endpoint.port));
        return handles.outputAnchors[index];
      }
      if (endpoint.type === "tool") {
        const tool = tools.find((t) => t.id === endpoint.id);
        if (!tool) return null;
        const handles = getToolHandles(tool);
        return handles.output;
      }
      if (endpoint.type === "upload") {
        const upload = uploads.find((u) => u.id === endpoint.id);
        if (!upload) return null;
        const handles = getUploadHandles(upload);
        return handles.output;
      }
      return null;
    },
    [blocks, getBlockHandles, getToolHandles, getUploadHandles, tools, uploads],
  );

  const getInputAnchor = useCallback(
    (target: LinkTarget) => {
      if (target.type === "block") {
        const block = blocks.find((b) => b.id === target.id);
        if (!block) return null;
        const handles = getBlockHandles(block);
        const inputIndex = target.inputIndex ?? 0;
        const toolAnchor = handles.toolAnchors.find((item) => item.slot === inputIndex);
        if (toolAnchor) return toolAnchor.anchor;
        const boundedIndex = Math.min(handles.inputAnchors.length - 1, Math.max(0, inputIndex));
        return handles.inputAnchors[boundedIndex];
      }
      if (target.type === "tool") {
        const tool = tools.find((t) => t.id === target.id);
        if (!tool) return null;
        const handles = getToolHandles(tool);
        return handles.input;
      }
      if (target.type === "output") {
        const output = outputs.find((o) => o.id === target.id);
        if (!output) return null;
        const handles = getOutputHandles(output);
        return handles.input;
      }
      return null;
    },
    [blocks, getBlockHandles, getOutputHandles, getToolHandles, outputs, tools],
  );

  const buildConnectionPath = useCallback((start: AnchorPoint, end: AnchorPoint) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const offsetX = Math.max(Math.abs(dx) * 0.45, 40);
    const offsetY = Math.sign(dy) * Math.min(Math.abs(dy) * 0.25, 160);
    const c1x = start.x + offsetX;
    const c1y = start.y + offsetY;
    const c2x = end.x - offsetX;
    const c2y = end.y - offsetY;
    return `M ${start.x} ${start.y} C ${c1x} ${c1y} ${c2x} ${c2y} ${end.x} ${end.y}`;
  }, []);

  return {
    buildConnectionPath,
    getBlockHandles,
    getBlockMode,
    getInputAnchor,
    getOutputAnchor,
    getOutputHandles,
    getToolHandles,
    getUploadHandles,
  };
}

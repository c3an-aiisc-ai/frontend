import { useCallback } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { AgentBlock, Connection, ToolNode, ToolPreset } from "../types/workflow";
import { TOOL_PORT_OFFSET } from "./constants";

type Params = {
  blocks: AgentBlock[];
  toolPalette: ToolPreset[];
  getBlockHandles: (block: AgentBlock) => { width: number; height: number };
  setTools: Dispatch<SetStateAction<ToolNode[]>>;
  setBlocks: Dispatch<SetStateAction<AgentBlock[]>>;
  setConnections: Dispatch<SetStateAction<Connection[]>>;
  recalcBlockPorts: (conns: Connection[], blocksState: AgentBlock[]) => AgentBlock[];
  nextToolIdRef: MutableRefObject<number>;
  nextConnectionIdRef: MutableRefObject<number>;
};

export function useToolActions({
  blocks,
  toolPalette,
  getBlockHandles,
  setTools,
  setBlocks,
  setConnections,
  recalcBlockPorts,
  nextToolIdRef,
  nextConnectionIdRef,
}: Params) {
  const addToolToBlock = useCallback(
    (blockId: string, toolName: string) => {
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;
      const palette = toolPalette.find((t) => t.name === toolName) ?? toolPalette[0];
      if (!palette) return;
      const handles = getBlockHandles(block);
      const toolWidth = 180;
      const toolId = `tool-${nextToolIdRef.current++}`;
      const toolX = block.x + handles.width / 2 - toolWidth / 2;
      const toolY = block.y + handles.height + 60;
      const newTool: ToolNode = { ...palette, id: toolId, x: toolX, y: toolY };
      setTools((prev) => [...prev, newTool]);
      const connId = `conn-${nextConnectionIdRef.current++}`;
      setConnections((prev) => {
        const next: Connection[] = [
          ...prev,
          { id: connId, from: { type: "tool", id: toolId, port: 0 }, to: { type: "block", id: blockId, inputIndex: TOOL_PORT_OFFSET } },
        ];
        setBlocks((blocksState) => recalcBlockPorts(next, blocksState));
        return next;
      });
    },
    [blocks, getBlockHandles, nextConnectionIdRef, nextToolIdRef, recalcBlockPorts, setBlocks, setConnections, setTools, toolPalette],
  );

  return { addToolToBlock };
}

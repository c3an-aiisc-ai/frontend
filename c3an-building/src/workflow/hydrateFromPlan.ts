// src/workflow/hydrateFromPlan.ts

import type { PlanningBlock } from "../types/planning";
import type {
  AgentBlock,
  ToolNode,
  UploadNode,
  OutputNode,
  Connection,
} from "../types";

export type HydratedWorkflow = {
  blocks: AgentBlock[];
  tools: ToolNode[];
  uploads: UploadNode[];
  outputs: OutputNode[];
  connections: Connection[];
};

const START_X = 200;
const START_Y = 200;
const X_GAP = 320;
// Y_GAP removed (unused)

export function hydrateWorkflowFromPlan(
  plan: PlanningBlock
): HydratedWorkflow {
  const blocks: AgentBlock[] = [];
  const connections: Connection[] = [];

  // map agent name -> block id
  const blockMap = new Map<string, string>();

  // map agent name -> index (for layout)
  const indexMap = new Map<string, number>();

  let blockCount = 0;

  const ensureBlock = (name: string) => {
    if (blockMap.has(name)) return blockMap.get(name)!;

    const id = `block-${++blockCount}`;
    blockMap.set(name, id);
    indexMap.set(name, indexMap.size);

    const index = indexMap.get(name)!;

    blocks.push({
      id,
      x: START_X + index * X_GAP,
      y: START_Y,
      name,
      description: "",
      inputCount: 1,
      outputCount: 1,
      inputRequired: [false],
      outputRequired: [false],
      inputNames: [],
      outputNames: [],
      presetId: "custom",
    });

    return id;
  };

  const triples = (plan.triples ?? []).filter((t) => t?.from && t?.to);

  // Allocate input slots per target based on distinct inbound sources.
  const inboundOrder = new Map<string, string[]>();
  for (const t of triples) {
    const list = inboundOrder.get(t.to) ?? [];
    if (!list.includes(t.from)) list.push(t.from);
    inboundOrder.set(t.to, list);
  }

  for (const triple of triples) {
    const fromId = ensureBlock(triple.from);
    const toId = ensureBlock(triple.to);

    const inbound = inboundOrder.get(triple.to) ?? [];
    const inputIndex = Math.max(0, inbound.indexOf(triple.from));

    connections.push({
      id: `conn-${connections.length + 1}`,
      from: {
        type: "block",
        id: fromId,
        port: 0,
      },
      to: {
        type: "block",
        id: toId,
        inputIndex,
      },
    });
  }

  return {
    blocks,
    tools: [],
    uploads: [],
    outputs: [],
    connections,
  };
}

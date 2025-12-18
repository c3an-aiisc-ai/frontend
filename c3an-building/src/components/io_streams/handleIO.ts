// =============================================================================
// IO Streams
// - Plan View IO streams: TODO (rework later)
// - Agent View IO streams: shared hydration/sanitization helpers
// =============================================================================

import type { PlanningBlock } from "../../types/planning";
import type { AgentBlock, Connection, ToolNode, UploadNode, OutputNode } from "../../types";

export type AgentViewHydration = {
	blocks: AgentBlock[];
	connections: Connection[];
};

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

type TripleLike = { from: string; to: string };

function normalizeTriples(plan: PlanningBlock): TripleLike[] {
	const triples = plan.triples ?? [];
	return triples
		.filter((t) => Boolean(t?.from) && Boolean(t?.to))
		.map((t) => ({ from: String(t.from), to: String(t.to) }));
}

// Agent-view hydration from a plan is intentionally simple:
// - Create a block per unique agent name.
// - Build deterministic input/output slot allocation based on first-seen ordering.
// - Ignore plan ops for now (seq/brn/agg semantics are plan-view concerns).
export function hydrateAgentViewFromPlan(plan: PlanningBlock): AgentViewHydration {
	const blocks: AgentBlock[] = [];
	const connections: Connection[] = [];

	const blockIdByName = new Map<string, string>();
	const indexByName = new Map<string, number>();

	let blockCount = 0;

	const ensureBlock = (name: string) => {
		const existing = blockIdByName.get(name);
		if (existing) return existing;

		const id = `block-${++blockCount}`;
		blockIdByName.set(name, id);
		indexByName.set(name, indexByName.size);
		const index = indexByName.get(name)!;

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

	const triples = normalizeTriples(plan);

	// Allocate input slots per target based on distinct inbound sources.
	const inboundOrder = new Map<string, string[]>();
	for (const t of triples) {
		const list = inboundOrder.get(t.to) ?? [];
		if (!list.includes(t.from)) list.push(t.from);
		inboundOrder.set(t.to, list);
	}

	// Allocate output ports per source based on distinct outbound targets.
	const outboundOrder = new Map<string, string[]>();
	for (const t of triples) {
		const list = outboundOrder.get(t.from) ?? [];
		if (!list.includes(t.to)) list.push(t.to);
		outboundOrder.set(t.from, list);
	}

	for (const triple of triples) {
		const fromId = ensureBlock(triple.from);
		const toId = ensureBlock(triple.to);

		const inbound = inboundOrder.get(triple.to) ?? [];
		const inputIndex = Math.max(0, inbound.indexOf(triple.from));

		const outbound = outboundOrder.get(triple.from) ?? [];
		const port = Math.max(0, outbound.indexOf(triple.to));

		connections.push({
			id: `conn-${connections.length + 1}`,
			from: { type: "block", id: fromId, port },
			to: { type: "block", id: toId, inputIndex },
		});
	}

	return { blocks, connections };
}

// Back-compat API (previously lived in src/workflow/hydrateFromPlan.ts)
// Agent-view only: tools/uploads/outputs are empty; plan-view IO is handled elsewhere.
export function hydrateWorkflowFromPlan(plan: PlanningBlock): HydratedWorkflow {
	const hydrated = hydrateAgentViewFromPlan(plan);
	return {
		blocks: hydrated.blocks,
		tools: [],
		uploads: [],
		outputs: [],
		connections: hydrated.connections,
	};
}

// -----------------------------------------------------------------------------
// Plan View IO streams
// -----------------------------------------------------------------------------

// TODO: Plan-view upload/download will be reworked later.
// =============================================================================
// IO Streams
// - Plan View IO streams: TODO (rework later)
// - Agent View IO streams: shared hydration/sanitization helpers
// =============================================================================

import type { PlanningBlock } from "../../types/planning";
import type { AgentBlock, Connection, ToolNode } from "../../types";
import {
	findAgentRegistryEntryByIdOrName,
	listMandatoryOptional,
	MIN_IO,
	MAX_IO,
} from "../../constants";
import { parsePlanningJSON } from "./parsePlan";
import { inferTripleOpsByDegree } from "../canvas/planOps";

export type AgentViewHydration = {
	blocks: AgentBlock[];
	connections: Connection[];
};

export type HydratedWorkflow = {
	blocks: AgentBlock[];
	tools: ToolNode[];
	connections: Connection[];
};

export type PlanJsonTriple = { from: string; op: string; to: string };

export type PlanJson = {
	plan_id: string;
	query?: string;
	intent?: string;
	triples: PlanJsonTriple[];
	metadata?: Record<string, unknown>;
	// allow passthrough of unknown extra fields
	[key: string]: unknown;
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

	const blockIdByKey = new Map<string, string>();
	const indexByKey = new Map<string, number>();

	let blockCount = 0;

	const ensureBlock = (label: string) => {
		const resolved = findAgentRegistryEntryByIdOrName(label);
		const key = resolved?.id ?? label;

		const existing = blockIdByKey.get(key);
		if (existing) return existing;

		const id = `block-${++blockCount}`;
		blockIdByKey.set(key, id);
		indexByKey.set(key, indexByKey.size);
		const index = indexByKey.get(key)!;

		const input = resolved ? listMandatoryOptional(resolved.input_data_streams) : { mandatory: [], optional: [] };
		const output = resolved ? listMandatoryOptional(resolved.output_data_streams) : { mandatory: [], optional: [] };
		const inputNames = [...input.mandatory, ...input.optional];
		const outputNames = [...output.mandatory, ...output.optional];

		const inputCount = Math.min(MAX_IO, Math.max(MIN_IO, inputNames.length || 1));
		const outputCount = Math.min(MAX_IO, Math.max(MIN_IO, outputNames.length || 1));
		const mandatoryInputCount = Math.min(resolved ? input.mandatory.length : 0, inputCount);
		const mandatoryOutputCount = Math.min(resolved ? output.mandatory.length : 0, outputCount);

		blocks.push({
			id,
			x: START_X + index * X_GAP,
			y: START_Y,
			agentId: resolved?.id,
			name: resolved?.name ?? label,
			description: resolved?.description ?? "",
			inputCount,
			outputCount,
			inputRequired: Array.from({ length: inputCount }, (_, i) => i < mandatoryInputCount),
			outputRequired: Array.from({ length: outputCount }, (_, i) => i < mandatoryOutputCount),
			inputNames,
			outputNames,
			presetId: resolved?.id ?? "custom",
			mandatoryInputCount,
			mandatoryOutputCount,
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
		connections: hydrated.connections,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function cloneJson<T>(value: T): T {
	// structuredClone is available in modern browsers; fallback keeps behavior in older contexts.
	try {
		return structuredClone(value);
	} catch {
		return JSON.parse(JSON.stringify(value)) as T;
	}
}

export function importAgentViewPlanJson(raw: unknown): { template: PlanJson; workflow: HydratedWorkflow } {
	if (!isRecord(raw) || !Array.isArray(raw["triples"])) {
		throw new Error("Invalid plan JSON (missing triples)");
	}

	const template = cloneJson(raw) as PlanJson;
	const plan = parsePlanningJSON(template);
	const workflow = hydrateWorkflowFromPlan(plan);
	return { template, workflow };
}

function countOps(triples: PlanJsonTriple[]): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const t of triples) {
		const op = String(t.op);
		counts[op] = (counts[op] ?? 0) + 1;
	}
	return counts;
}

export function exportAgentViewPlanJson(args: {
	blocks: AgentBlock[];
	connections: Connection[];
	base?: PlanJson | unknown;
	defaults?: { plan_id?: string; query?: string; intent?: string };
}): PlanJson {
	const { blocks, connections, base, defaults } = args;

	const baseObj: Record<string, unknown> = isRecord(base) ? (cloneJson(base) as Record<string, unknown>) : {};

	// Determine label mapping (prefer names when unique)
	const blockById = new Map(blocks.map((b) => [b.id, b] as const));
	const nameCounts = new Map<string, number>();
	for (const b of blocks) nameCounts.set(b.name, (nameCounts.get(b.name) ?? 0) + 1);
	const hasDuplicateNames = Array.from(nameCounts.values()).some((c) => c > 1);
	const labelFor = (blockId: string) => {
		const b = blockById.get(blockId);
		if (!b) return blockId;
		if (b.agentId) return b.agentId;
		return hasDuplicateNames ? b.id : b.name;
	};

	const rawTriples = connections
		.filter((c) => c.from.type === "block" && c.to.type === "block")
		.map((c) => ({ from: labelFor(c.from.id), to: labelFor(c.to.id) }));

	const inferred = inferTripleOpsByDegree(rawTriples);
	const triples: PlanJsonTriple[] = inferred.map((t) => ({ from: t.from, op: t.op, to: t.to }));

	// Fill required top-level fields without changing existing key order when possible.
	const planId =
		String(baseObj["plan_id"] ?? baseObj["id"] ?? defaults?.plan_id ?? crypto.randomUUID?.() ?? `plan-${Date.now()}`);
	baseObj["plan_id"] = planId;

	if (baseObj["query"] === undefined && defaults?.query !== undefined) baseObj["query"] = defaults.query;
	if (baseObj["intent"] === undefined && defaults?.intent !== undefined) baseObj["intent"] = defaults.intent;
	baseObj["triples"] = triples;

	const meta: Record<string, unknown> = isRecord(baseObj["metadata"])
		? (baseObj["metadata"] as Record<string, unknown>)
		: {};
	meta.total_agents = blocks.length;
	meta.total_triples = triples.length;
	meta.operator_counts = countOps(triples);
	baseObj["metadata"] = meta;

	return baseObj as unknown as PlanJson;
}

// -----------------------------------------------------------------------------
// Plan View IO streams
// -----------------------------------------------------------------------------

// TODO: Plan-view upload/download will be reworked later.
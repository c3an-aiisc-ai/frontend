// =============================================================================
// IO Streams
// - Plan View IO streams: TODO (rework later)
// - Agent View IO streams: shared hydration/sanitization helpers
// =============================================================================

import type { PlanSubTask, PlanningBlock } from "../types/planning";
import type { AgentBlock, Connection, ToolNode } from "../types";
import {
	findAgentRegistryEntryByIdOrName,
	listMandatoryOptional,
	MIN_IO,
	MAX_IO,
} from "../constants";
import { parsePlanningJSON } from "./parsePlan";
import { isRecord } from "../utils";

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
	plan_id?: string;
	task_id?: string;
	main_task?: string;
	query?: string;
	intent?: string;
	sub_tasks?: PlanSubTask[];
	triples: PlanJsonTriple[];
	metadata?: Record<string, unknown>;
	// allow passthrough of unknown extra fields
	[key: string]: unknown;
};

const START_X = 200;
const START_Y = 200;
const X_GAP = 320;
const Y_GAP = 200;

type TripleLike = { from: string; to: string };

function normalizeTriples(plan: PlanningBlock): TripleLike[] {
	const triples = plan.triples ?? [];
	const taskNameById = new Map<string, string>();
	plan.sub_tasks?.forEach((task) => {
		const taskId = task.sub_task_id?.trim();
		const taskName = task.name?.trim();
		if (taskId && taskName) taskNameById.set(taskId, taskName);
	});
	const resolveLabel = (value: string) => taskNameById.get(value) ?? value;
	return triples
		.filter((t) => Boolean(t?.from) && Boolean(t?.to))
		.map((t) => {
			const from = String(t.from ?? "").trim();
			const to = String(t.to ?? "").trim();
			return { from: resolveLabel(from), to: resolveLabel(to) };
		});
}

// Agent-view hydration from a plan is intentionally simple:
// - Create a block per unique agent name.
// - Build deterministic input/output slot allocation based on first-seen ordering.
// - Ignore plan ops for now (seq/brn/agg semantics are plan-view concerns).
export function hydrateAgentViewFromPlan(plan: PlanningBlock): AgentViewHydration {
	const blocks: AgentBlock[] = [];
	const connections: Connection[] = [];

	const mergeUnique = (base: string[], additions: string[], seed: string[] = []) => {
		const seen = new Set([...seed, ...base]);
		const merged = [...base];
		additions.forEach((item) => {
			const trimmed = item.trim();
			if (!trimmed || seen.has(trimmed)) return;
			merged.push(trimmed);
			seen.add(trimmed);
		});
		return merged;
	};

	const taskDescriptionByLabel = new Map<string, string>();
	plan.sub_tasks?.forEach((task) => {
		const description = typeof task.description === "string" ? task.description.trim() : "";
		if (!description) return;
		const id = task.sub_task_id?.trim();
		if (id) taskDescriptionByLabel.set(id.toLowerCase(), description);
		const name = task.name?.trim();
		if (name) taskDescriptionByLabel.set(name.toLowerCase(), description);
	});

	const skillMetadataByLabel = new Map<
		string,
		{ label: string; description: string; knowledgeDependencies: string[] }
	>();
	const skillOrder: string[] = [];
	const shouldUseSkillAgents =
		(plan.sub_tasks?.length ?? 0) === 1 &&
		(plan.triples?.length ?? 0) === 0 &&
		Array.isArray(plan.sub_tasks?.[0]?.required_skills) &&
		plan.sub_tasks?.[0]?.required_skills?.length > 0;

	if (shouldUseSkillAgents) {
		const task = plan.sub_tasks?.[0];
		if (task) {
			const description = typeof task.description === "string" ? task.description.trim() : "";
			const knowledgeDependencies = Array.isArray(task.knowledge_dependencies)
				? task.knowledge_dependencies.map((item) => String(item).trim()).filter(Boolean)
				: [];
			const skills = Array.isArray(task.required_skills) ? task.required_skills : [];
			const seen = new Set<string>();
			skills.forEach((skill) => {
				const label = String(skill).trim();
				if (!label) return;
				const key = label.toLowerCase();
				if (!seen.has(key)) {
					skillOrder.push(label);
					seen.add(key);
				}
				skillMetadataByLabel.set(key, {
					label,
					description,
					knowledgeDependencies,
				});
			});
		}
	}

	const blockIdByKey = new Map<string, string>();
	const indexByKey = new Map<string, number>();
	const indexById = new Map<string, number>();

	let blockCount = 0;

	const ensureBlock = (label: string) => {
		const normalizedLabel = label.trim().toLowerCase();
		const resolved = findAgentRegistryEntryByIdOrName(label);
		const skillMeta = skillMetadataByLabel.get(normalizedLabel);
		const fallbackDescription =
			skillMeta?.description ?? taskDescriptionByLabel.get(normalizedLabel) ?? "";
		const key = resolved?.id ?? label;

		const existing = blockIdByKey.get(key);
		if (existing) return existing;

		const id = `block-${++blockCount}`;
		blockIdByKey.set(key, id);
		indexByKey.set(key, indexByKey.size);
		const index = indexByKey.get(key)!;
		indexById.set(id, index);

		const input = resolved ? listMandatoryOptional(resolved.input_data_streams) : { mandatory: [], optional: [] };
		const output = resolved ? listMandatoryOptional(resolved.output_data_streams) : { mandatory: [], optional: [] };
		const knowledgeDependencies = skillMeta?.knowledgeDependencies ?? [];
		const optionalInputs = mergeUnique(input.optional, knowledgeDependencies, input.mandatory);
		const inputNames = [...input.mandatory, ...optionalInputs];
		const outputNames = [...output.mandatory, ...output.optional];

		const inputCount = Math.min(MAX_IO, Math.max(MIN_IO, inputNames.length || 1));
		const outputCount = Math.min(MAX_IO, Math.max(MIN_IO, outputNames.length || 1));
		const mandatoryInputCount = Math.min(resolved ? input.mandatory.length : 0, inputCount);
		const mandatoryOutputCount = Math.min(resolved ? output.mandatory.length : 0, outputCount);

		blocks.push({
			id,
			x: START_X,
			y: START_Y,
			agentId: resolved?.id,
			name: resolved?.name ?? label,
			description: resolved?.description ?? fallbackDescription,
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

	if (shouldUseSkillAgents) {
		skillOrder.forEach((label) => {
			ensureBlock(label);
		});
	} else {
		plan.sub_tasks?.forEach((task) => {
			const label = task.name?.trim() || task.sub_task_id?.trim();
			if (label) ensureBlock(label);
		});
	}

	const triples = shouldUseSkillAgents
		? skillOrder.slice(0, -1).map((skill, index) => ({
			from: skill,
			to: skillOrder[index + 1],
		}))
		: normalizeTriples(plan);

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

	const adjacency = new Map<string, Set<string>>();
	const indegree = new Map<string, number>();
	for (const block of blocks) {
		adjacency.set(block.id, new Set());
		indegree.set(block.id, 0);
	}
	for (const conn of connections) {
		if (conn.from.type !== "block" || conn.to.type !== "block") continue;
		const neighbors = adjacency.get(conn.from.id);
		if (!neighbors) continue;
		if (!neighbors.has(conn.to.id)) {
			neighbors.add(conn.to.id);
			indegree.set(conn.to.id, (indegree.get(conn.to.id) ?? 0) + 1);
		}
	}

	const depthById = new Map<string, number>();
	const queue = Array.from(blocks)
		.filter((block) => (indegree.get(block.id) ?? 0) === 0)
		.sort((a, b) => (indexById.get(a.id) ?? 0) - (indexById.get(b.id) ?? 0))
		.map((block) => block.id);

	queue.forEach((id) => depthById.set(id, 0));

	while (queue.length) {
		const currentId = queue.shift();
		if (!currentId) break;
		const currentDepth = depthById.get(currentId) ?? 0;
		const neighbors = adjacency.get(currentId);
		if (!neighbors) continue;
		for (const nextId of neighbors) {
			const nextDepth = currentDepth + 1;
			depthById.set(nextId, Math.max(depthById.get(nextId) ?? 0, nextDepth));
			const nextDegree = (indegree.get(nextId) ?? 0) - 1;
			indegree.set(nextId, nextDegree);
			if (nextDegree === 0) queue.push(nextId);
		}
	}

	const columns = new Map<number, string[]>();
	for (const block of blocks) {
		const depth = depthById.get(block.id) ?? 0;
		const list = columns.get(depth) ?? [];
		list.push(block.id);
		columns.set(depth, list);
	}

	const xById = new Map<string, number>();
	const yById = new Map<string, number>();
	for (const [depth, ids] of columns.entries()) {
		ids.sort((a, b) => (indexById.get(a) ?? 0) - (indexById.get(b) ?? 0));
		const gap = ids.length > 1 ? Y_GAP : 0;
		const startY = START_Y - ((ids.length - 1) * gap) / 2;
		ids.forEach((id, row) => {
			xById.set(id, START_X + depth * X_GAP);
			yById.set(id, startY + row * gap);
		});
	}

	const laidOutBlocks = blocks.map((block) => ({
		...block,
		x: xById.get(block.id) ?? block.x,
		y: yById.get(block.id) ?? block.y,
	}));

	return { blocks: laidOutBlocks, connections };
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
	const hasTaskId = typeof template.task_id === "string" && template.task_id.trim().length > 0;
	const hasNewSchema = hasTaskId || typeof template.main_task === "string" || Array.isArray(template.sub_tasks);
	if (hasNewSchema) {
		template.task_id = plan.id;
	} else {
		template.plan_id = plan.id;
	}
	template.triples = plan.triples.map((triple) => ({
		from: triple.from,
		op: triple.op,
		to: triple.to,
	}));
	const workflow = hydrateWorkflowFromPlan(plan);
	return { template, workflow };
}

// -----------------------------------------------------------------------------
// Plan View IO streams
// -----------------------------------------------------------------------------

// TODO: Plan-view upload/download will be reworked later.

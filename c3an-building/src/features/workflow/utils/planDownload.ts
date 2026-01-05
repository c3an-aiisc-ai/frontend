import type { AgentBlock, Connection, PlanningBlock } from "../../../shared/types";
import { normalizePlanOp } from "../../../shared/planning/planOps";
import { TOOL_PORT_OFFSET } from "../../../shared/constants";

type PlanSubTask = NonNullable<PlanningBlock["sub_tasks"]>[number];

export type PlanDownloadEntry = {
  task_id: string;
  main_task: string;
  sub_tasks: PlanSubTask[];
  triples: PlanningBlock["triples"];
};

export type PlanDownloadBundle = {
  plans: PlanDownloadEntry[];
};

const padSubTaskId = (index: number) => `st-${String(index + 1).padStart(3, "0")}`;

const normalizeStringList = (value: string[] | undefined) =>
  Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];

function normalizePlanTriples(triples: PlanningBlock["triples"] | undefined) {
  return (triples ?? [])
    .map((triple) => {
      const from = String(triple?.from ?? "").trim();
      const to = String(triple?.to ?? "").trim();
      if (!from || !to) return null;
      return {
        from,
        op: normalizePlanOp(triple?.op),
        to,
      } satisfies PlanningBlock["triples"][number];
    })
    .filter((triple): triple is PlanningBlock["triples"][number] => Boolean(triple));
}

function buildSubTasks(
  triples: PlanningBlock["triples"],
  existing: PlanningBlock["sub_tasks"] | undefined
) {
  const seen = new Set<string>();
  const result: PlanSubTask[] = [];

  const addTask = (task: PlanSubTask) => {
    const subTaskId = String(task.sub_task_id ?? "").trim();
    if (!subTaskId || seen.has(subTaskId)) return;
    const name = String(task.name ?? "").trim() || subTaskId;
    const description = typeof task.description === "string" ? task.description.trim() : "";
    const knowledgeDependencies = normalizeStringList(task.knowledge_dependencies);
    const requiredSkills = normalizeStringList(task.required_skills);

    const next: PlanSubTask = { sub_task_id: subTaskId, name };
    if (description) next.description = description;
    if (knowledgeDependencies.length) next.knowledge_dependencies = knowledgeDependencies;
    if (requiredSkills.length) next.required_skills = requiredSkills;

    seen.add(subTaskId);
    result.push(next);
  };

  existing?.forEach((task) => addTask(task));

  const addId = (value: string) => {
    const subTaskId = String(value ?? "").trim();
    if (!subTaskId || seen.has(subTaskId)) return;
    seen.add(subTaskId);
    result.push({ sub_task_id: subTaskId, name: subTaskId });
  };

  triples.forEach((triple) => {
    addId(triple.from);
    addId(triple.to);
  });

  return result;
}

export function buildPlanDownloadEntry(plan: PlanningBlock): PlanDownloadEntry {
  const normalizedTriples = normalizePlanTriples(plan.triples);
  const taskId = plan.task_id?.trim() || plan.id;
  const mainTask =
    plan.main_task?.trim() ||
    plan.name?.trim() ||
    plan.query?.trim() ||
    plan.id;
  const subTasks = buildSubTasks(normalizedTriples, plan.sub_tasks);

  return {
    task_id: taskId,
    main_task: mainTask,
    sub_tasks: subTasks,
    triples: normalizedTriples,
  };
}

export function buildPlanDownloadBundle(plans: PlanningBlock[]): PlanDownloadBundle {
  return { plans: plans.map((plan) => buildPlanDownloadEntry(plan)) };
}

function buildSubTasksFromBlocks(blocks: AgentBlock[]) {
  return blocks.map((block, index) => {
    const name = block.name?.trim() || padSubTaskId(index);
    const description = block.description?.trim() || "";
    const subTask: PlanSubTask = {
      sub_task_id: padSubTaskId(index),
      name,
    };
    if (description) subTask.description = description;
    return subTask;
  });
}

function buildTriplesFromConnections(
  connections: Connection[],
  subTaskIdByBlockId: Map<string, string>
) {
  const inbound = new Map<string, Set<string>>();
  const outbound = new Map<string, Set<string>>();
  const edges: Array<{ fromId: string; toId: string }> = [];
  const seen = new Set<string>();

  connections.forEach((conn) => {
    if (conn.from.type !== "block" || conn.to.type !== "block") return;
    const inputIndex = conn.to.inputIndex ?? 0;
    if (inputIndex >= TOOL_PORT_OFFSET) return;
    const fromId = conn.from.id;
    const toId = conn.to.id;
    if (!fromId || !toId) return;
    const key = `${fromId}::${toId}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ fromId, toId });
    if (!outbound.has(fromId)) outbound.set(fromId, new Set());
    if (!inbound.has(toId)) inbound.set(toId, new Set());
    outbound.get(fromId)!.add(toId);
    inbound.get(toId)!.add(fromId);
  });

  return edges.map((edge) => {
    const from = subTaskIdByBlockId.get(edge.fromId) ?? edge.fromId;
    const to = subTaskIdByBlockId.get(edge.toId) ?? edge.toId;
    const inboundCount = inbound.get(edge.toId)?.size ?? 0;
    const outboundCount = outbound.get(edge.fromId)?.size ?? 0;
    let op: PlanningBlock["triples"][number]["op"] = "seq";
    if (inboundCount > 1) op = "agg";
    else if (outboundCount > 1) op = "brn";
    return { from, op, to } satisfies PlanningBlock["triples"][number];
  });
}

export function buildPlanDownloadEntryFromWorkflow(args: {
  blocks: AgentBlock[];
  connections: Connection[];
  taskId?: string | null;
  mainTask?: string | null;
}): PlanDownloadEntry {
  const { blocks, connections, taskId, mainTask } = args;
  const normalizedBlocks = blocks ?? [];
  const subTasks = buildSubTasksFromBlocks(normalizedBlocks);
  const subTaskIdByBlockId = new Map(
    normalizedBlocks.map((block, index) => [block.id, padSubTaskId(index)] as const)
  );
  const triples = buildTriplesFromConnections(connections ?? [], subTaskIdByBlockId);
  const nextTaskId = taskId?.trim() || `task-${Date.now()}`;
  const nextMainTask = mainTask?.trim() || "Untitled task";

  return {
    task_id: nextTaskId,
    main_task: nextMainTask,
    sub_tasks: subTasks,
    triples: normalizePlanTriples(triples),
  };
}

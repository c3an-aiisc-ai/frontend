import type {
  PlanConnections,
  PlanHierarchy,
  PlanSubTask,
  PlanningBlock,
  PlanTriple,
} from "../types/planning";
import {
  PLAN_CARD_DEFAULT_HEIGHT,
  PLAN_CARD_GAP_X,
  PLAN_CARD_WIDTH,
} from "../constants";

type BuildSubPlanHierarchyArgs = {
  subTasks?: PlanSubTask[];
  triples?: PlanTriple[];
  dataAssets?: unknown[];
  buildWorkflowForTask?: (args: {
    subTaskId: string;
    task?: PlanSubTask;
    dataAssets: unknown[];
  }) => PlanningBlock["workflow"] | undefined;
};

export function buildPlanConnectionsFromTriples(triples: PlanTriple[]): PlanConnections {
  const seen = new Set<string>();
  return triples
    .map((triple) => {
      const from = String(triple?.from ?? "").trim();
      const to = String(triple?.to ?? "").trim();
      if (!from || !to) return null;
      const key = `${from}::${to}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return { from, to };
    })
    .filter((conn): conn is { from: string; to: string } => Boolean(conn));
}

export function buildSubPlanHierarchy({
  subTasks = [],
  triples = [],
  dataAssets = [],
  buildWorkflowForTask,
}: BuildSubPlanHierarchyArgs): PlanHierarchy | undefined {
  if (!subTasks.length && !triples.length) return undefined;

  const taskById = new Map<string, PlanSubTask>();
  const orderedIds: string[] = [];
  const seen = new Set<string>();
  const addId = (value: string, task?: PlanSubTask) => {
    const id = value.trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    orderedIds.push(id);
    if (task) taskById.set(id, task);
  };

  subTasks.forEach((task) => {
    if (!task?.sub_task_id) return;
    addId(task.sub_task_id, task);
  });

  triples.forEach((triple) => {
    addId(String(triple?.from ?? ""));
    addId(String(triple?.to ?? ""));
  });

  if (!orderedIds.length) return undefined;

  const gapX = PLAN_CARD_GAP_X;
  const startX = 228;
  const startY = 200;
  const cardWidth = PLAN_CARD_WIDTH;
  const cardHeight = PLAN_CARD_DEFAULT_HEIGHT;
  const railWidth = 64;
  const centerX =
    typeof window === "undefined"
      ? startX
      : railWidth + (window.innerWidth - railWidth) / 2 - cardWidth / 2;
  const centerY =
    typeof window === "undefined"
      ? startY
      : window.innerHeight / 2 - cardHeight / 2;
  const subPlanStartX =
    typeof window === "undefined"
      ? startX
      : centerX - ((orderedIds.length - 1) * gapX) / 2;
  const subPlanY = typeof window === "undefined" ? startY : centerY;

  const isKimoDemoTriad =
    orderedIds.length === 3 &&
    orderedIds.includes("ST-1") &&
    orderedIds.includes("ST-2") &&
    orderedIds.includes("ST-3");

  const orderedIndex = new Map<string, number>();
  orderedIds.forEach((nodeId, index) => {
    orderedIndex.set(nodeId, index);
  });

  const branchTargetsBySource = new Map<string, string[]>();
  triples.forEach((triple) => {
    const from = String(triple?.from ?? "").trim();
    const to = String(triple?.to ?? "").trim();
    if (!from || !to || triple?.op !== "brn") return;
    const existing = branchTargetsBySource.get(from);
    if (existing) {
      if (!existing.includes(to)) existing.push(to);
      return;
    }
    branchTargetsBySource.set(from, [to]);
  });

  const branchOffsets = new Map<string, number>();
  branchTargetsBySource.forEach((targets) => {
    const sortedTargets = [...targets].sort(
      (a, b) => (orderedIndex.get(a) ?? 0) - (orderedIndex.get(b) ?? 0),
    );
    if (sortedTargets.length <= 1) return;
    const branchGapY = 140;
    const totalSpan = (sortedTargets.length - 1) * branchGapY;
    const startOffset = -totalSpan / 2;
    sortedTargets.forEach((target, index) => {
      if (branchOffsets.has(target)) return;
      branchOffsets.set(target, startOffset + index * branchGapY);
    });
  });

  const kimoLeftX = subPlanStartX;
  const kimoRightX = subPlanStartX + gapX * 2;
  const kimoStackGapY = 220;

  const plans = orderedIds.map((nodeId, index) => {
    const task = taskById.get(nodeId);
    const workflow = buildWorkflowForTask?.({
      subTaskId: nodeId,
      task,
      dataAssets,
    });

    return {
      id: nodeId,
      x: isKimoDemoTriad
        ? nodeId === "ST-3"
          ? kimoRightX
          : kimoLeftX
        : subPlanStartX + index * gapX,
      y: isKimoDemoTriad
        ? nodeId === "ST-1"
          ? subPlanY - kimoStackGapY / 2
          : nodeId === "ST-2"
            ? subPlanY + kimoStackGapY / 2
            : subPlanY
        : subPlanY + (branchOffsets.get(nodeId) ?? 0),
      name: task?.name?.trim() || nodeId,
      query: task?.description?.trim() || "",
      triples: [],
      task_id: nodeId,
      ...(task?.name ? { main_task: task.name } : {}),
      ...(task ? { sub_tasks: [task] } : {}),
      ...(workflow ? { workflow } : {}),
    } satisfies PlanningBlock;
  });

  return {
    plans,
    connections: buildPlanConnectionsFromTriples(triples),
  };
}

function scopePlanId(scopePrefix: string, planId: string): string {
  const normalizedPrefix = scopePrefix.trim();
  const normalizedId = planId.trim();
  if (!normalizedPrefix) return normalizedId;
  return `${normalizedPrefix}::${normalizedId}`;
}

function clonePlanWithScopedIds(plan: PlanningBlock, scopePrefix: string): PlanningBlock {
  const scopedId = scopePlanId(scopePrefix, plan.id);
  return {
    ...plan,
    id: scopedId,
    ...(plan.sub_plans
      ? {
          sub_plans: scopePlanHierarchy(plan.sub_plans, scopedId),
        }
      : {}),
  };
}

export function scopePlanHierarchy(
  hierarchy: PlanHierarchy,
  scopePrefix: string,
): PlanHierarchy {
  const idMap = new Map<string, string>();
  const plans = hierarchy.plans.map((plan) => {
    const scopedPlan = clonePlanWithScopedIds(plan, scopePrefix);
    idMap.set(plan.id, scopedPlan.id);
    return scopedPlan;
  });

  const connections = hierarchy.connections
    .map((connection) => {
      const from = idMap.get(connection.from);
      const to = idMap.get(connection.to);
      if (!from || !to) return null;
      return { from, to };
    })
    .filter((connection): connection is { from: string; to: string } => Boolean(connection));

  return { plans, connections };
}

function offsetTopLevelPlans(
  plans: PlanningBlock[],
  origin?: { x: number; y: number },
): PlanningBlock[] {
  if (!origin || plans.length === 0) {
    return plans.map((plan) => ({ ...plan }));
  }

  const minX = Math.min(...plans.map((plan) => plan.x));
  const minY = Math.min(...plans.map((plan) => plan.y));
  const dx = origin.x - minX;
  const dy = origin.y - minY;

  return plans.map((plan) => ({
    ...plan,
    x: plan.x + dx,
    y: plan.y + dy,
  }));
}

function getBoundaryPlanIds(
  plans: PlanningBlock[],
  connections: PlanConnections,
): { entryIds: string[]; exitIds: string[] } {
  const planIds = plans.map((plan) => plan.id);
  const inboundIds = new Set(connections.map((connection) => connection.to));
  const outboundIds = new Set(connections.map((connection) => connection.from));
  const entryIds = planIds.filter((planId) => !inboundIds.has(planId));
  const exitIds = planIds.filter((planId) => !outboundIds.has(planId));

  return {
    entryIds: entryIds.length ? entryIds : planIds.slice(0, 1),
    exitIds: exitIds.length ? exitIds : planIds.slice(-1),
  };
}

export function materializeVisibleSubPlans(args: {
  hierarchy: PlanHierarchy;
  scopePrefix: string;
  origin?: { x: number; y: number };
}): PlanHierarchy {
  const scopedHierarchy = scopePlanHierarchy(args.hierarchy, args.scopePrefix);
  return {
    plans: offsetTopLevelPlans(scopedHierarchy.plans, args.origin),
    connections: scopedHierarchy.connections,
  };
}

export function flattenVisiblePlanHierarchy(args: {
  plans: PlanningBlock[];
  connections?: PlanConnections;
}): PlanHierarchy {
  const visiblePlans: PlanningBlock[] = [];
  const visibleConnections: PlanConnections = [];
  const boundariesByRootId = new Map<string, { entryIds: string[]; exitIds: string[] }>();
  const seenConnections = new Set<string>();

  const addConnection = (from: string, to: string) => {
    const key = `${from}::${to}`;
    if (!from || !to || seenConnections.has(key)) return;
    seenConnections.add(key);
    visibleConnections.push({ from, to });
  };

  args.plans.forEach((plan) => {
    const nestedHierarchy = plan.sub_plans;
    if (nestedHierarchy?.plans?.length) {
      const visibleHierarchy = materializeVisibleSubPlans({
        hierarchy: nestedHierarchy,
        scopePrefix: plan.id,
        origin: { x: plan.x, y: plan.y },
      });
      visiblePlans.push(...visibleHierarchy.plans);
      visibleHierarchy.connections.forEach((connection) =>
        addConnection(connection.from, connection.to),
      );
      boundariesByRootId.set(
        plan.id,
        getBoundaryPlanIds(visibleHierarchy.plans, visibleHierarchy.connections),
      );
      return;
    }

    visiblePlans.push({ ...plan });
    boundariesByRootId.set(plan.id, { entryIds: [plan.id], exitIds: [plan.id] });
  });

  (args.connections ?? []).forEach((connection) => {
    const fromBoundary = boundariesByRootId.get(connection.from);
    const toBoundary = boundariesByRootId.get(connection.to);
    if (!fromBoundary || !toBoundary) return;
    fromBoundary.exitIds.forEach((fromId) => {
      toBoundary.entryIds.forEach((toId) => {
        addConnection(fromId, toId);
      });
    });
  });

  return {
    plans: visiblePlans,
    connections: visibleConnections,
  };
}

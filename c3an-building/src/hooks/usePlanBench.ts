import { useCallback, useEffect } from "react";
import { parsePlanningJSON } from "../shared/planning/parsePlan";
import {
  buildPlanConnectionsFromTriples,
  buildSubPlanHierarchy,
  flattenVisiblePlanHierarchy,
} from "../shared/planning/subPlans";
import {
  PENDING_PLAN_STORAGE_KEY,
  PLAN_CARD_DEFAULT_HEIGHT,
  PLAN_CARD_GAP_X,
  PLAN_CARD_GAP_Y,
  PLAN_CARD_WIDTH,
} from "../shared/constants";
import { isRecord } from "../shared/utils";
import type { PanelKey, PlanningBlock } from "../shared/types";
import {
  buildDemoWorkflowSnapshotForSubTask,
  type DemoDataAsset,
} from "../features/workflow/demoWorkflow";

const formatTaskIdLabel = (taskId: string) => {
  const trimmed = taskId.trim();
  return trimmed;
};

const normalizeWorkflowSnapshot = (
  value: unknown
): PlanningBlock["workflow"] | undefined => {
  if (!isRecord(value)) return undefined;
  const blocks = Array.isArray(value.blocks) ? value.blocks : null;
  const connections = Array.isArray(value.connections) ? value.connections : null;
  const tools = Array.isArray(value.tools) ? value.tools : null;
  if (!blocks && !connections && !tools) return undefined;
  return {
    blocks: blocks ?? [],
    tools: tools ?? [],
    connections: connections ?? [],
    evals: Array.isArray(value.evals) ? value.evals : [],
    notes: Array.isArray(value.notes) ? value.notes : [],
    uploads: Array.isArray(value.uploads) ? value.uploads : [],
    outputs: Array.isArray(value.outputs) ? value.outputs : [],
  };
};

export function usePlanBench(args: {
  applyPlanJson: (src: unknown) => void;
  nextPlanIdRef: React.MutableRefObject<number>;
  planLinkFromRef: React.MutableRefObject<string | null>;
  setPlans: React.Dispatch<React.SetStateAction<PlanningBlock[]>>;
  setPlanConnections: React.Dispatch<React.SetStateAction<Array<{ from: string; to: string }>>>;
  setPlanStack: React.Dispatch<
    React.SetStateAction<
      Array<{
        plans: PlanningBlock[];
        planConnections: Array<{ from: string; to: string }>;
        activePlanId: string | null;
        parentPlanId: string | null;
      }>
    >
  >;
  setActivePlanId: React.Dispatch<React.SetStateAction<string | null>>;
  setViewMode: React.Dispatch<React.SetStateAction<"agent" | "plan">>;
  setActivePanel: React.Dispatch<React.SetStateAction<PanelKey | null>>;
}) {
  const {
    applyPlanJson,
    nextPlanIdRef,
    planLinkFromRef,
    setActivePanel,
    setActivePlanId,
    setPlanConnections,
    setPlans,
    setPlanStack,
    setViewMode,
  } = args;

  const buildPlanBlocksFromPayload = useCallback((entries: unknown[], dataAssets?: unknown[]) => {
    const demoDataAssets = Array.isArray(dataAssets) ? (dataAssets as DemoDataAsset[]) : [];
    const colCount = 2;
    const startX = 228;
    const startY = 200;
    const gapX = PLAN_CARD_GAP_X;
    const gapY = PLAN_CARD_GAP_Y;
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
    const layoutPlans = <T,>(
      items: T[],
      build: (item: T, index: number, x: number, y: number) => PlanningBlock | null
    ) => {
      const single = items.length === 1;
      return items
        .map((item, index) => {
          const col = index % colCount;
          const row = Math.floor(index / colCount);
          const x = single ? centerX : startX + col * gapX;
          const y = single ? centerY : startY + row * gapY;
          return build(item, index, x, y);
        })
        .filter((plan): plan is PlanningBlock => Boolean(plan));
    };

    function resolveSubPlans(
      record: Record<string, unknown>,
      parsed: PlanningBlock
    ): PlanningBlock["sub_plans"] | undefined {
      const rawSubPlans = record.sub_plans;
      if (Array.isArray(rawSubPlans)) {
        const subPlanBlocks = buildPlanBlocks(rawSubPlans, { preserveIds: true });
        if (!subPlanBlocks.length) return undefined;
        return {
          plans: subPlanBlocks,
          connections: buildPlanConnectionsFromTriples(parsed.triples),
        };
      }
      if (isRecord(rawSubPlans) && Array.isArray(rawSubPlans.plans)) {
        const subPlanBlocks = buildPlanBlocks(rawSubPlans.plans, { preserveIds: true });
        if (!subPlanBlocks.length) return undefined;
        const rawConnections = Array.isArray(rawSubPlans.connections)
          ? rawSubPlans.connections
          : [];
        const planIds = new Set(subPlanBlocks.map((plan) => plan.id));
        const connections = rawConnections.filter(
          (conn): conn is { from: string; to: string } =>
            isRecord(conn) &&
            typeof conn.from === "string" &&
            typeof conn.to === "string" &&
            planIds.has(conn.from) &&
            planIds.has(conn.to)
        );
        return {
          plans: subPlanBlocks,
          connections,
        };
      }
      const subTasks = parsed.sub_tasks?.length ? parsed.sub_tasks : [];
      return buildSubPlanHierarchy({
        subTasks,
        triples: parsed.triples,
        dataAssets: demoDataAssets,
        buildWorkflowForTask: ({ subTaskId, dataAssets }) =>
          subTaskId === "ST-1" || subTaskId === "ST-2" || subTaskId === "ST-3"
            ? buildDemoWorkflowSnapshotForSubTask({
                subTaskId,
                dataAssets: dataAssets as DemoDataAsset[],
              })
            : undefined,
      });
    }

    function buildPlanBlocks(
      items: unknown[],
      options?: { preserveIds?: boolean }
    ): PlanningBlock[] {
      const usedIds = new Set<string>();
      return layoutPlans(items, (entry, index, x, y) => {
        void index;
        if (!isRecord(entry)) return null;
        let parsed: PlanningBlock;
        try {
          parsed = parsePlanningJSON(entry);
        } catch {
          return null;
        }

        const record = entry as Record<string, unknown>;
        const rawTaskId = typeof record.task_id === "string" ? record.task_id.trim() : "";
        const rawMainTask = typeof record.main_task === "string" ? record.main_task.trim() : "";
        const rawId =
          rawTaskId ||
          (typeof record.plan_id === "string"
            ? record.plan_id.trim()
            : typeof record.id === "string"
              ? record.id.trim()
              : "");
        const baseId = rawId || parsed.id;
        let id = baseId;
        if (options?.preserveIds) {
          if (usedIds.has(id)) return null;
          usedIds.add(id);
        } else if (usedIds.has(id)) {
          let counter = 1;
          while (usedIds.has(`${baseId}-${counter}`)) counter += 1;
          id = `${baseId}-${counter}`;
          usedIds.add(id);
        } else {
          usedIds.add(id);
        }

        const subTasks = parsed.sub_tasks?.length ? parsed.sub_tasks : undefined;
        const subPlanHierarchy = resolveSubPlans(record, parsed);
        const taskLabel = rawTaskId ? formatTaskIdLabel(rawTaskId) : "";
        const name =
          typeof record.name === "string"
            ? record.name.trim()
            : subPlanHierarchy && taskLabel
              ? taskLabel
              : rawMainTask || baseId;
        const query =
          typeof record.query === "string"
            ? record.query.trim()
            : typeof record.intent === "string"
              ? record.intent.trim()
              : rawMainTask || parsed.query;
        const hasNewSchema = Boolean(rawTaskId || rawMainTask || subTasks || subPlanHierarchy);
        const taskId = hasNewSchema ? (rawTaskId || baseId) : "";
        const workflow = normalizeWorkflowSnapshot(record.workflow);

        return {
          id: String(id),
          x,
          y,
          name: name || String(id),
          query: query ?? "",
          triples: parsed.triples,
          ...(hasNewSchema && taskId ? { task_id: taskId } : {}),
          ...(rawMainTask ? { main_task: rawMainTask } : {}),
          ...(subTasks ? { sub_tasks: subTasks } : {}),
          ...(subPlanHierarchy ? { sub_plans: subPlanHierarchy } : {}),
          ...(workflow ? { workflow } : {}),
        } satisfies PlanningBlock;
      });
    }

    return buildPlanBlocks(entries);
  }, []);

  const buildSequentialPlanConnections = useCallback(
    (nextPlans: PlanningBlock[]) =>
      nextPlans
        .slice(0, -1)
        .map((plan, index) => ({ from: plan.id, to: nextPlans[index + 1].id })),
    []
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return;
    const raw = localStorage.getItem(PENDING_PLAN_STORAGE_KEY);
    if (!raw) return;
    localStorage.removeItem(PENDING_PLAN_STORAGE_KEY);
    try {
      const payload = JSON.parse(raw) as unknown;
      if (isRecord(payload) && payload.mode === "plan" && Array.isArray(payload.plans)) {
        const nextPlans = buildPlanBlocksFromPayload(
          payload.plans,
          Array.isArray(payload.data_assets) ? payload.data_assets : undefined
        );
        if (nextPlans.length) {
          const maxPlan = nextPlans.reduce((max, plan) => {
            if (!plan.id.startsWith("plan-")) return max;
            const n = Number.parseInt(plan.id.slice(5), 10);
            return Number.isFinite(n) ? Math.max(max, n) : max;
          }, 0);
          if (maxPlan > 0) nextPlanIdRef.current = Math.max(nextPlanIdRef.current, maxPlan + 1);
          const nextConnections = buildSequentialPlanConnections(nextPlans);
          const visibleHierarchy = flattenVisiblePlanHierarchy({
            plans: nextPlans,
            connections: nextConnections,
          });
          setPlans(visibleHierarchy.plans);
          setPlanConnections(visibleHierarchy.connections);
          setPlanStack([]);
          planLinkFromRef.current = null;
          setActivePlanId(null);
          setViewMode("plan");
          setActivePanel((prev) => (prev === "tools" ? "blocks" : prev));
          return;
        }
      }
      if (isRecord(payload) && payload.mode === "agent" && payload.plan) {
        setPlanStack([]);
        applyPlanJson(payload.plan);
        return;
      }
      setPlanStack([]);
      applyPlanJson(payload);
    } catch {
      // Ignore invalid pending plan payloads.
    }
  }, [
    applyPlanJson,
    buildPlanBlocksFromPayload,
    buildSequentialPlanConnections,
    nextPlanIdRef,
    planLinkFromRef,
    setActivePanel,
    setActivePlanId,
    setPlanConnections,
    setPlans,
    setPlanStack,
    setViewMode,
  ]);
}

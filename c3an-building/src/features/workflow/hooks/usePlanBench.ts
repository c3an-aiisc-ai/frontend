import { useCallback, useEffect } from "react";
import { parsePlanningJSON } from "../../../shared/planning/parsePlan";
import { PENDING_PLAN_STORAGE_KEY } from "../../../shared/constants";
import { isRecord } from "../../../shared/utils";
import { canvasConfig } from "../../../config";
import type { PlanningBlock } from "../../../shared/types";

export function usePlanBench(args: {
  applyPlanJson: (src: unknown) => void;
  nextPlanIdRef: React.MutableRefObject<number>;
  planLinkFromRef: React.MutableRefObject<string | null>;
  setPlans: React.Dispatch<React.SetStateAction<PlanningBlock[]>>;
  setPlanConnections: React.Dispatch<React.SetStateAction<Array<{ from: string; to: string }>>>;
  setActivePlanId: React.Dispatch<React.SetStateAction<string | null>>;
  setViewMode: React.Dispatch<React.SetStateAction<"agent" | "plan">>;
  setActivePanel: React.Dispatch<React.SetStateAction<"blocks" | "tools" | "settings" | null>>;
}) {
  const {
    applyPlanJson,
    nextPlanIdRef,
    planLinkFromRef,
    setActivePanel,
    setActivePlanId,
    setPlanConnections,
    setPlans,
    setViewMode,
  } = args;

  const buildPlanBlocksFromPayload = useCallback((entries: unknown[]) => {
    const { columnCount: colCount, startX, startY, gapX, gapY } = canvasConfig.planLayout;
    const usedIds = new Set<string>();

    return entries
      .map((entry, index) => {
        if (!isRecord(entry)) return null;
        let parsed: PlanningBlock;
        try {
          parsed = parsePlanningJSON(entry);
        } catch {
          return null;
        }

        const record = entry as Record<string, unknown>;
        const rawId =
          typeof record.plan_id === "string"
            ? record.plan_id.trim()
            : typeof record.id === "string"
              ? record.id.trim()
              : "";
        const baseId = rawId || parsed.id;
        let id = baseId;
        if (usedIds.has(id)) {
          let counter = 1;
          while (usedIds.has(`${baseId}-${counter}`)) counter += 1;
          id = `${baseId}-${counter}`;
        }
        usedIds.add(id);

        const name = typeof record.name === "string" ? record.name.trim() : baseId;
        const query =
          typeof record.query === "string"
            ? record.query.trim()
            : typeof record.intent === "string"
              ? record.intent.trim()
              : parsed.query;

        const col = index % colCount;
        const row = Math.floor(index / colCount);
        return {
          id: String(id),
          x: startX + col * gapX,
          y: startY + row * gapY,
          name: name || String(id),
          query: query ?? "",
          triples: parsed.triples,
        } satisfies PlanningBlock;
      })
      .filter((plan): plan is PlanningBlock => Boolean(plan));
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
        const nextPlans = buildPlanBlocksFromPayload(payload.plans);
        if (nextPlans.length) {
          const maxPlan = nextPlans.reduce((max, plan) => {
            if (!plan.id.startsWith("plan-")) return max;
            const n = Number.parseInt(plan.id.slice(5), 10);
            return Number.isFinite(n) ? Math.max(max, n) : max;
          }, 0);
          if (maxPlan > 0) nextPlanIdRef.current = Math.max(nextPlanIdRef.current, maxPlan + 1);
          setPlans(nextPlans);
          setPlanConnections(buildSequentialPlanConnections(nextPlans));
          planLinkFromRef.current = null;
          setActivePlanId(null);
          setViewMode("plan");
          setActivePanel((prev) => (prev === "tools" ? "blocks" : prev));
          return;
        }
      }
      if (isRecord(payload) && payload.mode === "agent" && payload.plan) {
        applyPlanJson(payload.plan);
        return;
      }
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
    setViewMode,
  ]);
}

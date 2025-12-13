// src/planning/parsePlan.ts

import type { PlanningBlock, PlanTriple } from "../types/planning";
import { normalizePlanOp } from "./planOps";

export function parsePlanningJSON(raw: unknown): PlanningBlock {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Invalid planning JSON");
  }

  const data = raw as any;

  if (!Array.isArray(data.triples)) {
    throw new Error("Planning JSON must contain triples");
  }

  const triples: PlanTriple[] = data.triples.map((t: any) => ({
    from: String(t.from),
    op: normalizePlanOp(t.op),
    to: String(t.to),
  }));

  const planId = data.plan_id ?? data.id ?? crypto.randomUUID();

  return {
    id: String(planId),
    x: 200,
    y: 200,
    name: String(planId),
    query: data.query ?? "",
    triples,
  };
}

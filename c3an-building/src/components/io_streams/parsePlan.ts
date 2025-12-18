// src/components/io_streams/parsePlan.ts

import type { PlanningBlock, PlanTriple } from "../../types/planning";
import { normalizePlanOp } from "../canvas/planOps";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parsePlanningJSON(raw: unknown): PlanningBlock {
  if (!isRecord(raw)) {
    throw new Error("Invalid planning JSON");
  }

  const triplesRaw = raw["triples"];
  if (!Array.isArray(triplesRaw)) {
    throw new Error("Planning JSON must contain triples");
  }

  const triples: PlanTriple[] = triplesRaw.map((t) => {
    if (!isRecord(t)) {
      throw new Error("Invalid triple entry");
    }
    return {
      from: String(t["from"]),
      op: normalizePlanOp(String(t["op"])),
      to: String(t["to"]),
    };
  });

  const planId = raw["plan_id"] ?? raw["id"] ?? crypto.randomUUID();

  return {
    id: String(planId),
    x: 200,
    y: 200,
    name: String(planId),
    query: String(raw["query"] ?? ""),
    triples,
  };
}

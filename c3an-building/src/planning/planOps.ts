// src/planning/planOps.ts

export type PlanOp = "seq" | "brn" | "agg";

export function normalizePlanOp(op: unknown): PlanOp {
  const raw = String(op ?? "").toLowerCase().trim();
  if (raw === "seq" || raw === "sequential") return "seq";
  if (raw === "brn" || raw === "branch" || raw === "bran" || raw === "branching") return "brn";
  if (raw === "agg" || raw === "aggregate" || raw === "aggregator" || raw === "merge") return "agg";
  return "seq";
}

export function computePlanModeFromTriples(
  triples: Array<{ from: string; op?: unknown; to: string }> | undefined
): "sequential" | "branch" | "aggregate" | null {
  const list = (triples ?? []).filter((t) => t?.from && t?.to);
  if (list.length === 0) return null;

  const ops = list.map((t) => normalizePlanOp(t.op));
  if (ops.includes("agg")) return "aggregate";
  if (ops.includes("brn")) return "branch";

  // fallback inference (in case ops omitted)
  const out: Record<string, number> = {};
  const inc: Record<string, number> = {};
  for (const t of list) {
    out[t.from] = (out[t.from] ?? 0) + 1;
    inc[t.to] = (inc[t.to] ?? 0) + 1;
  }
  if (Object.values(inc).some((n) => n > 1)) return "aggregate";
  if (Object.values(out).some((n) => n > 1)) return "branch";
  return "sequential";
}

export function inferTripleOpsByDegree<T extends { from: string; to: string }>(
  triples: T[]
): Array<T & { op: PlanOp }> {
  const out: Record<string, number> = {};
  const inc: Record<string, number> = {};
  for (const t of triples) {
    out[t.from] = (out[t.from] ?? 0) + 1;
    inc[t.to] = (inc[t.to] ?? 0) + 1;
  }

  return triples.map((t) => {
    const op: PlanOp = (inc[t.to] ?? 0) > 1 ? "agg" : (out[t.from] ?? 0) > 1 ? "brn" : "seq";
    return { ...t, op };
  });
}

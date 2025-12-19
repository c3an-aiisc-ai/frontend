import type { PlanTemplate } from "../types/planning";
import { normalizePlanOp } from "../components/canvas/planOps";
import { CUSTOM_PLAN_STORAGE_KEY } from "../constants";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeTriples(value: unknown): PlanTemplate["triples"] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const from = String(entry.from ?? "").trim();
      const to = String(entry.to ?? "").trim();
      if (!from || !to) return null;
      return {
        from,
        to,
        op: normalizePlanOp(entry.op),
      };
    })
    .filter((entry): entry is PlanTemplate["triples"][number] => Boolean(entry));
}

function normalizeStoredPlan(value: unknown, index: number): PlanTemplate | null {
  if (!isRecord(value)) return null;
  const rawId = typeof value.id === "string" ? value.id.trim() : "";
  const rawName = typeof value.name === "string" ? value.name.trim() : "";
  const id = rawId || `custom-plan-${index + 1}`;
  const name = rawName || id;
  const query = typeof value.query === "string" ? value.query : "";
  const triples = normalizeTriples(value.triples);
  return { id, name, query, triples };
}

export function readCustomPlans(): PlanTemplate[] {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return [];
  const raw = localStorage.getItem(CUSTOM_PLAN_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    const list = Array.isArray(parsed)
      ? parsed
      : isRecord(parsed) && Array.isArray(parsed.plans)
        ? parsed.plans
        : [];
    return list
      .map((entry, index) => normalizeStoredPlan(entry, index))
      .filter((entry): entry is PlanTemplate => Boolean(entry));
  } catch {
    return [];
  }
}

export function writeCustomPlans(plans: PlanTemplate[]): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CUSTOM_PLAN_STORAGE_KEY, JSON.stringify(plans));
  } catch {
    // Ignore storage failures (e.g., quota or private mode).
  }
}

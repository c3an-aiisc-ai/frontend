import type { PlanTemplate } from "../types/planning";
import { normalizePlanOp } from "../planning/planOps";
import { normalizeSubTasks } from "../planning/parsePlan";
import { CUSTOM_PLAN_STORAGE_KEY } from "../constants";
import { isRecord } from "./index";

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
  const rawPlanId = typeof value.plan_id === "string" ? value.plan_id.trim() : "";
  const rawTaskId = typeof value.task_id === "string" ? value.task_id.trim() : "";
  const rawName = typeof value.name === "string" ? value.name.trim() : "";
  const rawMainTask = typeof value.main_task === "string" ? value.main_task.trim() : "";
  const id = rawId || rawPlanId || rawTaskId || `custom-plan-${index + 1}`;
  const name = rawName || rawMainTask || id;
  const query = typeof value.query === "string" ? value.query : rawMainTask || "";
  const triples = normalizeTriples(value.triples);
  const subTasks = normalizeSubTasks(value.sub_tasks);
  const hasNewSchema = rawTaskId.length > 0 || rawMainTask.length > 0 || subTasks.length > 0;
  const taskId = hasNewSchema ? (rawTaskId || id) : "";
  return {
    id,
    name,
    query,
    triples,
    ...(hasNewSchema && taskId ? { task_id: taskId } : {}),
    ...(rawMainTask ? { main_task: rawMainTask } : {}),
    ...(subTasks.length ? { sub_tasks: subTasks } : {}),
  };
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

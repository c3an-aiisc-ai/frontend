import { useMemo, useState } from "react";
import type { PlanTemplate } from "../types/planning";
import { parsePlanningJSON } from "../components/io_streams/parsePlan";
import { readCustomPlans, writeCustomPlans } from "../utils/customPlans";
import { PENDING_PLAN_STORAGE_KEY } from "../constants";

const SAMPLE_JSON = `{
  "plans": [
    {
      "plan_id": "fulfillment-rollout",
      "query": "Reduce order latency and boost throughput.",
      "triples": [
        { "from": "Ingest", "op": "seq", "to": "Route" },
        { "from": "Route", "op": "brn", "to": "Ship" },
        { "from": "Route", "op": "brn", "to": "Notify" },
        { "from": "Ship", "op": "seq", "to": "Confirm" }
      ]
    }
  ]
}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildUniqueId(base: string, used: Set<string>): string {
  const root = base.trim() || "plan-template";
  let candidate = root;
  let counter = 1;
  while (used.has(candidate)) {
    candidate = `${root}-${counter}`;
    counter += 1;
  }
  used.add(candidate);
  return candidate;
}

function normalizePlanTemplate(
  value: unknown,
  index: number,
  usedIds: Set<string>
): PlanTemplate | null {
  if (!isRecord(value)) return null;
  const record = value as Record<string, unknown>;
  let parsed: ReturnType<typeof parsePlanningJSON>;
  try {
    const hasId =
      typeof record.plan_id === "string" || typeof record.id === "string";
    parsed = parsePlanningJSON(
      hasId ? record : { ...record, plan_id: `plan-${index + 1}` }
    );
  } catch {
    return null;
  }

  const rawName = typeof record.name === "string" ? record.name.trim() : "";
  const rawId =
    typeof record.plan_id === "string"
      ? record.plan_id.trim()
      : typeof record.id === "string"
        ? record.id.trim()
        : "";
  const name = rawName || rawId || `Plan ${index + 1}`;
  const query =
    typeof record.query === "string"
      ? record.query.trim()
      : typeof record.intent === "string"
        ? record.intent.trim()
        : "";
  const baseId = rawId || rawName || `plan-template-${index + 1}`;
  const id = buildUniqueId(slugify(baseId) || `plan-template-${index + 1}`, usedIds);

  return {
    id,
    name,
    query,
    triples: parsed.triples,
  };
}

function normalizePlanPayload(value: unknown, index: number): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const record = value as Record<string, unknown>;
  let parsed: ReturnType<typeof parsePlanningJSON>;
  try {
    const hasId = typeof record.plan_id === "string" || typeof record.id === "string";
    parsed = parsePlanningJSON(
      hasId ? record : { ...record, plan_id: `plan-${index + 1}` }
    );
  } catch {
    return null;
  }

  const rawId =
    typeof record.plan_id === "string"
      ? record.plan_id.trim()
      : typeof record.id === "string"
        ? record.id.trim()
        : "";
  const planId = rawId || parsed.id;
  const query =
    typeof record.query === "string"
      ? record.query.trim()
      : typeof record.intent === "string"
        ? record.intent.trim()
        : parsed.query;

  return {
    ...record,
    plan_id: planId,
    query: query ?? "",
    triples: parsed.triples,
  };
}

function queuePlansForBench(plans: Record<string, unknown>[]) {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(PENDING_PLAN_STORAGE_KEY, JSON.stringify({ mode: "plan", plans }));
  } catch {
    // Ignore storage failures (e.g., quota or private mode).
  }
}

function extractPlans(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isRecord(value) && Array.isArray(value.plans)) return value.plans;
  if (isRecord(value) && isRecord(value.plan)) return [value.plan];
  if (isRecord(value) && Array.isArray(value.triples)) return [value];
  return [];
}

export default function PlanningPage() {
  const [jsonInput, setJsonInput] = useState(SAMPLE_JSON);
  const [parseError, setParseError] = useState<string | null>(null);
  const [customPlans, setCustomPlans] = useState<PlanTemplate[]>(() => readCustomPlans());
  const [lastAdded, setLastAdded] = useState<PlanTemplate[]>([]);

  const usedIds = useMemo(() => new Set(customPlans.map((plan) => plan.id)), [customPlans]);

  const handleGenerate = () => {
    if (!jsonInput.trim()) {
      setParseError("Paste JSON to generate plan templates.");
      setLastAdded([]);
      return;
    }
    try {
      const parsed = JSON.parse(jsonInput) as unknown;
      const entries = extractPlans(parsed);
      if (entries.length === 0) {
        setParseError("No plans found. Provide an array or { plans: [...] }.");
        setLastAdded([]);
        return;
      }
      const nextUsed = new Set(usedIds);
      const normalized = entries
        .map((entry, index) => normalizePlanTemplate(entry, index, nextUsed))
        .filter((entry): entry is PlanTemplate => Boolean(entry));
      const payloads = entries
        .map((entry, index) => normalizePlanPayload(entry, index))
        .filter((entry): entry is Record<string, unknown> => Boolean(entry));

      if (normalized.length === 0 || payloads.length === 0) {
        setParseError("No valid plans found in the input.");
        setLastAdded([]);
        return;
      }

      const nextPlans = [...customPlans, ...normalized];
      setCustomPlans(nextPlans);
      writeCustomPlans(nextPlans);
      setLastAdded(normalized);
      setParseError(null);
      queuePlansForBench(payloads);
      window.location.hash = "#/workflow";
    } catch (error) {
      setParseError(error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON.");
      setLastAdded([]);
    }
  };

  const handleUseSample = () => {
    setJsonInput(SAMPLE_JSON);
    setParseError(null);
  };

  const handleClearInput = () => {
    setJsonInput("");
    setParseError(null);
    setLastAdded([]);
  };

  const handleRemovePlan = (planId: string) => {
    const next = customPlans.filter((plan) => plan.id !== planId);
    setCustomPlans(next);
    writeCustomPlans(next);
    if (lastAdded.some((plan) => plan.id === planId)) setLastAdded([]);
  };

  const handleClearPlans = () => {
    setCustomPlans([]);
    writeCustomPlans([]);
    setLastAdded([]);
  };

  const planStats = useMemo(() => {
    const totalTriples = customPlans.reduce((acc, plan) => acc + plan.triples.length, 0);
    const nodes = new Set<string>();
    customPlans.forEach((plan) => {
      plan.triples.forEach((triple) => {
        nodes.add(triple.from);
        nodes.add(triple.to);
      });
    });
    return { totalTriples, nodeCount: nodes.size };
  }, [customPlans]);

  return (
    <div className="h-screen overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-amber-50 text-slate-900">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 right-10 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-10 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-12">
        <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">
              Planning page
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              Plan template builder
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-600">
              Paste plan JSON with triples to generate draggable templates for the planning canvas.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="btn-pill btn-pill-light"
              onClick={() => {
                window.location.hash = "#/workflow";
              }}
            >
              Workflow builder
            </button>
            <button
              className="btn-pill btn-pill-light"
              onClick={() => {
                window.location.hash = "#/evaluation";
              }}
            >
              Evaluation
            </button>
            <button
              className="btn-pill btn-pill-light"
              onClick={() => {
                window.location.hash = "#/agentgen";
              }}
            >
              AgentGen
            </button>
            <button
              className="btn-pill btn-pill-amber"
              onClick={handleGenerate}
            >
              Generate plan
            </button>
          </div>
        </header>

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <section className="panel bg-white/80">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">JSON intake</h2>
                <p className="mt-1 text-xs text-slate-600">
                  Accepts {`{ plans: [...] }`}, an array, or a single plan object with triples.
                </p>
              </div>
              <span className="pill-tag pill-tag-amber">
                JSON
              </span>
            </div>

            <textarea
              className="mt-4 min-h-[320px] w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-mono text-slate-800 shadow-inner focus:outline-none focus:ring-2 focus:ring-amber-400"
              value={jsonInput}
              onChange={(event) => setJsonInput(event.target.value)}
              spellCheck={false}
            />

            {parseError && <p className="mt-3 text-xs font-semibold text-rose-600">{parseError}</p>}

            {lastAdded.length > 0 && (
              <p className="mt-3 text-xs font-semibold text-amber-600">
                Added {lastAdded.length} plan{lastAdded.length === 1 ? "" : "s"} to the sidebar palette.
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                className="btn-sm btn-sm-solid-amber px-4"
                onClick={handleGenerate}
              >
                Generate plan
              </button>
              <button
                className="btn-sm btn-sm-outline"
                onClick={handleUseSample}
              >
                Use sample
              </button>
              <button
                className="btn-sm btn-sm-outline"
                onClick={handleClearInput}
              >
                Clear
              </button>
            </div>
          </section>

          <section className="panel bg-white/80">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Custom plan templates</h2>
                <p className="mt-1 text-xs text-slate-600">
                  These plans appear in the Blocks sidebar when you switch to plan view.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600">
                <span className="badge">Plans: {customPlans.length}</span>
                <span className="badge">Triples: {planStats.totalTriples}</span>
                <span className="badge">Nodes: {planStats.nodeCount}</span>
              </div>
            </div>

            {customPlans.length === 0 ? (
              <div className="mt-6 empty-state p-6 text-center text-sm text-slate-500">
                No custom plans yet. Generate some from JSON to populate the palette.
              </div>
            ) : (
              <div className="mt-6 space-y-3 max-h-[420px] overflow-y-auto pr-2">
                {customPlans.map((plan, index) => (
                  <div
                    key={`${plan.id}-${index}`}
                    className="card"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{plan.name}</p>
                        <p className="mt-1 text-xs text-slate-600">
                          {plan.query || "No query provided."}
                        </p>
                      </div>
                      <button
                        className="text-xs font-semibold text-rose-600 hover:text-rose-500"
                        onClick={() => handleRemovePlan(plan.id)}
                      >
                        Delete
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600">
                      <span className="badge-tight bg-amber-50 text-amber-700">
                        {plan.triples.length} triples
                      </span>
                      <span className="badge-tight text-slate-700">
                        ID: {plan.id}
                      </span>
                    </div>

                    {plan.triples.length > 0 && (
                      <div className="mt-3 space-y-1 text-[11px] text-slate-600">
                        {plan.triples.slice(0, 3).map((triple, idx) => (
                          <p key={`${plan.id}-triple-${idx}`}>
                            {triple.from} -&gt; {triple.to}
                          </p>
                        ))}
                        {plan.triples.length > 3 && (
                          <p className="text-[10px] text-slate-400">
                            +{plan.triples.length - 3} more triples
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {customPlans.length > 0 && (
              <div className="mt-4 flex justify-end">
                <button
                  className="btn-sm btn-sm-rose"
                  onClick={handleClearPlans}
                >
                  Clear custom plans
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

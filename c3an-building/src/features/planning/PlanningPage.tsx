import { useMemo, useState } from "react";
import type { PlanTemplate } from "../../shared/types/planning";
import { parsePlanningJSON } from "../../shared/planning/parsePlan";
import { readCustomPlans, writeCustomPlans } from "../../shared/utils/customPlans";
import { PENDING_PLAN_STORAGE_KEY } from "../../shared/constants";
import { buildUniqueId, isRecord, slugify } from "../../shared/utils";

const SAMPLE_JSON = `{
  "plans": [
    {
      "plan_id": "fulfillment-rollout",
      "name": "Fulfillment Rollout",
      "query": "Reduce order latency and boost throughput.",
      "intent": "Stabilize core fulfillment KPIs while scaling volume.",
      "triples": [
        { "from": "Ingest", "op": "seq", "to": "Validate Order" },
        { "from": "Validate Order", "op": "seq", "to": "Route" },
        { "from": "Route", "op": "brn", "to": "Pick Pack" },
        { "from": "Route", "op": "brn", "to": "Carrier Match" },
        { "from": "Route", "op": "brn", "to": "Inventory Check" },
        { "from": "Inventory Check", "op": "seq", "to": "Stockout Alert" },
        { "from": "Pick Pack", "op": "agg", "to": "Label" },
        { "from": "Carrier Match", "op": "agg", "to": "Label" },
        { "from": "Stockout Alert", "op": "agg", "to": "Label" },
        { "from": "Label", "op": "seq", "to": "Quality Scan" },
        { "from": "Quality Scan", "op": "seq", "to": "Ship" },
        { "from": "Ship", "op": "seq", "to": "Confirm" },
        { "from": "Confirm", "op": "seq", "to": "Postmortem" }
      ],
      "metadata": {
        "owner": "Ops",
        "priority": "high"
      }
    },
    {
      "plan_id": "support-triage",
      "name": "Support Triage",
      "query": "Route incoming tickets by urgency, intent, and SLA risk.",
      "triples": [
        { "from": "Intake", "op": "seq", "to": "Classify" },
        { "from": "Classify", "op": "brn", "to": "Urgent Queue" },
        { "from": "Classify", "op": "brn", "to": "Standard Queue" },
        { "from": "Classify", "op": "brn", "to": "Auto Resolve" },
        { "from": "Classify", "op": "brn", "to": "Fraud Review" },
        { "from": "Urgent Queue", "op": "seq", "to": "Escalate" },
        { "from": "Standard Queue", "op": "seq", "to": "Assist" },
        { "from": "Fraud Review", "op": "seq", "to": "Escalate" },
        { "from": "Escalate", "op": "agg", "to": "Resolve" },
        { "from": "Assist", "op": "agg", "to": "Resolve" },
        { "from": "Auto Resolve", "op": "agg", "to": "Resolve" },
        { "from": "Resolve", "op": "seq", "to": "Close" }
      ]
    },
    {
      "plan_id": "research-synthesis",
      "name": "Research Synthesis",
      "query": "Aggregate findings and draft a final report.",
      "triples": [
        { "from": "Collect Sources", "op": "seq", "to": "Summarize" },
        { "from": "Summarize", "op": "brn", "to": "Extract Themes" },
        { "from": "Summarize", "op": "brn", "to": "Draft Outline" },
        { "from": "Summarize", "op": "brn", "to": "Flag Gaps" },
        { "from": "Summarize", "op": "brn", "to": "Pull Quotes" },
        { "from": "Extract Themes", "op": "agg", "to": "Compose Report" },
        { "from": "Draft Outline", "op": "agg", "to": "Compose Report" },
        { "from": "Flag Gaps", "op": "agg", "to": "Compose Report" },
        { "from": "Pull Quotes", "op": "agg", "to": "Compose Report" },
        { "from": "Compose Report", "op": "seq", "to": "Review" },
        { "from": "Review", "op": "seq", "to": "Revise" },
        { "from": "Revise", "op": "seq", "to": "Finalize" }
      ]
    },
    {
      "plan_id": "market-intel-flywheel",
      "name": "Market Intel Flywheel",
      "query": "Continuously gather, verify, and act on market signals.",
      "triples": [
        { "from": "Signal Intake", "op": "seq", "to": "Source Scan" },
        { "from": "Source Scan", "op": "brn", "to": "Competitor Watch" },
        { "from": "Source Scan", "op": "brn", "to": "Customer Pulse" },
        { "from": "Source Scan", "op": "brn", "to": "Analyst Review" },
        { "from": "Source Scan", "op": "brn", "to": "Partner Intel" },
        { "from": "Competitor Watch", "op": "seq", "to": "Validate" },
        { "from": "Customer Pulse", "op": "seq", "to": "Validate" },
        { "from": "Analyst Review", "op": "seq", "to": "Validate" },
        { "from": "Partner Intel", "op": "seq", "to": "Validate" },
        { "from": "Validate", "op": "agg", "to": "Synthesize" },
        { "from": "Synthesize", "op": "seq", "to": "Brief Stakeholders" },
        { "from": "Brief Stakeholders", "op": "seq", "to": "Decide Actions" },
        { "from": "Decide Actions", "op": "seq", "to": "Track Outcomes" }
      ]
    }
  ]
}`;


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
  const id = buildUniqueId(
    slugify(baseId) || `plan-template-${index + 1}`,
    usedIds,
    "plan-template"
  );

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

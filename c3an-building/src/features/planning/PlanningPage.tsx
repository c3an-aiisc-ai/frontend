import { useMemo, useState } from "react";
import type { PlanSubTask, PlanTemplate, PlanTriple } from "../../shared/types/planning";
import { parsePlanningJSON } from "../../shared/planning/parsePlan";
import { readCustomPlans, writeCustomPlans } from "../../shared/utils/customPlans";
import { PENDING_PLAN_STORAGE_KEY } from "../../shared/constants";
import { buildUniqueId, isRecord, slugify } from "../../shared/utils";

const SAMPLE_JSON = `{
  "task_id": "task-7821",
  "main_task": "Plan and execute a product launch campaign",
  "sub_tasks": [
    {
      "sub_task_id": "st-001",
      "name": "Market Research",
      "description": "Analyze target audience and competitive landscape",
      "knowledge_dependencies": ["kg-market-data", "kg-competitor-intel"],
      "required_skills": ["market_analysis", "data_interpretation"]
    },
    {
      "sub_task_id": "st-002",
      "name": "Define Positioning",
      "description": "Create unique value proposition and messaging framework",
      "knowledge_dependencies": ["kg-brand-guidelines", "kg-customer-personas"],
      "required_skills": ["brand_strategy", "copywriting"]
    },
    {
      "sub_task_id": "st-003",
      "name": "Design Creative Assets",
      "description": "Develop visual identity and marketing materials",
      "knowledge_dependencies": ["kg-brand-guidelines", "kg-design-templates"],
      "required_skills": ["graphic_design", "video_production"]
    },
    {
      "sub_task_id": "st-004",
      "name": "Build Landing Page",
      "description": "Create conversion-optimized product landing page",
      "knowledge_dependencies": ["kg-web-standards", "kg-seo-best-practices"],
      "required_skills": ["web_development", "ux_design"]
    },
    {
      "sub_task_id": "st-005",
      "name": "Setup Email Campaign",
      "description": "Configure automated email sequences",
      "knowledge_dependencies": ["kg-email-templates", "kg-marketing-automation"],
      "required_skills": ["email_marketing", "automation"]
    },
    {
      "sub_task_id": "st-006",
      "name": "Launch Social Media",
      "description": "Execute social media campaign across platforms",
      "knowledge_dependencies": ["kg-social-playbook", "kg-content-calendar"],
      "required_skills": ["social_media_marketing", "content_creation"]
    },
    {
      "sub_task_id": "st-007",
      "name": "Monitor and Optimize",
      "description": "Track KPIs and make data-driven adjustments",
      "knowledge_dependencies": ["kg-analytics-framework", "kg-kpi-benchmarks"],
      "required_skills": ["analytics", "optimization"]
    }
  ],
  "triples": [
    {
      "from": "st-001",
      "op": "seq",
      "to": "st-002"
    },
    {
      "from": "st-002",
      "op": "brn",
      "to": "st-003"
    },
    {
      "from": "st-002",
      "op": "brn",
      "to": "st-004"
    },
    {
      "from": "st-002",
      "op": "brn",
      "to": "st-005"
    },
    {
      "from": "st-003",
      "op": "seq",
      "to": "st-006"
    },
    {
      "from": "st-004",
      "op": "agg",
      "to": "st-007"
    },
    {
      "from": "st-005",
      "op": "agg",
      "to": "st-007"
    },
    {
      "from": "st-006",
      "op": "agg",
      "to": "st-007"
    }
  ]
}`;

const SAMPLE_PLAIN_TEXT = `Task ID: task-7821
Main task: Plan and execute a product launch campaign

Subtasks:
- Market Research | Analyze target audience and competitive landscape | knowledge: kg-market-data, kg-competitor-intel | skills: market_analysis, data_interpretation
- Define Positioning | Create unique value proposition and messaging framework | knowledge: kg-brand-guidelines, kg-customer-personas | skills: brand_strategy, copywriting
- Design Creative Assets | Develop visual identity and marketing materials | knowledge: kg-brand-guidelines, kg-design-templates | skills: graphic_design, video_production
- Build Landing Page | Create conversion-optimized product landing page | knowledge: kg-web-standards, kg-seo-best-practices | skills: web_development, ux_design
- Setup Email Campaign | Configure automated email sequences | knowledge: kg-email-templates, kg-marketing-automation | skills: email_marketing, automation
- Launch Social Media | Execute social media campaign across platforms | knowledge: kg-social-playbook, kg-content-calendar | skills: social_media_marketing, content_creation
- Monitor and Optimize | Track KPIs and make data-driven adjustments | knowledge: kg-analytics-framework, kg-kpi-benchmarks | skills: analytics, optimization

Triples:
- 1 -> 2 (seq)
- 2 -> 3 (brn)
- 2 -> 4 (brn)
- 2 -> 5 (brn)
- 3 -> 6 (seq)
- 4 -> 7 (agg)
- 5 -> 7 (agg)
- 6 -> 7 (agg)
`;

type PlainTextTask = {
  id?: string;
  name: string;
  description?: string;
  knowledge_dependencies?: string[];
  required_skills?: string[];
};

type PlainTextParseResult =
  | { plan: { task_id: string; main_task: string; sub_tasks: PlanSubTask[]; triples: PlanTriple[] } }
  | { error: string };

const FIELD_SEPARATORS = /[,;]/g;

function parseList(value: string): string[] {
  return value
    .split(FIELD_SEPARATORS)
    .map((item) => item.trim())
    .filter(Boolean);
}

function stripLinePrefix(value: string): string {
  return value.replace(/^\s*(?:[-*+]\s+|\d+\.\s+)/, "").trim();
}

function looksLikeTaskId(value: string): boolean {
  return /^(st|task|plan)-[a-z0-9-]+$/i.test(value.trim());
}

function looksLikeTripleLine(line: string): boolean {
  if (line.includes("->")) return true;
  return /\S+\s+(seq|brn|agg)\s+\S+/i.test(line);
}

function splitSegments(value: string): string[] {
  if (value.includes("|")) {
    return value
      .split("|")
      .map((segment) => segment.trim())
      .filter(Boolean);
  }
  if (value.includes(" - ")) {
    const [head, ...rest] = value.split(" - ");
    return [head.trim(), rest.join(" - ").trim()].filter(Boolean);
  }
  return [value.trim()].filter(Boolean);
}

function parseTaskLine(line: string): PlainTextTask | null {
  const cleaned = stripLinePrefix(line);
  if (!cleaned) return null;
  if (cleaned.includes("->")) return null;

  const segments = splitSegments(cleaned);
  const task: PlainTextTask = { name: "" };

  segments.forEach((segment) => {
    const trimmed = segment.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    const value = trimmed.includes(":") ? trimmed.split(":").slice(1).join(":").trim() : "";

    if (lower.startsWith("id:") || lower.startsWith("task id:") || lower.startsWith("sub_task_id:")) {
      if (value) task.id = value;
      return;
    }
    if (lower.startsWith("name:")) {
      if (value) task.name = value;
      return;
    }
    if (lower.startsWith("description:") || lower.startsWith("desc:")) {
      if (value) task.description = value;
      return;
    }
    if (
      lower.startsWith("knowledge:") ||
      lower.startsWith("deps:") ||
      lower.startsWith("dependencies:") ||
      lower.startsWith("kg:")
    ) {
      if (value) task.knowledge_dependencies = parseList(value);
      return;
    }
    if (
      lower.startsWith("skills:") ||
      lower.startsWith("required skills:") ||
      lower.startsWith("required:") ||
      lower.startsWith("req:")
    ) {
      if (value) task.required_skills = parseList(value);
      return;
    }

    if (!task.id && looksLikeTaskId(trimmed) && segments.length > 1) {
      task.id = trimmed;
      return;
    }
    if (!task.name) {
      task.name = trimmed;
      return;
    }
    if (!task.description) {
      task.description = trimmed;
      return;
    }
    task.description = `${task.description} ${trimmed}`.trim();
  });

  if (!task.name) return null;
  return task;
}

type TaskLookup = {
  byIndex: Map<number, string>;
  byId: Map<string, string>;
  byName: Map<string, string>;
};

function resolveTaskRef(value: string, lookup: TaskLookup): string | null {
  const cleaned = value.trim();
  if (!cleaned) return null;
  const normalized = cleaned.replace(/^#/, "");
  if (/^\d+$/.test(normalized)) {
    const index = Number(normalized);
    return lookup.byIndex.get(index) ?? null;
  }
  const key = normalized.toLowerCase();
  return lookup.byId.get(key) ?? lookup.byName.get(key) ?? null;
}

function parseTripleLine(
  line: string,
  lookup: TaskLookup
): { triple: PlanTriple | null; unresolved: string[] } {
  const cleaned = stripLinePrefix(line);
  if (!cleaned) return { triple: null, unresolved: [] };

  let fromToken = "";
  let toToken = "";
  let op: PlanTriple["op"] = "seq";

  if (cleaned.includes("->")) {
    const [fromRaw, toRaw] = cleaned.split("->");
    fromToken = fromRaw?.trim() ?? "";
    let right = toRaw?.trim() ?? "";
    const opMatch = right.match(/\((seq|brn|agg)\)/i);
    if (opMatch) {
      op = opMatch[1].toLowerCase() as PlanTriple["op"];
      right = right.replace(opMatch[0], "").trim();
    } else {
      const inlineOp = right.match(/\b(seq|brn|agg)\b/i);
      if (inlineOp) {
        op = inlineOp[1].toLowerCase() as PlanTriple["op"];
        right = right.replace(inlineOp[0], "").trim();
      }
    }
    toToken = right;
  } else {
    const opMatch = cleaned.match(/\b(seq|brn|agg)\b/i);
    if (!opMatch) return { triple: null, unresolved: [] };
    op = opMatch[1].toLowerCase() as PlanTriple["op"];
    const parts = cleaned.split(new RegExp(`\\b${opMatch[1]}\\b`, "i"));
    fromToken = parts[0]?.trim() ?? "";
    toToken = parts.slice(1).join(opMatch[1]).trim();
  }

  if (!fromToken || !toToken) return { triple: null, unresolved: [] };
  const unresolved: string[] = [];
  const from = resolveTaskRef(fromToken, lookup);
  const to = resolveTaskRef(toToken, lookup);
  if (!from) unresolved.push(fromToken);
  if (!to) unresolved.push(toToken);
  if (unresolved.length) return { triple: null, unresolved };
  return { triple: { from, op, to }, unresolved: [] };
}

function parsePlainTextPlan(input: string): PlainTextParseResult {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => Boolean(line))
    .filter((line) => !line.startsWith("#"));

  let mainTask = "";
  let taskId = "";
  const taskLines: string[] = [];
  const tripleLines: string[] = [];
  let mode: "tasks" | "triples" = "tasks";

  lines.forEach((line) => {
    const lower = line.toLowerCase();
    if (lower.startsWith("task id:") || lower.startsWith("plan id:") || lower.startsWith("id:")) {
      taskId = line.split(":").slice(1).join(":").trim();
      return;
    }
    if (lower.startsWith("main task:") || lower.startsWith("main:") || lower.startsWith("plan:")) {
      mainTask = line.split(":").slice(1).join(":").trim();
      return;
    }
    if (lower.startsWith("subtasks:") || lower.startsWith("tasks:")) {
      mode = "tasks";
      return;
    }
    if (
      lower.startsWith("triples:") ||
      lower.startsWith("connections:") ||
      lower.startsWith("edges:")
    ) {
      mode = "triples";
      return;
    }

    const tripleHint = looksLikeTripleLine(line);
    if (mode === "triples" || (mode === "tasks" && tripleHint && taskLines.length > 0)) {
      tripleLines.push(line);
    } else {
      taskLines.push(line);
    }
  });

  const rawTasks = taskLines
    .map((line) => parseTaskLine(line))
    .filter((entry): entry is PlainTextTask => Boolean(entry));

  if (rawTasks.length === 0) {
    return { error: "Add at least one task line under Subtasks." };
  }

  if (!mainTask) {
    mainTask = rawTasks[0]?.name ?? "";
  }
  if (!mainTask) {
    return { error: "Add a main task line such as \"Main task: ...\"." };
  }

  const subTasks: PlanSubTask[] = rawTasks.map((task, index) => {
    const subTaskId = task.id?.trim() || `st-${String(index + 1).padStart(3, "0")}`;
    const subTask: PlanSubTask = {
      sub_task_id: subTaskId,
      name: task.name.trim(),
    };
    if (task.description) subTask.description = task.description;
    if (task.knowledge_dependencies?.length) {
      subTask.knowledge_dependencies = task.knowledge_dependencies;
    }
    if (task.required_skills?.length) {
      subTask.required_skills = task.required_skills;
    }
    return subTask;
  });

  const lookup: TaskLookup = {
    byIndex: new Map(),
    byId: new Map(),
    byName: new Map(),
  };
  subTasks.forEach((task, index) => {
    lookup.byIndex.set(index + 1, task.sub_task_id);
    lookup.byId.set(task.sub_task_id.toLowerCase(), task.sub_task_id);
    lookup.byName.set(task.name.trim().toLowerCase(), task.sub_task_id);
  });

  if (tripleLines.length === 0) {
    return { error: "Add triple lines under a Triples: section." };
  }

  const triples: PlanTriple[] = [];
  const unresolved = new Set<string>();
  const invalidLines: string[] = [];
  tripleLines.forEach((line) => {
    const result = parseTripleLine(line, lookup);
    if (result.unresolved.length) {
      result.unresolved.forEach((entry) => unresolved.add(entry));
      return;
    }
    if (!result.triple) {
      invalidLines.push(line);
      return;
    }
    triples.push(result.triple);
  });

  if (unresolved.size > 0) {
    return {
      error: `Unknown task references in triples: ${Array.from(unresolved).join(", ")}.`,
    };
  }
  if (invalidLines.length > 0) {
    return {
      error: `Could not parse triple lines: ${invalidLines.join(" | ")}.`,
    };
  }

  if (triples.length === 0) {
    return { error: "Provide at least one triple to connect tasks." };
  }

  const resolvedTaskId = taskId || `task-${slugify(mainTask) || "plan"}`;

  return {
    plan: {
      task_id: resolvedTaskId,
      main_task: mainTask,
      sub_tasks: subTasks,
      triples,
    },
  };
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
  const rawMainTask = typeof record.main_task === "string" ? record.main_task.trim() : "";
  const rawTaskId = typeof record.task_id === "string" ? record.task_id.trim() : "";
  const rawId =
    rawTaskId ||
    (typeof record.plan_id === "string"
      ? record.plan_id.trim()
      : typeof record.id === "string"
        ? record.id.trim()
        : "");
  const name = rawName || rawTaskId || rawMainTask || rawId || `Plan ${index + 1}`;
  const query =
    typeof record.query === "string"
      ? record.query.trim()
      : typeof record.intent === "string"
        ? record.intent.trim()
        : rawMainTask || parsed.query;
  const baseId = rawId || rawName || rawMainTask || `plan-template-${index + 1}`;
  const id = buildUniqueId(
    slugify(baseId) || `plan-template-${index + 1}`,
    usedIds,
    "plan-template"
  );
  const subTasks = parsed.sub_tasks?.length ? parsed.sub_tasks : undefined;
  const hasNewSchema = rawTaskId.length > 0 || rawMainTask.length > 0 || Boolean(subTasks);
  const taskId = hasNewSchema ? (rawTaskId || parsed.id) : "";

  return {
    id,
    name,
    query,
    triples: parsed.triples,
    ...(hasNewSchema && taskId ? { task_id: taskId } : {}),
    ...(rawMainTask ? { main_task: rawMainTask } : {}),
    ...(subTasks ? { sub_tasks: subTasks } : {}),
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

  const rawTaskId = typeof record.task_id === "string" ? record.task_id.trim() : "";
  const rawMainTask = typeof record.main_task === "string" ? record.main_task.trim() : "";
  const rawId =
    rawTaskId ||
    (typeof record.plan_id === "string"
      ? record.plan_id.trim()
      : typeof record.id === "string"
        ? record.id.trim()
        : "");
  const planId = rawId || parsed.id;
  const query =
    typeof record.query === "string"
      ? record.query.trim()
      : typeof record.intent === "string"
        ? record.intent.trim()
        : rawMainTask || parsed.query;
  const subTasks = parsed.sub_tasks?.length ? parsed.sub_tasks : undefined;
  const hasNewSchema =
    rawTaskId.length > 0 ||
    rawMainTask.length > 0 ||
    Array.isArray(record.sub_tasks);

  const payload: Record<string, unknown> = {
    ...record,
    query: query ?? "",
    triples: parsed.triples,
  };
  if (rawMainTask) payload.main_task = rawMainTask;
  if (subTasks) payload.sub_tasks = subTasks;
  if (hasNewSchema) {
    payload.task_id = planId;
  } else {
    payload.plan_id = planId;
  }
  return payload;
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
  const [plainTextInput, setPlainTextInput] = useState(SAMPLE_PLAIN_TEXT);
  const [plainTextError, setPlainTextError] = useState<string | null>(null);
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

  const handleGenerateFromText = () => {
    if (!plainTextInput.trim()) {
      setPlainTextError("Paste plain text to build JSON.");
      return;
    }
    const parsed = parsePlainTextPlan(plainTextInput);
    if ("error" in parsed) {
      setPlainTextError(parsed.error);
      return;
    }
    setJsonInput(JSON.stringify(parsed.plan, null, 2));
    setPlainTextError(null);
    setParseError(null);
  };

  const handleUsePlainSample = () => {
    setPlainTextInput(SAMPLE_PLAIN_TEXT);
    setPlainTextError(null);
  };

  const handleClearPlainText = () => {
    setPlainTextInput("");
    setPlainTextError(null);
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

  const resolveNodeLabel = (plan: PlanTemplate, nodeId: string) => {
    const match = plan.sub_tasks?.find((task) => task.sub_task_id === nodeId);
    return match?.name ?? nodeId;
  };

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
              Paste plan JSON with task metadata and triples to generate draggable templates for the planning canvas.
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
          <div className="space-y-6">
            <section className="panel bg-white/80">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Plain text intake</h2>
                  <p className="mt-1 text-xs text-slate-600">
                    Add a main task, list subtasks, then add triples. Generate JSON to populate the intake below.
                  </p>
                </div>
                <span className="pill-tag pill-tag-amber">
                  TEXT
                </span>
              </div>

              <textarea
                className="mt-4 min-h-[280px] w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-800 shadow-inner focus:outline-none focus:ring-2 focus:ring-amber-400"
                value={plainTextInput}
                onChange={(event) => setPlainTextInput(event.target.value)}
                spellCheck={false}
              />

              {plainTextError && (
                <p className="mt-3 text-xs font-semibold text-rose-600">{plainTextError}</p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  className="btn-sm btn-sm-solid-amber px-4"
                  onClick={handleGenerateFromText}
                >
                  Generate JSON
                </button>
                <button
                  className="btn-sm btn-sm-outline"
                  onClick={handleUsePlainSample}
                >
                  Use sample
                </button>
                <button
                  className="btn-sm btn-sm-outline"
                  onClick={handleClearPlainText}
                >
                  Clear
                </button>
              </div>
            </section>

            <section className="panel bg-white/80">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">JSON intake</h2>
                  <p className="mt-1 text-xs text-slate-600">
                    Accepts {`{ plans: [...] }`}, an array, or a single plan with task_id, sub_tasks, and triples.
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
          </div>

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
                            {resolveNodeLabel(plan, triple.from)} -&gt; {resolveNodeLabel(plan, triple.to)}
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

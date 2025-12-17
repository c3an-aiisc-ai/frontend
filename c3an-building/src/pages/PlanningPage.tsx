import { useMemo, useState } from "react";

type PlannerContext = {
  goal?: string;
  summary?: string;
  constraints: string[];
  deliverables: string[];
  agents: string[];
  timeline?: string;
};

type TaskCandidate = {
  title?: unknown;
  name?: unknown;
  description?: unknown;
  objective?: unknown;
  inputs?: unknown;
  input?: unknown;
  outputs?: unknown;
  output?: unknown;
  deliverables?: unknown;
  owner?: unknown;
  agent?: unknown;
  assignee?: unknown;
  priority?: unknown;
  requirements?: unknown;
  workflow?: unknown;
  subtasks?: unknown;
};

type WorkflowStep = {
  id: string;
  title: string;
  description: string;
  agent: string;
  artifacts: string[];
};

type PlannedTask = {
  id: string;
  title: string;
  summary: string;
  owner: string;
  inputs: string[];
  outputs: string[];
  workflow: WorkflowStep[];
};

type PlannerOutput = {
  context: PlannerContext;
  tasks: PlannedTask[];
};

const SAMPLE_JSON = `{
  "goal": "Launch an onboarding playbook",
  "context": "Focus on activation within the first week",
  "constraints": ["2 week delivery window", "Use existing analytics stack"],
  "agents": ["Planner", "Researcher", "Content Strategist", "Designer", "QA Reviewer"],
  "tasks": [
    {
      "title": "Collect onboarding requirements",
      "objective": "Identify activation triggers and blockers",
      "inputs": ["Stakeholder interviews", "Usage data", "Support tickets"],
      "outputs": ["Requirements brief", "Activation KPI list"]
    },
    {
      "title": "Design the onboarding journey",
      "description": "Map lifecycle stages, messaging, and triggers",
      "inputs": ["Requirements brief", "User personas"],
      "outputs": ["Journey map", "Trigger matrix"],
      "workflow": [
        {
          "title": "Synthesize personas",
          "agent": "Researcher",
          "artifacts": ["Persona summary"]
        },
        {
          "title": "Journey mapping",
          "agent": "Designer",
          "artifacts": ["Journey map"]
        },
        {
          "title": "Review and refine",
          "agent": "QA Reviewer",
          "artifacts": ["Final journey map"]
        }
      ]
    }
  ],
  "deliverables": ["Onboarding playbook", "Activation dashboard"]
}`;

const DEFAULT_AGENTS = ["Planner", "Researcher", "Builder", "Reviewer", "Coordinator"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === "string") return item.trim() ? [item.trim()] : [];
      if (isRecord(item)) {
        const label = asString(item.title) ?? asString(item.name);
        return label ? [label] : [];
      }
      return [];
    });
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const uniqueStrings = (items: string[]) => Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));

const extractContext = (data: unknown): PlannerContext => {
  if (!isRecord(data)) {
    return { constraints: [], deliverables: [], agents: [] };
  }

  return {
    goal: asString(data.goal) ?? asString(data.objective) ?? asString(data.project) ?? asString(data.name),
    summary: asString(data.summary) ?? asString(data.context) ?? asString(data.description),
    constraints: uniqueStrings([
      ...toStringArray(data.constraints),
      ...toStringArray(data.assumptions),
      ...toStringArray(data.risks),
    ]),
    deliverables: uniqueStrings([
      ...toStringArray(data.deliverables),
      ...toStringArray(data.outputs),
      ...toStringArray(data.results),
    ]),
    agents: uniqueStrings([...toStringArray(data.agents), ...toStringArray(data.team), ...toStringArray(data.roles)]),
    timeline: asString(data.timeline) ?? asString(data.due_date) ?? asString(data.dueDate),
  };
};

const toTaskCandidate = (value: unknown): TaskCandidate => {
  if (typeof value === "string") return { title: value };
  if (isRecord(value)) return value;
  return { title: "Untitled task" };
};

const extractTaskCandidates = (data: unknown, context: PlannerContext): TaskCandidate[] => {
  if (Array.isArray(data)) return data.map(toTaskCandidate);
  if (!isRecord(data)) return [];

  const listKeys = ["tasks", "steps", "workItems", "work_items", "milestones", "phases"];
  for (const key of listKeys) {
    const value = data[key];
    if (Array.isArray(value)) return value.map(toTaskCandidate);
  }

  const deliverables = toStringArray(data.deliverables);
  if (deliverables.length) {
    return deliverables.map((deliverable) => ({
      title: deliverable,
      description: `Deliver ${deliverable}.`,
    }));
  }

  const isTaskLike =
    Boolean(asString(data.title) ?? asString(data.name)) ||
    Boolean(asString(data.objective) ?? asString(data.description));

  if (isTaskLike) return [data];

  if (context.goal) {
    return [
      {
        title: `Plan ${context.goal}`,
        description: context.summary ?? "Define the scope, inputs, and success criteria.",
      },
    ];
  }

  const keys = Object.keys(data);
  if (keys.length) {
    return keys.map((key) => ({
      title: `Review ${key}`,
      description: `Create a plan of record for ${key}.`,
    }));
  }

  return [];
};

const buildDefaultWorkflow = (
  task: Pick<PlannedTask, "title" | "inputs" | "outputs">,
  agentPool: string[],
  offset: number,
  context: PlannerContext,
): WorkflowStep[] => {
  const inputsHint = task.inputs.length ? ` using ${task.inputs.join(", ")}` : "";
  const outputsHint = task.outputs.length
    ? ` Outputs: ${task.outputs.join(", ")}.`
    : context.deliverables.length
      ? ` Outputs: ${context.deliverables.join(", ")}.`
      : "";
  const finalOutputs = task.outputs.length ? task.outputs : context.deliverables.slice(0, 2);
  const artifactFallback = finalOutputs.length ? finalOutputs : ["Draft output"];

  return [
    {
      id: `step-${offset}-1`,
      title: "Triage and align",
      description: `Confirm scope, constraints, and success metrics${inputsHint}.`,
      agent: agentPool[offset % agentPool.length],
      artifacts: ["Task brief"],
    },
    {
      id: `step-${offset}-2`,
      title: "Design workflow",
      description: `Define the execution plan and tools for ${task.title}.`,
      agent: agentPool[(offset + 1) % agentPool.length],
      artifacts: ["Execution plan"],
    },
    {
      id: `step-${offset}-3`,
      title: "Execute",
      description: `Run the workstream and capture results.${outputsHint}`,
      agent: agentPool[(offset + 2) % agentPool.length],
      artifacts: artifactFallback,
    },
    {
      id: `step-${offset}-4`,
      title: "Review and finalize",
      description: `QA the outputs, resolve gaps, and prepare handoff.`,
      agent: agentPool[(offset + 3) % agentPool.length],
      artifacts: finalOutputs.length ? finalOutputs : ["Final deliverable"],
    },
  ];
};

const buildWorkflowFromCandidates = (
  steps: unknown,
  task: Pick<PlannedTask, "title" | "inputs" | "outputs">,
  agentPool: string[],
  offset: number,
  context: PlannerContext,
): WorkflowStep[] => {
  if (!Array.isArray(steps)) return buildDefaultWorkflow(task, agentPool, offset, context);

  const mapped = steps
    .map((step, stepIndex) => {
      if (typeof step === "string") {
        return {
          id: `step-${offset}-${stepIndex + 1}`,
          title: step,
          description: `Complete ${step.toLowerCase()}.`,
          agent: agentPool[(offset + stepIndex) % agentPool.length],
          artifacts: [],
        };
      }
      if (isRecord(step)) {
        const title = asString(step.title) ?? asString(step.name) ?? `Step ${stepIndex + 1}`;
        return {
          id: `step-${offset}-${stepIndex + 1}`,
          title,
          description:
            asString(step.description) ??
            asString(step.detail) ??
            `Execute ${title.toLowerCase()} for ${task.title}.`,
          agent:
            asString(step.agent) ??
            asString(step.owner) ??
            agentPool[(offset + stepIndex) % agentPool.length],
          artifacts: uniqueStrings([...toStringArray(step.artifacts), ...toStringArray(step.outputs)]),
        };
      }
      return null;
    })
    .filter((step): step is WorkflowStep => Boolean(step));

  return mapped.length ? mapped : buildDefaultWorkflow(task, agentPool, offset, context);
};

const buildPlan = (data: unknown): PlannerOutput => {
  const context = extractContext(data);
  const tasks = extractTaskCandidates(data, context);
  const agentPool = context.agents.length ? context.agents : DEFAULT_AGENTS;

  const plannedTasks = tasks.map((candidate, index) => {
    const title =
      asString(candidate.title) ??
      asString(candidate.name) ??
      (context.goal ? `${context.goal} - task ${index + 1}` : `Task ${index + 1}`);
    const summary =
      asString(candidate.description) ??
      asString(candidate.objective) ??
      context.summary ??
      `Deliver ${title.toLowerCase()}.`;
    const inputs = uniqueStrings([
      ...toStringArray(candidate.inputs),
      ...toStringArray(candidate.input),
      ...toStringArray(candidate.requirements),
    ]);
    let outputs = uniqueStrings([
      ...toStringArray(candidate.outputs),
      ...toStringArray(candidate.output),
      ...toStringArray(candidate.deliverables),
    ]);
    if (!outputs.length && context.deliverables.length) {
      outputs = context.deliverables.slice(0, 2);
    }

    const owner =
      asString(candidate.owner) ??
      asString(candidate.agent) ??
      asString(candidate.assignee) ??
      agentPool[index % agentPool.length];

    const workflow = buildWorkflowFromCandidates(
      Array.isArray(candidate.workflow) ? candidate.workflow : candidate.subtasks,
      { title, inputs, outputs },
      agentPool,
      index + 1,
      context,
    );

    return {
      id: `task-${index + 1}`,
      title,
      summary,
      owner,
      inputs,
      outputs,
      workflow,
    };
  });

  if (!plannedTasks.length) {
    const fallbackTasks = [
      {
        title: "Clarify scope",
        summary: "Align on outcomes, constraints, and success metrics.",
      },
      {
        title: "Design workflow",
        summary: "Break the work into agentic tasks and tool chains.",
      },
      {
        title: "Execute and review",
        summary: "Deliver outputs and validate quality.",
      },
    ];
    const fallbackPlanned = fallbackTasks.map((fallback, index) => ({
      id: `task-${index + 1}`,
      title: fallback.title,
      summary: fallback.summary,
      owner: agentPool[index % agentPool.length],
      inputs: [],
      outputs: context.deliverables.slice(0, 2),
      workflow: buildDefaultWorkflow(
        { title: fallback.title, inputs: [], outputs: context.deliverables.slice(0, 2) },
        agentPool,
        index + 1,
        context,
      ),
    }));
    return { context, tasks: fallbackPlanned };
  }

  return { context, tasks: plannedTasks };
};

const INITIAL_PLAN = buildPlan(JSON.parse(SAMPLE_JSON) as unknown);

const buildChecklist = (tasks: PlannedTask[]) =>
  tasks.reduce<Record<string, boolean>>((acc, task) => {
    acc[task.id] = false;
    return acc;
  }, {});

const buildExpandedState = (tasks: PlannedTask[]) =>
  tasks.reduce<Record<string, boolean>>((acc, task) => {
    acc[task.id] = false;
    return acc;
  }, {});

export default function PlanningPage() {
  const [jsonInput, setJsonInput] = useState(SAMPLE_JSON);
  const [parseError, setParseError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlannerOutput | null>(INITIAL_PLAN);
  const [checklist, setChecklist] = useState<Record<string, boolean>>(() => buildChecklist(INITIAL_PLAN.tasks));
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>(() =>
    buildExpandedState(INITIAL_PLAN.tasks),
  );

  const handleGenerate = () => {
    if (!jsonInput.trim()) {
      setParseError("Paste JSON to generate a plan.");
      setPlan(null);
      return;
    }
    try {
      const parsed = JSON.parse(jsonInput) as unknown;
      const nextPlan = buildPlan(parsed);
      setPlan(nextPlan);
      setChecklist((prev) => {
        const nextChecklist = buildChecklist(nextPlan.tasks);
        nextPlan.tasks.forEach((task) => {
          if (prev[task.id]) nextChecklist[task.id] = prev[task.id];
        });
        return nextChecklist;
      });
      setExpandedTasks(buildExpandedState(nextPlan.tasks));
      setParseError(null);
    } catch (error) {
      setParseError(error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON.");
      setPlan(null);
      setExpandedTasks({});
    }
  };

  const handleUseSample = () => {
    setJsonInput(SAMPLE_JSON);
    setPlan(INITIAL_PLAN);
    setChecklist(buildChecklist(INITIAL_PLAN.tasks));
    setExpandedTasks(buildExpandedState(INITIAL_PLAN.tasks));
    setParseError(null);
  };

  const handleClear = () => {
    setJsonInput("");
    setPlan(null);
    setParseError(null);
    setExpandedTasks({});
  };

  const stats = useMemo(() => {
    if (!plan) {
      return {
        taskCount: 0,
        stepCount: 0,
        agentCount: 0,
        completedCount: 0,
      };
    }
    const taskCount = plan.tasks.length;
    const stepCount = plan.tasks.reduce((total, task) => total + task.workflow.length, 0);
    const agentSet = new Set<string>();
    plan.tasks.forEach((task) => {
      agentSet.add(task.owner);
      task.workflow.forEach((step) => agentSet.add(step.agent));
    });
    const completedCount = plan.tasks.filter((task) => checklist[task.id]).length;
    return {
      taskCount,
      stepCount,
      agentCount: agentSet.size,
      completedCount,
    };
  }, [plan, checklist]);

  const completionRate = stats.taskCount ? Math.round((stats.completedCount / stats.taskCount) * 100) : 0;

  return (
    <div className="h-screen overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-amber-50 text-slate-900">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 -right-32 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 left-10 h-80 w-80 rounded-full bg-emerald-200/40 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-12">
        <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Planning page</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              Agentic task planner
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-600">
              Paste a JSON brief to generate a to-do list with workflows, owners, and execution steps.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-white"
              onClick={() => {
                window.location.hash = "#/workflow";
              }}
            >
              Workflow builder
            </button>
            <button
              className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-white"
              onClick={() => {
                window.location.hash = "#/evaluation";
              }}
            >
              Evaluation map
            </button>
            <button
              className="rounded-full border border-emerald-200 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500"
              onClick={handleGenerate}
            >
              Generate plan
            </button>
          </div>
        </header>

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">JSON intake</h2>
                <p className="mt-1 text-xs text-slate-600">
                  Accepts goals, tasks, and agent lists. Tasks can include custom workflows.
                </p>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                JSON
              </span>
            </div>

            <textarea
              className="mt-4 min-h-[320px] w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-mono text-slate-800 shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-400"
              value={jsonInput}
              onChange={(event) => setJsonInput(event.target.value)}
              spellCheck={false}
            />

            {parseError && <p className="mt-3 text-xs font-semibold text-rose-600">{parseError}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500"
                onClick={handleGenerate}
              >
                Generate plan
              </button>
              <button
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={handleUseSample}
              >
                Use sample
              </button>
              <button
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={handleClear}
              >
                Clear
              </button>
            </div>

            <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Supported fields</p>
              <div className="mt-2 grid gap-2 text-[11px] text-slate-600 sm:grid-cols-2">
                <span>goal, context, constraints</span>
                <span>tasks, steps, milestones</span>
                <span>agents, team, roles</span>
                <span>deliverables, outputs</span>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Plan output</p>
                  <h2 className="mt-2 text-lg font-semibold text-slate-900">To-do list and workflows</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                  <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                    Tasks: {stats.taskCount}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                    Steps: {stats.stepCount}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                    Agents: {stats.agentCount}
                  </span>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>Progress</span>
                  <span>{completionRate}%</span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${completionRate}%` }}
                  />
                </div>
              </div>

              <div className="mt-5 grid gap-4 text-sm text-slate-700 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Goal</p>
                  <p className="mt-2 text-sm text-slate-800">
                    {plan?.context.goal ?? "Not specified"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Timeline</p>
                  <p className="mt-2 text-sm text-slate-800">
                    {plan?.context.timeline ?? "No timeline provided"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Constraints</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(plan?.context.constraints.length
                      ? plan?.context.constraints
                      : ["None listed"]
                    ).map((item) => (
                      <span
                        key={item}
                        className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deliverables</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(plan?.context.deliverables.length
                      ? plan?.context.deliverables
                      : ["None listed"]
                    ).map((item) => (
                      <span
                        key={item}
                        className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {!plan?.tasks.length && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center text-sm text-slate-500">
                  No tasks yet. Generate a plan to see agentic tasks and workflows.
                </div>
              )}

              {plan?.tasks.map((task) => {
                const isExpanded = Boolean(expandedTasks[task.id]);
                const stepCount = task.workflow.length;
                const stepLabel = stepCount === 1 ? "1 step" : `${stepCount} steps`;

                return (
                  <div
                    key={task.id}
                    className={`rounded-2xl border bg-white/90 p-5 shadow-sm transition hover:shadow-md ${
                      isExpanded ? "border-emerald-200 ring-1 ring-emerald-100" : "border-slate-200"
                    }`}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          checked={Boolean(checklist[task.id])}
                          onChange={() =>
                            setChecklist((prev) => ({ ...prev, [task.id]: !prev[task.id] }))
                          }
                        />
                        <button
                          type="button"
                          className="group flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                          onClick={() =>
                            setExpandedTasks((prev) => ({ ...prev, [task.id]: !prev[task.id] }))
                          }
                          aria-expanded={isExpanded}
                          aria-controls={`workflow-${task.id}`}
                        >
                          <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                          <p className="mt-1 text-xs text-slate-600">{task.summary}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-emerald-700">
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">
                              Workflow: {stepLabel}
                            </span>
                            <span className="inline-flex items-center gap-1 text-emerald-700">
                              {isExpanded ? "Hide workflow" : "View workflow"}
                              <svg
                                className={`h-3 w-3 transition-transform ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                aria-hidden="true"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.7a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </span>
                          </div>
                        </button>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
                        Agent: {task.owner}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 text-xs text-slate-600 sm:grid-cols-2">
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Inputs</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(task.inputs.length ? task.inputs : ["TBD"]).map((item) => (
                            <span
                              key={item}
                              className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-xl bg-emerald-50 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Outputs</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(task.outputs.length ? task.outputs : ["TBD"]).map((item) => (
                            <span
                              key={item}
                              className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700 shadow-sm"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div
                        className="mt-5"
                        id={`workflow-${task.id}`}
                        role="region"
                        aria-label={`${task.title} workflow`}
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Workflow
                        </p>
                        <ol className="mt-3 space-y-3">
                          {task.workflow.map((step, stepIndex) => (
                            <li
                              key={step.id}
                              className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3"
                            >
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
                                {stepIndex + 1}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                                <p className="mt-1 text-xs text-slate-600">{step.description}</p>
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                  <span className="rounded-full bg-white px-2 py-1 font-semibold text-slate-600">
                                    Agent: {step.agent}
                                  </span>
                                  {(step.artifacts.length ? step.artifacts : ["No artifacts listed"]).map(
                                    (item) => (
                                      <span
                                        key={`${step.id}-${item}`}
                                        className="rounded-full bg-white px-2 py-1 font-semibold text-slate-500"
                                      >
                                        {item}
                                      </span>
                                    ),
                                  )}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

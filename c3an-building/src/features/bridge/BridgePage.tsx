import { useState, type ChangeEvent } from "react";
import PageBackButton from "../../components/ui/PageBackButton";
import { hrefForRoute, navigateTo } from "../../config";
import {
  AGENT_BLOCK_BASE_HEIGHT,
  AGENT_BLOCK_SLOT_GAP,
  AGENT_BLOCK_TOP_PADDING,
  AGENT_BLOCK_WIDTH,
  PENDING_PLAN_STORAGE_KEY,
  PLAN_WORKSPACE_STORAGE_KEY,
  TOOL_PORT_OFFSET,
} from "../../shared/constants";
import { buildPlanConnectionsFromTriples, flattenVisiblePlanHierarchy } from "../../shared/planning/subPlans";
import type { AgentBlock, AgentRegistryEntry, ToolNode, ToolPreset } from "../../shared/types";
import type { PlanConnections, PlanSubTask, PlanningBlock, PlanningWorkflowSnapshot, PlanTemplate } from "../../shared/types/planning";
import { readCustomAgents, writeCustomAgents } from "../../shared/utils/customAgents";
import { readCustomPlans, writeCustomPlans } from "../../shared/utils/customPlans";
import { readCustomTools, writeCustomTools } from "../../shared/utils/customTools";

type BridgePlan = PlanTemplate & {
  x?: number;
  y?: number;
  workflow?: PlanningWorkflowSnapshot;
  sub_plans?: {
    plans?: BridgePlan[];
    connections?: PlanConnections;
  };
};

type GeneratedComponentsResponse = {
  runId: string;
  delayMs: number;
  generatedAt: string;
  plans: BridgePlan[];
  agents: AgentRegistryEntry[];
  tools: ToolPreset[];
};

type UploadedScriptResponse = {
  fileName: string;
  runId: string;
  durationMs: number;
  timedOut: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  generatedComponents: GeneratedComponentsResponse | null;
  message: string;
};

type SampleScriptResponse = {
  fileName: string;
  path: string;
  content: string;
};

type SlowMathResponse = {
  seed: number;
  delayMs: number;
  iterations: number;
  result: number;
  checkpoints: number[];
};

const sampleScripts = [
  "backend/demo-scripts/minimal_components.py",
  "backend/demo-scripts/logged_components.py",
  "backend/demo-scripts/multi_batch_components.py",
] as const;
const BRIDGE_GENERATED_COMPONENTS_SESSION_KEY = "c3an-bridge-generated-components";

const MAX_IO_COUNT = 5;
const BLOCK_START_X = 180;
const BLOCK_START_Y = 180;
const BLOCK_GAP_X = 320;
const TOOL_WIDTH = 180;
const TOOL_GAP_X = 28;
const TOOL_GAP_Y = 44;
const ROOT_PLAN_X = 228;
const ROOT_PLAN_Y = 200;
const SUBPLAN_GAP_X = 348;

function normalizeSlotNames(names: string[], count: number, prefix: string) {
  const trimmed = names.map((item) => item.trim()).filter(Boolean);
  return Array.from({ length: count }, (_, index) => trimmed[index] ?? `${prefix} ${index + 1}`);
}

function buildStreamConfig(streams: AgentRegistryEntry["input_data_streams"]) {
  const mandatory = (streams.mandatory ?? []).map((item) => item.trim()).filter(Boolean);
  const optional = (streams.optional ?? [])
    .map((item) => item.trim())
    .filter((item) => Boolean(item) && !mandatory.includes(item));
  const count = Math.min(MAX_IO_COUNT, Math.max(1, mandatory.length + optional.length || 1));
  const mandatoryCount = Math.min(count, mandatory.length);
  return {
    count,
    required: Array.from({ length: count }, (_, index) => index < mandatoryCount),
    names: normalizeSlotNames([...mandatory, ...optional], count, "Input"),
    mandatoryCount,
  };
}

function getBlockHeight(block: AgentBlock) {
  const maxSlots = Math.max(block.inputCount, block.outputCount, 1);
  if (maxSlots <= 1) return AGENT_BLOCK_BASE_HEIGHT;
  return Math.max(
    AGENT_BLOCK_BASE_HEIGHT,
    AGENT_BLOCK_TOP_PADDING * 2 + AGENT_BLOCK_SLOT_GAP * (maxSlots - 1),
  );
}

function buildFallbackAgent(label: string): AgentRegistryEntry {
  return {
    id: `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "generated"}-agent`,
    name: label || "Generated Agent",
    description: `Generated workflow agent for ${label || "this plan"}.`,
    capabilities: [],
    input_data_streams: { mandatory: ["input"], optional: [] },
    output_data_streams: { mandatory: ["output"], optional: [] },
  };
}

function buildWorkflowSnapshot(
  label: string,
  agents: AgentRegistryEntry[],
  tools: ToolPreset[],
): PlanningWorkflowSnapshot {
  const blocks: AgentBlock[] = (agents.length ? agents : [buildFallbackAgent(label)]).map(
    (agent, index) => {
      const input = buildStreamConfig(agent.input_data_streams);
      const output = buildStreamConfig(agent.output_data_streams);
      return {
        id: `bridge-block-${index + 1}`,
        x: BLOCK_START_X + index * BLOCK_GAP_X,
        y: BLOCK_START_Y,
        name: agent.name,
        description: agent.description,
        agentId: agent.id,
        sourceAgentId: agent.id,
        inputCount: input.count,
        outputCount: output.count,
        inputRequired: input.required,
        outputRequired: output.required,
        inputNames: input.names,
        outputNames: output.names,
        presetId: agent.id,
        mandatoryInputCount: input.mandatoryCount,
        mandatoryOutputCount: output.mandatoryCount,
      };
    },
  );

  const connections: PlanningWorkflowSnapshot["connections"] = blocks.slice(0, -1).map(
    (block, index) =>
      ({
        id: `bridge-conn-${index + 1}`,
        from: { type: "block", id: block.id, port: 0 },
        to: { type: "block", id: blocks[index + 1]!.id, inputIndex: 0 },
      }) satisfies PlanningWorkflowSnapshot["connections"][number],
  );

  const toolsByBlock = blocks.map(() => [] as ToolPreset[]);
  tools.forEach((tool, index) => {
    toolsByBlock[index % blocks.length]!.push(tool);
  });

  const toolNodes: ToolNode[] = [];
  let nextToolId = 1;
  let nextConnectionId = connections.length + 1;

  toolsByBlock.forEach((toolGroup, blockIndex) => {
    if (!toolGroup.length) return;
    const block = blocks[blockIndex]!;
    const blockHeight = getBlockHeight(block);
    const totalWidth = toolGroup.length * TOOL_WIDTH + (toolGroup.length - 1) * TOOL_GAP_X;
    const startX = block.x + AGENT_BLOCK_WIDTH / 2 - totalWidth / 2;
    const y = block.y + blockHeight + TOOL_GAP_Y;

    toolGroup.forEach((tool, toolIndex) => {
      const id = `bridge-tool-${nextToolId++}`;
      toolNodes.push({
        id,
        x: startX + toolIndex * (TOOL_WIDTH + TOOL_GAP_X),
        y,
        ...tool,
      });
      connections.push({
        id: `bridge-conn-${nextConnectionId++}`,
        from: { type: "tool", id, port: 0 },
        to: { type: "block", id: block.id, inputIndex: TOOL_PORT_OFFSET },
      });
    });
  });

  return {
    blocks,
    tools: toolNodes,
    connections,
    evals: [],
    notes: [],
    uploads: [],
    outputs: [],
  };
}

function buildBuckets<T>(items: T[], bucketCount: number): T[][] {
  const safeCount = Math.max(1, bucketCount);
  const buckets = Array.from({ length: safeCount }, () => [] as T[]);
  if (!items.length) return buckets;
  if (safeCount === 1) {
    buckets[0] = [...items];
    return buckets;
  }
  items.forEach((item, index) => {
    buckets[index % safeCount]!.push(item);
  });
  return buckets;
}

function pickBucket<T>(buckets: T[][], items: T[], index: number): T[] {
  const bucket = buckets[index] ?? [];
  if (bucket.length > 0) return bucket;
  if (!items.length) return [];
  return [items[index % items.length]!];
}

function hasSubPlanHierarchy(plan: BridgePlan) {
  return Array.isArray(plan.sub_plans?.plans) && plan.sub_plans.plans.length > 0;
}

function buildWorkflowLaunchPlan(
  plan: BridgePlan,
  agents: AgentRegistryEntry[],
  tools: ToolPreset[],
): BridgePlan {
  if (hasSubPlanHierarchy(plan)) return plan;

  const subTasks = Array.isArray(plan.sub_tasks) ? plan.sub_tasks : [];
  const bucketCount = Math.max(1, subTasks.length || 1);
  const agentBuckets = buildBuckets(agents, bucketCount);
  const toolBuckets = buildBuckets(tools, bucketCount);

  const workflowPlanForTask = (
    task: PlanSubTask | null,
    index: number,
  ): BridgePlan => {
    const taskId = task?.sub_task_id?.trim() || `${plan.id}-subplan-${index + 1}`;
    const name = task?.name?.trim() || plan.name || taskId;
    const query = task?.description?.trim() || plan.query || "";
    return {
      id: taskId,
      x: ROOT_PLAN_X + index * SUBPLAN_GAP_X,
      y: ROOT_PLAN_Y,
      task_id: taskId,
      name,
      query,
      triples: [],
      ...(name ? { main_task: name } : {}),
      workflow: buildWorkflowSnapshot(
        name,
        pickBucket(agentBuckets, agents, index),
        pickBucket(toolBuckets, tools, index),
      ),
    };
  };

  const subPlans =
    subTasks.length > 0
      ? subTasks.map((task, index) => workflowPlanForTask(task, index))
      : [workflowPlanForTask(null, 0)];

  return {
    ...plan,
    x: ROOT_PLAN_X,
    y: ROOT_PLAN_Y,
    sub_plans: {
      plans: subPlans,
      connections: subTasks.length > 0 ? buildPlanConnectionsFromTriples(plan.triples) : [],
    },
  };
}

function mergeByKey<T>(current: T[], additions: T[], getKey: (item: T) => string): T[] {
  const merged = new Map(current.map((item) => [getKey(item), item] as const));
  additions.forEach((item) => {
    merged.set(getKey(item), item);
  });
  return Array.from(merged.values());
}

async function getErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as { error?: string };
    if (data.error) {
      return data.error;
    }
  } catch {
    return `Request failed with status ${response.status}.`;
  }

  return `Request failed with status ${response.status}.`;
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
  return (await response.json()) as T;
}

function readStoredGeneratedComponents(): GeneratedComponentsResponse | null {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(BRIDGE_GENERATED_COMPONENTS_SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const data = parsed as Partial<GeneratedComponentsResponse>;
    if (
      typeof data.runId !== "string" ||
      typeof data.generatedAt !== "string" ||
      !Array.isArray(data.plans) ||
      !Array.isArray(data.agents) ||
      !Array.isArray(data.tools)
    ) {
      return null;
    }

    return {
      runId: data.runId,
      delayMs: typeof data.delayMs === "number" ? data.delayMs : 0,
      generatedAt: data.generatedAt,
      plans: data.plans as BridgePlan[],
      agents: data.agents as AgentRegistryEntry[],
      tools: data.tools as ToolPreset[],
    };
  } catch {
    return null;
  }
}

function writeStoredGeneratedComponents(data: GeneratedComponentsResponse) {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(BRIDGE_GENERATED_COMPONENTS_SESSION_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage failures.
  }
}

export default function BridgePage() {
  const [seedValue, setSeedValue] = useState("7");
  const [slowMathLoading, setSlowMathLoading] = useState(false);
  const [slowMathError, setSlowMathError] = useState<string | null>(null);
  const [slowMathResult, setSlowMathResult] = useState<SlowMathResponse | null>(null);
  const [componentsLoading, setComponentsLoading] = useState(false);
  const [componentsError, setComponentsError] = useState<string | null>(null);
  const [generatedComponents, setGeneratedComponents] = useState<GeneratedComponentsResponse | null>(
    () => readStoredGeneratedComponents(),
  );
  const [selectedScript, setSelectedScript] = useState<File | null>(null);
  const [scriptRunLoading, setScriptRunLoading] = useState(false);
  const [scriptRunError, setScriptRunError] = useState<string | null>(null);
  const [scriptRunResult, setScriptRunResult] = useState<UploadedScriptResponse | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState<string | null>(null);
  const [viewerContent, setViewerContent] = useState("");
  const [viewerMinimized, setViewerMinimized] = useState(false);

  function applyGeneratedComponents(data: GeneratedComponentsResponse) {
    writeCustomPlans(mergeByKey(readCustomPlans(), data.plans, (plan) => plan.id));
    writeCustomAgents(mergeByKey(readCustomAgents(), data.agents, (agent) => agent.id));
    writeCustomTools(mergeByKey(readCustomTools(), data.tools, (tool) => tool.name));
    writeStoredGeneratedComponents(data);
    setGeneratedComponents(data);
  }

  function handleOpenGeneratedPlan(plan: BridgePlan) {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return;
    try {
      const queuedPlan = buildWorkflowLaunchPlan(
        plan,
        generatedComponents?.agents ?? [],
        generatedComponents?.tools ?? [],
      );
      const workspacePlan = queuedPlan as PlanningBlock;
      const visibleHierarchy = flattenVisiblePlanHierarchy({
        plans: [workspacePlan],
        connections: [],
      });
      localStorage.setItem(
        PLAN_WORKSPACE_STORAGE_KEY,
        JSON.stringify({
          plans: visibleHierarchy.plans,
          planConnections: visibleHierarchy.connections,
          activePlanId: null,
          viewMode: "plan",
          nextPlanId: 1,
          planStack: [],
        }),
      );
      localStorage.setItem(
        PENDING_PLAN_STORAGE_KEY,
        JSON.stringify({ mode: "plan", plans: [queuedPlan] }),
      );
      navigateTo("editor");
    } catch {
      setComponentsError("Unable to open the generated plan in Workflow Builder.");
    }
  }

  async function handleRunSlowMath() {
    setSlowMathLoading(true);
    setSlowMathError(null);
    setSlowMathResult(null);

    try {
      const data = await requestJson<SlowMathResponse>("/api/slow-math", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ seed: seedValue }),
      });
      setSlowMathResult(data);
    } catch (error) {
      setSlowMathError(
        error instanceof Error ? error.message : "Unable to run the backend calculation.",
      );
    } finally {
      setSlowMathLoading(false);
    }
  }

  async function handleGenerateComponents() {
    setComponentsLoading(true);
    setComponentsError(null);
    setGeneratedComponents(null);

    try {
      const data = await requestJson<GeneratedComponentsResponse>("/api/generated-components", {
        method: "POST",
      });
      applyGeneratedComponents(data);
    } catch (error) {
      setComponentsError(
        error instanceof Error ? error.message : "Unable to generate live components.",
      );
    } finally {
      setComponentsLoading(false);
    }
  }

  function handleScriptSelection(event: ChangeEvent<HTMLInputElement>) {
    setScriptRunError(null);
    setScriptRunResult(null);
    setViewerError(null);
    const nextFile = event.target.files?.[0] ?? null;
    setSelectedScript(nextFile);
    if (!nextFile) {
      setViewerTitle(null);
      setViewerContent("");
      return;
    }

    setViewerLoading(true);
    setViewerTitle(nextFile.name);
    void nextFile
      .text()
      .then((text) => {
        setViewerContent(text);
      })
      .catch(() => {
        setViewerError("Unable to preview the selected script.");
        setViewerContent("");
      })
      .finally(() => {
        setViewerLoading(false);
      });
  }

  async function handleViewSampleScript(scriptPath: string) {
    const fileName = scriptPath.split("/").pop() ?? scriptPath;
    setViewerLoading(true);
    setViewerError(null);

    try {
      const data = await requestJson<SampleScriptResponse>(
        `/api/generated-components/sample-script/${encodeURIComponent(fileName)}`,
      );
      setViewerTitle(data.path);
      setViewerContent(data.content);
    } catch (error) {
      setViewerError(error instanceof Error ? error.message : "Unable to load sample script.");
      setViewerTitle(fileName);
      setViewerContent("");
    } finally {
      setViewerLoading(false);
    }
  }

  async function handleRunUploadedScript() {
    if (!selectedScript) {
      setScriptRunError("Choose a Python script to run.");
      return;
    }

    setScriptRunLoading(true);
    setScriptRunError(null);
    setScriptRunResult(null);
    setGeneratedComponents(null);

    const formData = new FormData();
    formData.append("script", selectedScript);

    try {
      const response = await fetch("/api/generated-components/upload", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as UploadedScriptResponse | { error?: string };
      const maybeScriptResponse =
        typeof data === "object" &&
        data &&
        "fileName" in data &&
        "runId" in data &&
        "durationMs" in data
          ? (data as UploadedScriptResponse)
          : null;
      if (!response.ok) {
        if (maybeScriptResponse) {
          setScriptRunResult(maybeScriptResponse);
        }
        throw new Error(
          typeof data === "object" && data && "error" in data && typeof data.error === "string"
            ? data.error
            : maybeScriptResponse?.message ?? `Request failed with status ${response.status}.`,
        );
      }

      const scriptResponse = maybeScriptResponse as UploadedScriptResponse;
      setScriptRunResult(scriptResponse);
      if (scriptResponse.generatedComponents) {
        applyGeneratedComponents(scriptResponse.generatedComponents);
      }
    } catch (error) {
      setScriptRunError(error instanceof Error ? error.message : "Unable to run uploaded script.");
    } finally {
      setScriptRunLoading(false);
    }
  }

  return (
    <div className="min-h-full overflow-y-auto bg-slate-50 text-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PageBackButton fallbackRoute="home" />
          <a
            href={hrefForRoute("editor")}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
          >
            Open Workflow Builder
          </a>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">Flask Bridge</h1>

          <div className="mt-5 flex flex-wrap items-end gap-3">
            <label className="flex min-w-[180px] flex-col gap-2 text-sm font-medium text-slate-700">
              Seed
              <input
                type="number"
                value={seedValue}
                onChange={(event) => setSeedValue(event.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                void handleRunSlowMath();
              }}
              disabled={slowMathLoading}
              className="rounded-lg border border-slate-200 bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {slowMathLoading ? "Running Calculation..." : "Run Calculation"}
            </button>
          </div>

          {slowMathError ? <p className="mt-3 text-sm text-rose-600">{slowMathError}</p> : null}
          {slowMathResult ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <div>
                Seed {slowMathResult.seed} to {slowMathResult.result}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {slowMathResult.iterations.toLocaleString()} iterations in {slowMathResult.delayMs}ms
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {slowMathResult.checkpoints.map((checkpoint, index) => (
                  <span
                    key={`${checkpoint}-${index}`}
                    className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200"
                  >
                    {checkpoint}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <label className="cursor-pointer rounded-lg border border-slate-200 bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
              Choose Python Script
              <input
                type="file"
                accept=".py"
                className="hidden"
                onChange={handleScriptSelection}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                void handleRunUploadedScript();
              }}
              disabled={!selectedScript || scriptRunLoading}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {scriptRunLoading ? "Running Upload..." : "Run Uploaded Script"}
            </button>
            <button
              type="button"
              onClick={() => {
                void handleGenerateComponents();
              }}
              disabled={componentsLoading}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {componentsLoading ? "Running Demo..." : "Run Demo Script"}
            </button>
          </div>

          <p className="mt-3 text-sm text-slate-600">
            {selectedScript ? selectedScript.name : "No script selected."}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Script output must print JSON with `plans`, `agents`, and `tools`.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {sampleScripts.map((scriptPath) => {
              const label = scriptPath.split("/").pop() ?? scriptPath;
              return (
                <button
                  key={scriptPath}
                  type="button"
                  onClick={() => {
                    void handleViewSampleScript(scriptPath);
                  }}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                >
                  {label}
                </button>
              );
            })}
          </div>

          {componentsError ? <p className="mt-4 text-sm text-rose-600">{componentsError}</p> : null}
          {scriptRunError ? <p className="mt-2 text-sm text-rose-600">{scriptRunError}</p> : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950">Script Viewer</h2>
            <div className="flex flex-wrap items-center gap-3">
              {viewerTitle ? <div className="text-xs text-slate-500">{viewerTitle}</div> : null}
              <button
                type="button"
                onClick={() => setViewerMinimized((current) => !current)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
              >
                {viewerMinimized ? "Expand" : "Minimize"}
              </button>
            </div>
          </div>
          {!viewerMinimized ? (
            <>
              {viewerError ? <p className="mt-3 text-sm text-rose-600">{viewerError}</p> : null}
              <pre className="mt-4 max-h-[520px] overflow-auto rounded-xl bg-slate-950 p-4 whitespace-pre-wrap break-words text-xs leading-5 text-slate-200">
                {viewerLoading
                  ? "Loading script..."
                  : viewerContent || "Choose a sample script or upload a .py file to preview it here."}
              </pre>
            </>
          ) : null}
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Subplans
            </div>
            <div className="mt-3 text-3xl font-semibold text-slate-950">
              {generatedComponents?.plans.length ?? 0}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Agents
            </div>
            <div className="mt-3 text-3xl font-semibold text-slate-950">
              {generatedComponents?.agents.length ?? 0}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Tools
            </div>
            <div className="mt-3 text-3xl font-semibold text-slate-950">
              {generatedComponents?.tools.length ?? 0}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950">Generated Plans</h2>
            {generatedComponents ? (
              <div className="text-xs text-slate-500">{generatedComponents.runId}</div>
            ) : null}
          </div>

          {generatedComponents?.plans.length ? (
            <div className="mt-4 grid gap-3">
              {generatedComponents.plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => handleOpenGeneratedPlan(plan)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-slate-300 hover:bg-white"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-950">{plan.name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {plan.task_id || plan.id}
                      </div>
                    </div>
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                      Open in Builder
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    {plan.query || "No query provided."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                      Subplans {plan.sub_tasks?.length ?? plan.sub_plans?.plans?.length ?? 0}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                      Agents {generatedComponents.agents.length}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                      Tools {generatedComponents.tools.length}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-600">Run a script to generate a plan.</p>
          )}
        </section>

        {scriptRunResult ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">{scriptRunResult.fileName}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {scriptRunResult.runId} · {scriptRunResult.durationMs}ms · Exit{" "}
                  {scriptRunResult.exitCode ?? "timeout"}
                </div>
              </div>
              <div
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                  scriptRunResult.generatedComponents
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {scriptRunResult.generatedComponents ? "Components parsed" : "No component JSON"}
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-600">{scriptRunResult.message}</p>
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Stdout
            </div>
            <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-slate-200">
              {scriptRunResult?.stdout || "No stdout yet."}
            </pre>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Stderr
            </div>
            <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-slate-200">
              {scriptRunResult?.stderr || "No stderr yet."}
            </pre>
          </div>
        </section>
      </div>
    </div>
  );
}

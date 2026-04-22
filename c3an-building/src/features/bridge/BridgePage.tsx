import { useState, type ChangeEvent } from "react";
import PageBackButton from "../../components/ui/PageBackButton";
import { hrefForRoute } from "../../config";
import type { AgentRegistryEntry, ToolPreset } from "../../shared/types";
import type { PlanTemplate } from "../../shared/types/planning";
import { readCustomAgents, writeCustomAgents } from "../../shared/utils/customAgents";
import { readCustomPlans, writeCustomPlans } from "../../shared/utils/customPlans";
import { readCustomTools, writeCustomTools } from "../../shared/utils/customTools";

type GeneratedComponentsResponse = {
  runId: string;
  delayMs: number;
  generatedAt: string;
  plans: PlanTemplate[];
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

const sampleScripts = [
  "backend/demo-scripts/minimal_components.py",
  "backend/demo-scripts/logged_components.py",
  "backend/demo-scripts/multi_batch_components.py",
] as const;

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

export default function BridgePage() {
  const [componentsLoading, setComponentsLoading] = useState(false);
  const [componentsError, setComponentsError] = useState<string | null>(null);
  const [generatedComponents, setGeneratedComponents] = useState<GeneratedComponentsResponse | null>(
    null,
  );
  const [selectedScript, setSelectedScript] = useState<File | null>(null);
  const [scriptRunLoading, setScriptRunLoading] = useState(false);
  const [scriptRunError, setScriptRunError] = useState<string | null>(null);
  const [scriptRunResult, setScriptRunResult] = useState<UploadedScriptResponse | null>(null);

  function applyGeneratedComponents(data: GeneratedComponentsResponse) {
    writeCustomPlans(mergeByKey(readCustomPlans(), data.plans, (plan) => plan.id));
    writeCustomAgents(mergeByKey(readCustomAgents(), data.agents, (agent) => agent.id));
    writeCustomTools(mergeByKey(readCustomTools(), data.tools, (tool) => tool.name));
    setGeneratedComponents(data);
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
    const nextFile = event.target.files?.[0] ?? null;
    setSelectedScript(nextFile);
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
          <p className="mt-2 text-sm text-slate-600">
            Sample scripts: {sampleScripts.join(" · ")}
          </p>

          {componentsError ? <p className="mt-4 text-sm text-rose-600">{componentsError}</p> : null}
          {scriptRunError ? <p className="mt-2 text-sm text-rose-600">{scriptRunError}</p> : null}
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

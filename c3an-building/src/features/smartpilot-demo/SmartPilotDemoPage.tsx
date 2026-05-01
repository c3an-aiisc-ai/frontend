import { useEffect, useMemo, useState } from "react";
import { hrefForRoute, navigateTo } from "../../config";
import type { Theme } from "../../shared/types";
import { resolveSmartPilotAgents, type SmartPilotCapabilityKey, type SmartPilotResolvedAgent } from "./smartPilotDemoRegistry";

type CsvSample = {
  path?: string | null;
  columns?: string[];
  rows?: Array<Record<string, string>>;
  row_count?: number;
  error?: string;
  question?: string;
  answer?: string;
};

type DemoSampleResponse = {
  datasets?: {
    predictx_features?: CsvSample;
    foresight_production?: CsvSample;
    foresight_process?: CsvSample;
    infoguide_qa?: CsvSample;
  };
  modalities?: string[];
  warnings?: string[];
};

type PilotResult = {
  pilot?: string;
  status?: string;
  count?: number;
  error?: string;
  error_type?: string;
  result?: Record<string, unknown>;
  artifacts?: Record<string, unknown>;
};

type SmartPilotWorkflowResponse = {
  workflow?: string;
  status?: string;
  output_dir?: string;
  results?: Partial<Record<SmartPilotCapabilityKey, PilotResult>>;
  artifacts?: Record<string, unknown>;
};

type LoadState = "idle" | "loading" | "ready" | "error";

const resultTitles: Record<SmartPilotCapabilityKey, string> = {
  predictx: "Anomaly Prediction",
  foresight: "Production Forecast",
  infoguide: "Domain Q&A",
};

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error?: unknown }).error)
        : `Request failed with ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function predictionRows(result: PilotResult | undefined): number[][] {
  const payload = asRecord(result?.result);
  const predictions = payload.predictions;
  if (!Array.isArray(predictions)) return [];
  return predictions
    .filter((row): row is unknown[] => Array.isArray(row))
    .map((row) => row.map((value) => Number(value)).filter((value) => Number.isFinite(value)));
}

function formatValue(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return value.toFixed(3);
  const text = String(value ?? "");
  return text.length > 90 ? `${text.slice(0, 87)}...` : text;
}

function statusTone(status: string | undefined): string {
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "error") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "partial") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

function SampleTable({
  sample,
  emptyLabel,
  maxColumns = 6,
  maxRows = 3,
}: {
  sample: CsvSample | undefined;
  emptyLabel: string;
  maxColumns?: number;
  maxRows?: number;
}) {
  if (sample?.error) {
    return <p className="text-sm leading-6 text-rose-600">{sample.error}</p>;
  }

  const rows = sample?.rows?.slice(0, maxRows) ?? [];
  const columns = (sample?.columns ?? Object.keys(rows[0] ?? {})).slice(0, maxColumns);
  if (!rows.length || !columns.length) {
    return <p className="text-sm leading-6 text-slate-500">{emptyLabel}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            {columns.map((column) => (
              <th key={column} className="whitespace-nowrap px-3 py-2 font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-slate-100 last:border-0">
              {columns.map((column) => (
                <td key={column} className="max-w-[180px] truncate px-3 py-2 text-slate-700">
                  {formatValue(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RegistryPanel({
  agents,
  theme,
}: {
  agents: SmartPilotResolvedAgent[];
  theme: Theme;
}) {
  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Registered agent pipeline</p>
          <h2 className={`mt-2 text-2xl font-semibold tracking-tight ${theme === "dark" ? "text-slate-100" : "text-slate-950"}`}>
            SmartPilot connects three existing agents
          </h2>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {agents.map((item) => (
          <div
            key={item.key}
            className={`rounded-lg border p-5 shadow-sm ${
              theme === "dark" ? "border-slate-700 bg-slate-900/80" : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.paperCapability}</p>
                <h3 className={`mt-2 text-xl font-semibold ${theme === "dark" ? "text-slate-100" : "text-slate-950"}`}>
                  {item.agent?.name ?? item.title}
                </h3>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                {item.runtimeAgentId}
              </span>
            </div>
            <p className={`mt-3 text-sm leading-6 ${theme === "dark" ? "text-slate-300" : "text-slate-600"}`}>
              {item.agent?.description ?? item.missingMessage}
            </p>
            {item.agent ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {item.agent.capabilities.slice(0, 3).map((capability) => (
                  <span key={capability} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    {capability}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{item.missingMessage}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function ResultPanel({
  result,
  resultKey,
  theme,
}: {
  result: PilotResult | undefined;
  resultKey: SmartPilotCapabilityKey;
  theme: Theme;
}) {
  const rows = predictionRows(result);
  const payload = asRecord(result?.result);
  const route = asRecord(payload.route);
  const status = result?.status ?? "not run";

  return (
    <div className={`rounded-lg border p-5 shadow-sm ${theme === "dark" ? "border-slate-700 bg-slate-900/80" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{resultTitles[resultKey]}</p>
          <h3 className={`mt-2 text-lg font-semibold ${theme === "dark" ? "text-slate-100" : "text-slate-950"}`}>
            {resultKey === "predictx" ? "PredictX" : resultKey === "foresight" ? "ForeSight" : "InfoGuide"}
          </h3>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone(status)}`}>{status}</span>
      </div>

      {result?.status === "error" ? (
        <p className="mt-4 text-sm leading-6 text-rose-600">{result.error || "The registered agent returned an error."}</p>
      ) : resultKey === "infoguide" && result?.status === "completed" ? (
        <div className={`mt-4 space-y-3 text-sm leading-6 ${theme === "dark" ? "text-slate-300" : "text-slate-600"}`}>
          <p>
            <span className="font-semibold">Question:</span> {formatValue(payload.question)}
          </p>
          <p>
            <span className="font-semibold">Route:</span> {formatValue(route.route)} via {formatValue(route.routing_source)}
          </p>
          <p>
            <span className="font-semibold">Answer:</span> {formatValue(payload.response ?? payload.retrieved_context)}
          </p>
          {payload.dataset_answer ? (
            <p>
              <span className="font-semibold">Dataset answer:</span> {formatValue(payload.dataset_answer)}
            </p>
          ) : null}
        </div>
      ) : rows.length ? (
        <div className="mt-4">
          <p className={`text-sm ${theme === "dark" ? "text-slate-300" : "text-slate-600"}`}>
            {rows.length} prediction rows generated from{" "}
            {payload.execution_mode ? "the checked-in dataset sample" : "the checked-in model artifact"}.
          </p>
          {payload.explanation ? (
            <p className={`mt-2 text-xs leading-5 ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
              {formatValue(payload.explanation)}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {rows[0].map((value, index) => (
              <span key={index} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                y{index}: {formatValue(value)}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className={`mt-4 text-sm leading-6 ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
          Run the demo to invoke this registered agent.
        </p>
      )}
    </div>
  );
}

export default function SmartPilotDemoPage({ theme }: { theme: Theme }) {
  const agents = useMemo(() => resolveSmartPilotAgents(), []);
  const missingAgents = agents.filter((agent) => !agent.agent);
  const [sample, setSample] = useState<DemoSampleResponse | null>(null);
  const [sampleState, setSampleState] = useState<LoadState>("loading");
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [runState, setRunState] = useState<LoadState>("idle");
  const [runError, setRunError] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<SmartPilotWorkflowResponse | null>(null);

  useEffect(() => {
    let active = true;
    requestJson<DemoSampleResponse>("/api/workflows/smart-pilot/sample")
      .then((data) => {
        if (!active) return;
        setSample(data);
        setSampleError(null);
        setSampleState("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setSampleError(error instanceof Error ? error.message : "Unable to load the SmartPilot sample.");
        setSampleState("error");
      });
    return () => {
      active = false;
    };
  }, []);

  const runDemo = async () => {
    if (missingAgents.length) {
      setRunError(`Missing registry entries: ${missingAgents.map((agent) => agent.title).join(", ")}.`);
      setRunState("error");
      return;
    }

    setRunState("loading");
    setRunError(null);
    try {
      const data = await requestJson<SmartPilotWorkflowResponse>("/api/workflows/smart-pilot/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pilots: agents.map((agent) => agent.runtimeAgentId),
          continue_on_error: true,
          out_dir: "Data/Tertiary/smart_pilot_demo",
        }),
      });
      setWorkflow(data);
      setRunState("ready");
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Unable to run the SmartPilot demo.");
      setRunState("error");
    }
  };

  const openWorkflowBuilder = () => {
    navigateTo("smartpilotWorkflow");
  };

  const datasets = sample?.datasets ?? {};

  return (
    <div className={`h-full overflow-y-auto ${theme === "dark" ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"}`}>
      <div className="page-shell pb-14">
        <header className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div>
            <a
              href={hrefForRoute("home")}
              className={`inline-flex w-fit items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                theme === "dark"
                  ? "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              Back to home
            </a>
            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.24em] text-sky-500">SmartPilot paper demo</p>
            <h1 className={`mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl ${theme === "dark" ? "text-white" : "text-slate-950"}`}>
              Multiagent manufacturing copilot
            </h1>
            <p className={`mt-4 max-w-3xl text-sm leading-6 sm:text-base ${theme === "dark" ? "text-slate-300" : "text-slate-600"}`}>
              This demo wires the checked-in registry and datasets into the SmartPilot flow from the paper:
              anomaly prediction, production forecasting, and domain-specific Q&A.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <button
              type="button"
              onClick={openWorkflowBuilder}
              className={`inline-flex min-w-[210px] items-center justify-center rounded-full border px-5 py-3 text-sm font-semibold transition ${
                theme === "dark"
                  ? "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              Open in Workflow Builder
            </button>
            <button
              type="button"
              onClick={runDemo}
              disabled={runState === "loading"}
              className={`inline-flex min-w-[160px] items-center justify-center rounded-full px-5 py-3 text-sm font-semibold shadow-lg transition disabled:cursor-not-allowed disabled:opacity-70 ${
                theme === "dark"
                  ? "bg-sky-400 text-slate-950 shadow-sky-950/30 hover:bg-sky-300"
                  : "bg-slate-950 text-white shadow-slate-300/60 hover:bg-slate-800"
              }`}
            >
              {runState === "loading" ? "Running..." : "Run SmartPilot Workflow"}
            </button>
          </div>
        </header>

        {sampleState === "error" ? (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
            {sampleError}
          </div>
        ) : null}
        {runState === "error" ? (
          <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-700">
            {runError}
          </div>
        ) : null}
        {sample?.warnings?.length ? (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
            {sample.warnings.join(" ")}
          </div>
        ) : null}

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Input sample</p>
              <h2 className={`mt-2 text-2xl font-semibold tracking-tight ${theme === "dark" ? "text-slate-100" : "text-slate-950"}`}>
                Existing data used by the demo
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {(sample?.modalities ?? ["sensor/time-series features", "image probability features", "domain Q&A text"]).map((modality) => (
                <span key={modality} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
                  {modality}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            <div className={`rounded-lg border p-5 shadow-sm ${theme === "dark" ? "border-slate-700 bg-slate-900/80" : "border-slate-200 bg-white"}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">PredictX features</p>
              <p className={`mt-2 text-sm ${theme === "dark" ? "text-slate-300" : "text-slate-600"}`}>
                {datasets.predictx_features?.path ?? "Data/Primary/PredictX/fusion_features_sample.csv"}
              </p>
              <div className="mt-4">
                <SampleTable sample={datasets.predictx_features} emptyLabel={sampleState === "loading" ? "Loading sample..." : "No PredictX sample rows were available."} />
              </div>
            </div>

            <div className={`rounded-lg border p-5 shadow-sm ${theme === "dark" ? "border-slate-700 bg-slate-900/80" : "border-slate-200 bg-white"}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">ForeSight production</p>
              <p className={`mt-2 text-sm ${theme === "dark" ? "text-slate-300" : "text-slate-600"}`}>
                {datasets.foresight_production?.path ?? "Data/Primary/Foresight/foresight_test_production.csv"}
              </p>
              <div className="mt-4">
                <SampleTable sample={datasets.foresight_production} emptyLabel={sampleState === "loading" ? "Loading sample..." : "No production rows were available."} maxColumns={4} />
              </div>
            </div>

            <div className={`rounded-lg border p-5 shadow-sm ${theme === "dark" ? "border-slate-700 bg-slate-900/80" : "border-slate-200 bg-white"}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">InfoGuide Q&A</p>
              <p className={`mt-2 text-sm ${theme === "dark" ? "text-slate-300" : "text-slate-600"}`}>
                {datasets.infoguide_qa?.path ?? "Data/Primary/InfoGuide/LLM_FT_dataset.csv"}
              </p>
              <div className={`mt-4 space-y-3 text-sm leading-6 ${theme === "dark" ? "text-slate-300" : "text-slate-600"}`}>
                <p>
                  <span className="font-semibold">Question:</span>{" "}
                  {datasets.infoguide_qa?.question ?? (sampleState === "loading" ? "Loading sample..." : "No question available.")}
                </p>
                {datasets.infoguide_qa?.answer ? (
                  <p>
                    <span className="font-semibold">Answer:</span> {datasets.infoguide_qa.answer}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <RegistryPanel agents={agents} theme={theme} />

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Results</p>
              <h2 className={`mt-2 text-2xl font-semibold tracking-tight ${theme === "dark" ? "text-slate-100" : "text-slate-950"}`}>
                Outputs from the registered SmartPilot agents
              </h2>
            </div>
            {workflow ? (
              <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${statusTone(workflow.status)}`}>
                workflow {workflow.status}
              </span>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <ResultPanel result={workflow?.results?.predictx} resultKey="predictx" theme={theme} />
            <ResultPanel result={workflow?.results?.foresight} resultKey="foresight" theme={theme} />
            <ResultPanel result={workflow?.results?.infoguide} resultKey="infoguide" theme={theme} />
          </div>

          <div className={`mt-5 rounded-lg border p-5 text-sm leading-6 ${theme === "dark" ? "border-slate-700 bg-slate-900/80 text-slate-300" : "border-slate-200 bg-white text-slate-600"}`}>
            The page maps the paper architecture onto this repository by resolving PredictX, ForeSight, and InfoGuide
            from the existing registry, then invoking their existing backend runtime tools against the checked-in
            PredictX, ForeSight, and InfoGuide datasets. The demo does not retrain models or create demo-only agents.
          </div>
        </section>
      </div>
    </div>
  );
}

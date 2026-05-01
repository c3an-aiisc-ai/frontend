import type { WorkflowRunAction, WorkflowRunResult } from "../workflow/WorkflowEditorPage";
import { resolveSmartPilotAgents } from "./smartPilotDemoRegistry";

type SmartPilotWorkflowRunResponse = {
  status?: string;
  final_response?: string;
  results?: Record<string, PilotResult | undefined>;
};

type PilotResult = {
  status?: string;
  count?: number;
  error?: string;
  result?: Record<string, unknown>;
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

function firstPrediction(result: PilotResult | undefined): string {
  const predictions = asRecord(result?.result).predictions;
  if (!Array.isArray(predictions) || !predictions.length) return "No prediction rows returned.";
  const first = predictions[0];
  if (!Array.isArray(first)) return String(first);
  return first.map((value) => Number(value).toFixed(3)).join(", ");
}

function textValue(value: unknown, fallback = "Not returned."): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export async function runSmartPilotWorkflow(): Promise<WorkflowRunResult> {
  const resolvedAgents = resolveSmartPilotAgents();
  const missingAgents = resolvedAgents.filter((agent) => !agent.agent);
  if (missingAgents.length) {
    return {
      state: "error",
      message: `Missing SmartPilot registry entries: ${missingAgents.map((agent) => agent.title).join(", ")}.`,
    };
  }

  const data = await requestJson<SmartPilotWorkflowRunResponse>("/api/workflows/smart-pilot/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pilots: resolvedAgents.map((agent) => agent.runtimeAgentId),
      continue_on_error: true,
      out_dir: "Data/Tertiary/smart_pilot_demo",
    }),
  });
  const failures = Object.entries(data.results ?? {}).filter(([, result]) => result?.status === "error");
  const status = data.status ?? (failures.length ? "partial" : "completed");
  const predictx = data.results?.predictx;
  const foresight = data.results?.foresight;
  const infoguide = data.results?.infoguide;
  const infoguidePayload = asRecord(infoguide?.result);
  return {
    state: failures.length ? "error" : "success",
    status,
    message: failures.length
      ? `SmartPilot workflow ${status}. ${failures
          .map(([pilot, result]) => `${pilot}: ${result?.error ?? "failed"}`)
          .join(" ")}`
      : `SmartPilot workflow ${status}. PredictX, ForeSight, and InfoGuide completed.`,
    outputs: [
      {
        id: "smartpilot-final-response",
        title: "SmartPilot end response",
        status,
        summary: textValue(data.final_response, "SmartPilot completed, but no final response was returned."),
      },
      {
        id: "predictx-output",
        title: "PredictX anomaly prediction",
        status: predictx?.status,
        summary: predictx?.error ?? `First anomaly vector: ${firstPrediction(predictx)}`,
        details: [
          { label: "Rows", value: String(predictx?.count ?? 0) },
          { label: "Mode", value: textValue(asRecord(predictx?.result).execution_mode, "model artifact") },
        ],
      },
      {
        id: "foresight-output",
        title: "ForeSight production forecast",
        status: foresight?.status,
        summary: foresight?.error ?? `First forecast vector: ${firstPrediction(foresight)}`,
        details: [
          { label: "Rows", value: String(foresight?.count ?? 0) },
          { label: "Mode", value: textValue(asRecord(foresight?.result).execution_mode, "model artifact") },
        ],
      },
      {
        id: "infoguide-output",
        title: "InfoGuide Q&A",
        status: infoguide?.status,
        summary: infoguide?.error ?? textValue(infoguidePayload.response),
        details: [
          { label: "Question", value: textValue(infoguidePayload.question) },
          { label: "LLM", value: textValue(infoguidePayload.llm) },
        ],
      },
    ],
  };
}

export function buildSmartPilotRunAction(): WorkflowRunAction {
  return {
    id: "smartpilot-workflow",
    label: "Run SmartPilot",
    runningLabel: "Running SmartPilot...",
    loadingMessage: "Running PredictX, ForeSight, and InfoGuide with the existing SmartPilot datasets.",
    run: runSmartPilotWorkflow,
  };
}

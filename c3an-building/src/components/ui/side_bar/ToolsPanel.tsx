// =============================================================================
// Tools Panel Component - Tool palette panel
// =============================================================================

import { useEffect, useState, type DragEvent } from "react";
import { hrefForRoute } from "../../../config";
import type { ToolPreset } from "../../../shared/types";

type Props = {
  toolPalette: ToolPreset[];
  onToolDragStart: (toolName: string) => (e: DragEvent<HTMLDivElement>) => void;
};

type SessionResponse = {
  authenticated: boolean;
  user?: {
    username: string;
  };
};

type SavedWorkflowEntry = {
  id: string;
  runId: string;
  savedAt: string;
  plans: Array<{
    id: string;
    name: string;
  }>;
};

type SavedWorkflowsResponse = {
  plans: SavedWorkflowEntry[];
};

type SlowNumberResponse = {
  delayMs: number;
  value: number;
};

type ToolsPanelTab = "palette" | "saved" | "random";

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

export default function ToolsPanel({ toolPalette, onToolDragStart }: Props) {
  const [activeTab, setActiveTab] = useState<ToolsPanelTab>("palette");
  const [sessionLoading, setSessionLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [savedWorkflowsLoading, setSavedWorkflowsLoading] = useState(false);
  const [savedWorkflowsError, setSavedWorkflowsError] = useState<string | null>(null);
  const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflowEntry[]>([]);
  const [randomLoading, setRandomLoading] = useState(false);
  const [randomError, setRandomError] = useState<string | null>(null);
  const [randomValue, setRandomValue] = useState<number | null>(null);
  const [randomDelayMs, setRandomDelayMs] = useState<number | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadSession() {
      try {
        const data = await requestJson<SessionResponse>("/api/auth/session");
        if (!ignore) {
          setCurrentUser(data.authenticated ? data.user?.username ?? null : null);
        }
      } catch {
        if (!ignore) {
          setCurrentUser(null);
        }
      } finally {
        if (!ignore) {
          setSessionLoading(false);
        }
      }
    }

    void loadSession();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadSavedWorkflows() {
      if (activeTab !== "saved" || !currentUser) {
        return;
      }

      setSavedWorkflowsLoading(true);
      setSavedWorkflowsError(null);
      try {
        const data = await requestJson<SavedWorkflowsResponse>("/api/account/plans");
        if (!ignore) {
          setSavedWorkflows(data.plans);
        }
      } catch (error) {
        if (!ignore) {
          setSavedWorkflowsError(
            error instanceof Error ? error.message : "Unable to load saved workflows.",
          );
        }
      } finally {
        if (!ignore) {
          setSavedWorkflowsLoading(false);
        }
      }
    }

    void loadSavedWorkflows();

    return () => {
      ignore = true;
    };
  }, [activeTab, currentUser]);

  async function handleRandomNumber() {
    setRandomLoading(true);
    setRandomError(null);

    try {
      const data = await requestJson<SlowNumberResponse>("/api/slow-number", {
        method: "POST",
      });
      setRandomValue(data.value);
      setRandomDelayMs(data.delayMs);
    } catch (error) {
      setRandomError(error instanceof Error ? error.message : "Unable to reach Flask.");
    } finally {
      setRandomLoading(false);
    }
  }

  const tabClass = (tab: ToolsPanelTab) =>
    [
      "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition",
      activeTab === tab
        ? "border-slate-900 bg-slate-900 text-white"
        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900",
    ].join(" ");

  return (
    <div className="mt-4 flex-1 space-y-4 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-slate-500">Tools</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={tabClass("palette")} onClick={() => setActiveTab("palette")}>
          Palette
        </button>
        <button type="button" className={tabClass("saved")} onClick={() => setActiveTab("saved")}>
          Saved Workflows
        </button>
        <button type="button" className={tabClass("random")} onClick={() => setActiveTab("random")}>
          Random Number
        </button>
      </div>

      {activeTab === "palette" ? (
        <div className="mt-3 flex-1 overflow-y-auto pr-2">
          <div className="grid grid-cols-1 gap-3 auto-rows-max">
            {toolPalette.map((tool) => (
              <div
                key={tool.name}
                className="group relative flex items-center justify-center cursor-grab active:cursor-grabbing"
                draggable
                onDragStart={onToolDragStart(tool.name)}
              >
                <div
                  className={`relative h-[110px] w-full max-w-[180px] rounded-lg bg-gradient-to-br ${tool.gradient} ring-1 ring-inset ${tool.ring} shadow-sm transition duration-150 group-hover:shadow-md group-hover:-translate-y-0.5`}
                  aria-label={tool.name}
                >
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
                    <p className="text-sm font-semibold text-slate-900 drop-shadow-sm">{tool.name}</p>
                    <p className="text-[11px] text-slate-700 leading-tight">{tool.tagline}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === "saved" ? (
        <div className="mt-3 flex-1 overflow-y-auto pr-2">
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">
                {sessionLoading
                  ? "Checking account session..."
                  : currentUser
                    ? currentUser
                    : "Not signed in"}
              </p>
              {!sessionLoading && !currentUser ? (
                <a
                  href={hrefForRoute("login")}
                  className="mt-4 inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Login
                </a>
              ) : null}
            </div>

            {savedWorkflowsError ? (
              <p className="text-sm text-rose-600">{savedWorkflowsError}</p>
            ) : null}

            {currentUser ? (
              savedWorkflowsLoading ? (
                <p className="text-sm text-slate-600">Loading saved workflows...</p>
              ) : savedWorkflows.length === 0 ? (
                <p className="text-sm text-slate-600">No saved workflows.</p>
              ) : (
                <ul className="space-y-3">
                  {savedWorkflows.map((workflow) => (
                    <li
                      key={workflow.id}
                      className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{workflow.runId}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            Saved {new Date(workflow.savedAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                          {workflow.plans.length} plans
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {workflow.plans.map((plan) => (
                          <span
                            key={`${workflow.id}-${plan.id}`}
                            className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700"
                          >
                            {plan.name}
                          </span>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </div>
        </div>
      ) : null}

      {activeTab === "random" ? (
        <div className="mt-3 flex-1 overflow-y-auto pr-2">
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                {randomValue ?? "--"}
              </div>
              <p className="mt-2 text-sm text-slate-600">
                {randomLoading
                  ? "Waiting for the backend to respond..."
                  : randomDelayMs
                    ? `Returned after ${randomDelayMs}ms.`
                    : "No result yet."}
              </p>
              {randomError ? <p className="mt-3 text-sm text-rose-600">{randomError}</p> : null}
              <button
                type="button"
                onClick={() => {
                  void handleRandomNumber();
                }}
                disabled={randomLoading}
                className="mt-4 rounded-full border border-slate-200 bg-slate-950 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {randomLoading ? "Running..." : "Generate random number"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

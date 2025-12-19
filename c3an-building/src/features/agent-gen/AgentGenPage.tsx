import { useMemo, useState } from "react";
import type { AgentRegistryEntry } from "../../shared/types";
import { AGENT_REGISTRY_AGENTS } from "../../shared/constants";
import { readCustomAgents, writeCustomAgents } from "../../shared/utils/customAgents";
import {
  buildUniqueId,
  isRecord,
  normalizeStreams,
  slugify,
  toStringArray,
} from "../../shared/utils";

const SAMPLE_JSON = `{
  "agents": [
    {
      "id": "inventory-agent",
      "name": "InventoryPulse",
      "description": "Tracks stock movement and replenishment alerts.",
      "capabilities": ["stock tracking", "reorder alerts"],
      "input_data_streams": {
        "mandatory": ["inventory_events"],
        "optional": ["supplier_updates"]
      },
      "output_data_streams": {
        "mandatory": ["inventory_snapshot"],
        "optional": ["reorder_suggestions"]
      }
    },
    {
      "id": "fulfillment-agent",
      "name": "FulfillmentPilot",
      "description": "Coordinates pick, pack, and ship workflows.",
      "capabilities": ["routing", "handoff coordination"],
      "input_data_streams": {
        "mandatory": ["order_queue"],
        "optional": ["carrier_capacity"]
      },
      "output_data_streams": {
        "mandatory": ["shipment_plan"],
        "optional": ["exceptions_log"]
      }
    }
  ]
}`;


function normalizeAgent(
  value: unknown,
  index: number,
  usedIds: Set<string>
): AgentRegistryEntry | null {
  if (!isRecord(value)) return null;
  const rawId = typeof value.id === "string" ? value.id.trim() : "";
  const rawName = typeof value.name === "string" ? value.name.trim() : "";
  const fallbackName = rawId ? rawId.replace(/[-_]+/g, " ") : `Custom Agent ${index + 1}`;
  const name = rawName || fallbackName;
  const baseId = rawId || slugify(rawName) || `custom-agent-${index + 1}`;
  const id = buildUniqueId(baseId, usedIds, "custom-agent");
  const description = typeof value.description === "string" ? value.description.trim() : "";

  return {
    id,
    name,
    description,
    capabilities: toStringArray(value.capabilities),
    input_data_streams: normalizeStreams(value.input_data_streams),
    output_data_streams: normalizeStreams(value.output_data_streams),
  };
}

function extractAgents(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isRecord(value) && Array.isArray(value.agents)) return value.agents;
  if (isRecord(value) && isRecord(value.agent)) return [value.agent];
  if (isRecord(value) && (typeof value.id === "string" || typeof value.name === "string")) return [value];
  return [];
}

export default function AgentGenPage() {
  const [jsonInput, setJsonInput] = useState(SAMPLE_JSON);
  const [parseError, setParseError] = useState<string | null>(null);
  const [customAgents, setCustomAgents] = useState<AgentRegistryEntry[]>(() => readCustomAgents());
  const [lastAdded, setLastAdded] = useState<AgentRegistryEntry[]>([]);

  const usedIds = useMemo(() => {
    return new Set([...AGENT_REGISTRY_AGENTS, ...customAgents].map((agent) => agent.id));
  }, [customAgents]);

  const handleGenerate = () => {
    if (!jsonInput.trim()) {
      setParseError("Paste JSON to generate agents.");
      setLastAdded([]);
      return;
    }
    try {
      const parsed = JSON.parse(jsonInput) as unknown;
      const entries = extractAgents(parsed);
      if (entries.length === 0) {
        setParseError("No agents found. Provide an array or { agents: [...] }.");
        setLastAdded([]);
        return;
      }
      const nextUsed = new Set(usedIds);
      const normalized = entries
        .map((entry, index) => normalizeAgent(entry, index, nextUsed))
        .filter((entry): entry is AgentRegistryEntry => Boolean(entry));

      if (normalized.length === 0) {
        setParseError("No valid agents found in the input.");
        setLastAdded([]);
        return;
      }

      const nextAgents = [...customAgents, ...normalized];
      setCustomAgents(nextAgents);
      writeCustomAgents(nextAgents);
      setLastAdded(normalized);
      setParseError(null);
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

  const handleRemoveAgent = (agentId: string) => {
    const next = customAgents.filter((agent) => agent.id !== agentId);
    setCustomAgents(next);
    writeCustomAgents(next);
    if (lastAdded.some((agent) => agent.id === agentId)) setLastAdded([]);
  };

  const handleClearAgents = () => {
    setCustomAgents([]);
    writeCustomAgents([]);
    setLastAdded([]);
  };

  const agentStats = useMemo(() => {
    const totalInputs = customAgents.reduce((acc, agent) => {
      const input = normalizeStreams(agent.input_data_streams);
      return acc + input.mandatory.length + input.optional.length;
    }, 0);
    const totalOutputs = customAgents.reduce((acc, agent) => {
      const output = normalizeStreams(agent.output_data_streams);
      return acc + output.mandatory.length + output.optional.length;
    }, 0);
    return { totalInputs, totalOutputs };
  }, [customAgents]);

  return (
    <div className="h-screen overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-emerald-50 text-slate-900">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 right-10 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-10 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-12">
        <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
              Agent generator
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              AgentGen palette builder
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-600">
              Paste JSON to generate agent blocks and store them in the sidebar palette.
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
                window.location.hash = "#/planning";
              }}
            >
              Planning
            </button>
            <button
              className="btn-pill btn-pill-emerald"
              onClick={handleGenerate}
            >
              Generate agents
            </button>
          </div>
        </header>

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <section className="panel bg-white/80">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">JSON intake</h2>
                <p className="mt-1 text-xs text-slate-600">
                  Supports {`{ agents: [...] }`}, an array, or a single agent object.
                </p>
              </div>
              <span className="pill-tag pill-tag-emerald">
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

            {lastAdded.length > 0 && (
              <p className="mt-3 text-xs font-semibold text-emerald-600">
                Added {lastAdded.length} agent{lastAdded.length === 1 ? "" : "s"} to the sidebar palette.
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                className="btn-sm btn-sm-solid-emerald px-4"
                onClick={handleGenerate}
              >
                Generate agents
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
                <h2 className="text-lg font-semibold text-slate-900">Custom agent palette</h2>
                <p className="mt-1 text-xs text-slate-600">
                  These agents appear in the Blocks sidebar and persist across reloads.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600">
                <span className="badge">Agents: {customAgents.length}</span>
                <span className="badge">Inputs: {agentStats.totalInputs}</span>
                <span className="badge">Outputs: {agentStats.totalOutputs}</span>
              </div>
            </div>

            {customAgents.length === 0 ? (
              <div className="mt-6 empty-state p-6 text-center text-sm text-slate-500">
                No custom agents yet. Generate some from JSON to populate the palette.
              </div>
            ) : (
              <div className="mt-6 space-y-3 max-h-[420px] overflow-y-auto pr-2">
                {customAgents.map((agent, index) => {
                  const input = normalizeStreams(agent.input_data_streams);
                  const output = normalizeStreams(agent.output_data_streams);
                  return (
                    <div
                      key={`${agent.id}-${index}`}
                      className="card"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{agent.name}</p>
                          <p className="mt-1 text-xs text-slate-600">
                            {agent.description || "No description provided."}
                          </p>
                        </div>
                        <button
                          className="text-xs font-semibold text-rose-600 hover:text-rose-500"
                          onClick={() => handleRemoveAgent(agent.id)}
                        >
                          Delete
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600">
                        <span className="badge-tight bg-emerald-50 text-emerald-700">
                          {input.mandatory.length + input.optional.length} inputs
                        </span>
                        <span className="badge-tight bg-sky-50 text-sky-700">
                          {output.mandatory.length + output.optional.length} outputs
                        </span>
                        <span className="badge-tight text-slate-700">
                          ID: {agent.id}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {customAgents.length > 0 && (
              <div className="mt-4 flex justify-end">
                <button
                  className="btn-sm btn-sm-rose"
                  onClick={handleClearAgents}
                >
                  Clear custom agents
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

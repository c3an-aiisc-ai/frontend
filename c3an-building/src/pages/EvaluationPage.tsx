import { useMemo, useRef, useState } from "react";
import { evalOptions } from "../workflow/constants";

type MappingRow = {
  id: string;
  input: string;
  output: string;
  metrics: string[];
  owner: string;
  threshold: string;
  cadence: string;
};

const DEFAULT_INPUTS = ["User prompt", "Agent output", "Tool response", "Knowledge base snippet"];
const DEFAULT_OUTPUTS = ["Evaluation dashboard", "Scored response report", "Alert log"];

const DEFAULT_MAPPINGS: MappingRow[] = [
  {
    id: "map-1",
    input: "User prompt",
    output: "Scored response report",
    metrics: ["relevance", "coherence", "fluency"],
    owner: "Quality Analyst",
    threshold: ">= 0.85",
    cadence: "Per release",
  },
  {
    id: "map-2",
    input: "Agent output",
    output: "Evaluation dashboard",
    metrics: ["accuracy", "hallucination", "cost"],
    owner: "Performance Lead",
    threshold: "P95 latency < 1200ms",
    cadence: "Weekly",
  },
  {
    id: "map-3",
    input: "Tool response",
    output: "Alert log",
    metrics: ["toxicity", "bias"],
    owner: "Safety Reviewer",
    threshold: "Zero critical flags",
    cadence: "Daily",
  },
];

const CATEGORY_STYLES: Record<
  string,
  { dot: string; chip: string; selected: string; idle: string }
> = {
  Performance: {
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700",
    selected: "bg-emerald-100 border-emerald-200 text-emerald-800",
    idle: "bg-white border-slate-200 text-slate-600 hover:border-emerald-200",
  },
  Quality: {
    dot: "bg-sky-500",
    chip: "bg-sky-50 text-sky-700",
    selected: "bg-sky-100 border-sky-200 text-sky-800",
    idle: "bg-white border-slate-200 text-slate-600 hover:border-sky-200",
  },
  Safety: {
    dot: "bg-rose-500",
    chip: "bg-rose-50 text-rose-700",
    selected: "bg-rose-100 border-rose-200 text-rose-800",
    idle: "bg-white border-slate-200 text-slate-600 hover:border-rose-200",
  },
  Efficiency: {
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-700",
    selected: "bg-amber-100 border-amber-200 text-amber-800",
    idle: "bg-white border-slate-200 text-slate-600 hover:border-amber-200",
  },
  Default: {
    dot: "bg-slate-400",
    chip: "bg-slate-100 text-slate-600",
    selected: "bg-slate-200 border-slate-300 text-slate-700",
    idle: "bg-white border-slate-200 text-slate-600 hover:border-slate-300",
  },
};

const normalizeMappings = (rows: MappingRow[], inputs: string[], outputs: string[]) =>
  rows.map((row) => ({
    ...row,
    input: inputs.includes(row.input) ? row.input : inputs[0] ?? "",
    output: outputs.includes(row.output) ? row.output : outputs[0] ?? "",
  }));

const uniqueList = (value: string[]) =>
  Array.from(new Set(value.map((item) => item.trim()).filter(Boolean)));

export default function EvaluationPage() {
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [outputs, setOutputs] = useState(DEFAULT_OUTPUTS);
  const [mappings, setMappings] = useState(DEFAULT_MAPPINGS);
  const [inputDraft, setInputDraft] = useState("");
  const [outputDraft, setOutputDraft] = useState("");
  const nextMappingId = useRef(DEFAULT_MAPPINGS.length + 1);

  const metricGroups = useMemo(() => {
    const groups: Record<string, typeof evalOptions> = {};
    evalOptions.forEach((option) => {
      if (!groups[option.category]) {
        groups[option.category] = [];
      }
      groups[option.category].push(option);
    });
    return groups;
  }, []);

  const metricsInUse = useMemo(() => {
    const metrics = new Set<string>();
    mappings.forEach((row) => row.metrics.forEach((metric) => metrics.add(metric)));
    return metrics;
  }, [mappings]);

  const inputsWithMappings = useMemo(() => {
    const mapped = new Set<string>();
    mappings.forEach((row) => {
      if (row.input) mapped.add(row.input);
    });
    return mapped;
  }, [mappings]);

  const summary = useMemo(() => {
    const mappingCount = mappings.length;
    const coverage = inputs.length ? Math.round((inputsWithMappings.size / inputs.length) * 100) : 0;
    const metricCoverage = evalOptions.length
      ? Math.round((metricsInUse.size / evalOptions.length) * 100)
      : 0;
    const activeMappings = mappings.filter((row) => row.metrics.length > 0).length;
    return {
      mappingCount,
      coverage,
      metricCoverage,
      activeMappings,
    };
  }, [inputs.length, inputsWithMappings.size, mappings, metricsInUse.size]);

  const handleAddInput = () => {
    const trimmed = inputDraft.trim();
    if (!trimmed || inputs.includes(trimmed)) return;
    const nextInputs = uniqueList([...inputs, trimmed]);
    setInputs(nextInputs);
    setMappings((prev) => normalizeMappings(prev, nextInputs, outputs));
    setInputDraft("");
  };

  const handleRemoveInput = (value: string) => {
    const nextInputs = inputs.filter((item) => item !== value);
    setInputs(nextInputs);
    setMappings((prev) => normalizeMappings(prev, nextInputs, outputs));
  };

  const handleAddOutput = () => {
    const trimmed = outputDraft.trim();
    if (!trimmed || outputs.includes(trimmed)) return;
    const nextOutputs = uniqueList([...outputs, trimmed]);
    setOutputs(nextOutputs);
    setMappings((prev) => normalizeMappings(prev, inputs, nextOutputs));
    setOutputDraft("");
  };

  const handleRemoveOutput = (value: string) => {
    const nextOutputs = outputs.filter((item) => item !== value);
    setOutputs(nextOutputs);
    setMappings((prev) => normalizeMappings(prev, inputs, nextOutputs));
  };

  const handleAddMapping = () => {
    const id = `map-${nextMappingId.current++}`;
    const nextRow: MappingRow = {
      id,
      input: inputs[0] ?? "",
      output: outputs[0] ?? "",
      metrics: [],
      owner: "Evaluation lead",
      threshold: "TBD",
      cadence: "Weekly",
    };
    setMappings((prev) => [...prev, nextRow]);
  };

  const handleRemoveMapping = (id: string) => {
    setMappings((prev) => prev.filter((row) => row.id !== id));
  };

  const handleMappingChange = <K extends keyof MappingRow>(
    id: string,
    key: K,
    value: MappingRow[K],
  ) => {
    setMappings((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)),
    );
  };

  const toggleMetric = (id: string, metricId: string) => {
    setMappings((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const hasMetric = row.metrics.includes(metricId);
        const nextMetrics = hasMetric
          ? row.metrics.filter((metric) => metric !== metricId)
          : [...row.metrics, metricId];
        return { ...row, metrics: nextMetrics };
      }),
    );
  };

  return (
    <div className="h-screen overflow-y-auto bg-gradient-to-br from-white via-slate-50 to-sky-50 text-slate-900">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 -left-20 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-10 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-12">
        <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
              Evaluation page
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              Input to evaluation to output map
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-600">
              Define how each input stream is scored, which metrics fire, and what outputs should
              be produced.
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
                window.location.hash = "#/planning";
              }}
            >
              Planning
            </button>
            <button
              className="rounded-full border border-sky-200 bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500"
              onClick={handleAddMapping}
            >
              Add mapping
            </button>
          </div>
        </header>

        <section className="mt-10 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Coverage
              </p>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">Evaluation blueprint</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                Inputs: {inputs.length}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                Outputs: {outputs.length}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                Mappings: {summary.mappingCount}
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Input coverage
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.coverage}%</p>
              <p className="mt-1 text-xs text-slate-600">
                {inputsWithMappings.size} of {inputs.length} inputs mapped
              </p>
            </div>
            <div className="rounded-xl bg-sky-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">
                Metrics coverage
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.metricCoverage}%</p>
              <p className="mt-1 text-xs text-slate-600">
                {metricsInUse.size} of {evalOptions.length} metrics in use
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Active mappings
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.activeMappings}</p>
              <p className="mt-1 text-xs text-slate-600">Mappings with at least one metric</p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">
                Inputs
              </h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                {inputs.length} streams
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {inputs.length ? (
                inputs.map((input) => (
                  <span
                    key={input}
                    className="group inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200"
                  >
                    {input}
                    <button
                      type="button"
                      className="rounded-full bg-slate-200 px-2 text-[10px] text-slate-600 opacity-70 transition group-hover:opacity-100"
                      onClick={() => handleRemoveInput(input)}
                      aria-label={`Remove ${input}`}
                    >
                      x
                    </button>
                  </span>
                ))
              ) : (
                <p className="text-xs text-slate-500">No inputs yet. Add one below.</p>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <input
                className="flex-1 rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400"
                placeholder="Add input stream"
                value={inputDraft}
                onChange={(event) => setInputDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAddInput();
                  }
                }}
              />
              <button
                className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
                onClick={handleAddInput}
              >
                Add
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">
                Metrics library
              </h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                {evalOptions.length} metrics
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {Object.entries(metricGroups).map(([category, metrics]) => {
                const style = CATEGORY_STYLES[category] ?? CATEGORY_STYLES.Default;
                return (
                  <div key={category} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                        {category}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {metrics.map((metric) => (
                        <span
                          key={metric.id}
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${style.chip}`}
                        >
                          {metric.name}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">
                Outputs
              </h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                {outputs.length} channels
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {outputs.length ? (
                outputs.map((output) => (
                  <span
                    key={output}
                    className="group inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200"
                  >
                    {output}
                    <button
                      type="button"
                      className="rounded-full bg-slate-200 px-2 text-[10px] text-slate-600 opacity-70 transition group-hover:opacity-100"
                      onClick={() => handleRemoveOutput(output)}
                      aria-label={`Remove ${output}`}
                    >
                      x
                    </button>
                  </span>
                ))
              ) : (
                <p className="text-xs text-slate-500">No outputs yet. Add one below.</p>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <input
                className="flex-1 rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="Add output channel"
                value={outputDraft}
                onChange={(event) => setOutputDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAddOutput();
                  }
                }}
              />
              <button
                className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
                onClick={handleAddOutput}
              >
                Add
              </button>
            </div>
          </div>
        </section>

        <section className="mt-6 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Mapping table
              </p>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">
                Input to evaluation to output
              </h2>
            </div>
            <button
              className="rounded-full border border-sky-200 bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-500"
              onClick={handleAddMapping}
            >
              Add mapping
            </button>
          </div>

          {!mappings.length && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center text-sm text-slate-500">
              No mappings yet. Add one to connect inputs to evaluation outputs.
            </div>
          )}

          {mappings.map((row, index) => (
            <div
              key={row.id}
              className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Mapping {index + 1}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {row.input || "Unassigned input"}
                    {" -> "}
                    {row.output || "Unassigned output"}
                  </p>
                </div>
                <button
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  onClick={() => handleRemoveMapping(row.id)}
                >
                  Remove
                </button>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)_minmax(0,0.9fr)]">
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Input stream
                  </p>
                  <select
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400"
                    value={row.input}
                    onChange={(event) => handleMappingChange(row.id, "input", event.target.value)}
                  >
                    {!inputs.length && <option value="">No inputs available</option>}
                    {inputs.map((input) => (
                      <option key={input} value={input}>
                        {input}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-slate-500">
                    Tie the evaluation to the incoming stream.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Evaluation metrics
                    </p>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">
                      {row.metrics.length} selected
                    </span>
                  </div>
                  <div className="mt-3 space-y-3">
                    {Object.entries(metricGroups).map(([category, metrics]) => {
                      const style = CATEGORY_STYLES[category] ?? CATEGORY_STYLES.Default;
                      return (
                        <div key={`${row.id}-${category}`}>
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                              {category}
                            </p>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {metrics.map((metric) => {
                              const isSelected = row.metrics.includes(metric.id);
                              return (
                                <button
                                  key={`${row.id}-${metric.id}`}
                                  type="button"
                                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                                    isSelected ? style.selected : style.idle
                                  }`}
                                  onClick={() => toggleMetric(row.id, metric.id)}
                                >
                                  {metric.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Output channel
                  </p>
                  <select
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={row.output}
                    onChange={(event) => handleMappingChange(row.id, "output", event.target.value)}
                  >
                    {!outputs.length && <option value="">No outputs available</option>}
                    {outputs.map((output) => (
                      <option key={output} value={output}>
                        {output}
                      </option>
                    ))}
                  </select>
                  <div className="mt-3 grid gap-2">
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Owner
                    </label>
                    <input
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      value={row.owner}
                      onChange={(event) => handleMappingChange(row.id, "owner", event.target.value)}
                    />
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Threshold
                    </label>
                    <input
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      value={row.threshold}
                      onChange={(event) => handleMappingChange(row.id, "threshold", event.target.value)}
                    />
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Cadence
                    </label>
                    <input
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      value={row.cadence}
                      onChange={(event) => handleMappingChange(row.id, "cadence", event.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

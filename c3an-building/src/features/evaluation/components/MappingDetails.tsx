import type { EvalOption } from "../../../shared/types";
import type { CategoryStyle, MappingRow } from "../types";

type MappingChangeHandler = <K extends keyof MappingRow>(
  id: string,
  key: K,
  value: MappingRow[K]
) => void;

type Props = {
  className?: string;
  mapping: MappingRow | null;
  inputs: string[];
  outputs: string[];
  metricGroups: Record<string, EvalOption[]>;
  categoryStyles: Record<string, CategoryStyle>;
  onRemoveMapping: (id: string) => void;
  onMappingChange: MappingChangeHandler;
  onToggleMetric: (id: string, metricId: string) => void;
};

export default function MappingDetails({
  className,
  mapping,
  inputs,
  outputs,
  metricGroups,
  categoryStyles,
  onRemoveMapping,
  onMappingChange,
  onToggleMetric,
}: Props) {
  if (!mapping) {
    return (
      <section
        className={["panel flex items-center justify-center bg-white/85 text-center", className]
          .filter(Boolean)
          .join(" ")}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Details
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">Select a mapping</h2>
          <p className="mt-2 max-w-md text-sm text-slate-600">
            Choose a mapping from the left pane to edit its owner, thresholds, metrics, and output behavior.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={["panel flex flex-col bg-white/85", className].filter(Boolean).join(" ")}>
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Selected mapping
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">
            {mapping.input || "Unassigned input"} {"->"} {mapping.output || "Unassigned output"}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Configure evaluation ownership, metric selection, and resulting output behavior.
          </p>
        </div>
        <button className="btn-sm btn-sm-rose" onClick={() => onRemoveMapping(mapping.id)}>
          Remove mapping
        </button>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Input stream
            </p>
            <select
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400"
              value={mapping.input}
              onChange={(event) => onMappingChange(mapping.id, "input", event.target.value)}
            >
              {!inputs.length && <option value="">No inputs available</option>}
              {inputs.map((input) => (
                <option key={input} value={input}>
                  {input}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Output channel
            </p>
            <select
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              value={mapping.output}
              onChange={(event) => onMappingChange(mapping.id, "output", event.target.value)}
            >
              {!outputs.length && <option value="">No outputs available</option>}
              {outputs.map((output) => (
                <option key={output} value={output}>
                  {output}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Owner
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  value={mapping.owner}
                  onChange={(event) => onMappingChange(mapping.id, "owner", event.target.value)}
                />
              </label>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Threshold
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  value={mapping.threshold}
                  onChange={(event) => onMappingChange(mapping.id, "threshold", event.target.value)}
                />
              </label>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:col-span-2 xl:col-span-1">
                Cadence
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  value={mapping.cadence}
                  onChange={(event) => onMappingChange(mapping.id, "cadence", event.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-emerald-50 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
              Result preview
            </p>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">Output:</span> {mapping.output || "Unassigned"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Cadence:</span> {mapping.cadence || "Unset"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Metrics active:</span> {mapping.metrics.length}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Evaluation metrics
              </p>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">Selected evaluation details</h3>
            </div>
            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">
              {mapping.metrics.length} selected
            </span>
          </div>

          <div className="mt-5 space-y-4">
            {Object.entries(metricGroups).map(([category, metrics]) => {
              const style = categoryStyles[category] ?? categoryStyles.Default;
              return (
                <div key={`${mapping.id}-${category}`}>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {category}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {metrics.map((metric) => {
                      const isSelected = mapping.metrics.includes(metric.id);
                      return (
                        <button
                          key={`${mapping.id}-${metric.id}`}
                          type="button"
                          className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                            isSelected ? style.selected : style.idle
                          }`}
                          onClick={() => onToggleMetric(mapping.id, metric.id)}
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
      </div>
    </section>
  );
}

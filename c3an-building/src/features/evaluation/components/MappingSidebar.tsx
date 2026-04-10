import type { MappingRow } from "../types";

type Summary = {
  mappingCount: number;
  coverage: number;
  metricCoverage: number;
  activeMappings: number;
};

type Props = {
  mappings: MappingRow[];
  selectedMappingId: string | null;
  filterValue: string;
  summary: Summary;
  onAddMapping: () => void;
  onFilterChange: (value: string) => void;
  onSelectMapping: (id: string) => void;
};

export default function MappingSidebar({
  mappings,
  selectedMappingId,
  filterValue,
  summary,
  onAddMapping,
  onFilterChange,
  onSelectMapping,
}: Props) {
  return (
    <div className="space-y-6">
      <section className="panel bg-white/85">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Coverage
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">Evaluation blueprint</h2>
          </div>
          <button className="btn-sm btn-sm-solid-emerald" onClick={onAddMapping}>
            Add mapping
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Input coverage
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.coverage}%</p>
          </div>
          <div className="rounded-xl bg-sky-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">
              Metrics coverage
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.metricCoverage}%</p>
          </div>
          <div className="rounded-xl bg-emerald-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Active mappings
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.activeMappings}</p>
            <p className="mt-1 text-xs text-slate-600">of {summary.mappingCount} total mappings</p>
          </div>
        </div>
      </section>

      <section className="panel bg-white/85">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Mappings
            </p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">List and filter</h3>
          </div>
          <span className="badge text-[11px] font-semibold text-slate-600">
            {mappings.length} items
          </span>
        </div>

        <input
          className="mt-4 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400"
          placeholder="Filter by input, output, owner, or metric"
          value={filterValue}
          onChange={(event) => onFilterChange(event.target.value)}
        />

        <div className="mt-4 space-y-3">
          {mappings.length ? (
            mappings.map((row, index) => {
              const isSelected = row.id === selectedMappingId;
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => onSelectMapping(row.id)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    isSelected
                      ? "border-sky-300 bg-sky-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Mapping {index + 1}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {row.input || "Unassigned input"} {"->"} {row.output || "Unassigned output"}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">
                      {row.metrics.length} metrics
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">Owner: {row.owner || "Unassigned"}</p>
                </button>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-center text-sm text-slate-500">
              No mappings match the current filter.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

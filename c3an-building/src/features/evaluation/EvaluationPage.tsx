import { useMemo, useRef, useState } from "react";
import { EVAL_OPTIONS } from "../../shared/constants";
import {
  StreamPanel,
  MetricLibrary,
  MappingSidebar,
  MappingDetails,
} from "./components";
import { CATEGORY_STYLES, DEFAULT_INPUTS, DEFAULT_OUTPUTS, DEFAULT_MAPPINGS } from "./constants";
import { normalizeMappings, uniqueList } from "./utils";
import type { MappingRow } from "./types";
import type { Theme } from "../../shared/types";

type Props = {
  theme: Theme;
};

export default function EvaluationPage({ theme }: Props) {
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [outputs, setOutputs] = useState(DEFAULT_OUTPUTS);
  const [mappings, setMappings] = useState(DEFAULT_MAPPINGS);
  const [inputDraft, setInputDraft] = useState("");
  const [outputDraft, setOutputDraft] = useState("");
  const [mappingFilter, setMappingFilter] = useState("");
  const [selectedMappingId, setSelectedMappingId] = useState<string | null>(
    DEFAULT_MAPPINGS[0]?.id ?? null
  );
  const nextMappingId = useRef(DEFAULT_MAPPINGS.length + 1);

  const metricGroups = useMemo(() => {
    const groups: Record<string, typeof EVAL_OPTIONS> = {};
    EVAL_OPTIONS.forEach((option) => {
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
    const metricCoverage = EVAL_OPTIONS.length
      ? Math.round((metricsInUse.size / EVAL_OPTIONS.length) * 100)
      : 0;
    const activeMappings = mappings.filter((row) => row.metrics.length > 0).length;
    return {
      mappingCount,
      coverage,
      metricCoverage,
      activeMappings,
    };
  }, [inputs.length, inputsWithMappings.size, mappings, metricsInUse.size]);

  const filteredMappings = useMemo(() => {
    const query = mappingFilter.trim().toLowerCase();
    if (!query) return mappings;
    return mappings.filter((row) => {
      const haystack = [row.input, row.output, row.owner, row.threshold, row.cadence, ...row.metrics]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [mappingFilter, mappings]);

  const activeMappingId = useMemo(() => {
    if (selectedMappingId && filteredMappings.some((row) => row.id === selectedMappingId)) {
      return selectedMappingId;
    }
    if (filteredMappings.length > 0) return filteredMappings[0].id;
    if (selectedMappingId && mappings.some((row) => row.id === selectedMappingId)) {
      return selectedMappingId;
    }
    return mappings[0]?.id ?? null;
  }, [filteredMappings, mappings, selectedMappingId]);

  const selectedMapping = useMemo(
    () => mappings.find((row) => row.id === activeMappingId) ?? null,
    [activeMappingId, mappings]
  );

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
    setSelectedMappingId(id);
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
    <div
      className={`h-full overflow-y-auto ${
        theme === "dark"
          ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100"
          : "bg-gradient-to-br from-white via-slate-50 to-sky-50 text-slate-900"
      }`}
    >
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 -left-20 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-10 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
      </div>

      <div className="page-shell">
        <header className="page-header mt-6">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
              Evaluation page
            </p>
            <h1
              className={`mt-2 text-3xl font-semibold tracking-tight ${
                theme === "dark" ? "text-slate-100" : "text-slate-900"
              }`}
            >
              Input to evaluation to output map
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-600">
              Define how each input stream is scored, which metrics fire, and what outputs should
              be produced.
            </p>
          </div>
          <div className="page-actions">
            <button
              className="btn-pill btn-pill-sky"
              onClick={handleAddMapping}
            >
              Add mapping
            </button>
          </div>
        </header>

        <section className="mt-10 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-6">
            <MappingSidebar
              mappings={filteredMappings}
              selectedMappingId={activeMappingId}
              filterValue={mappingFilter}
              summary={summary}
              onAddMapping={handleAddMapping}
              onFilterChange={setMappingFilter}
              onSelectMapping={setSelectedMappingId}
            />

            <StreamPanel
              title="Inputs"
              countLabel={`${inputs.length} streams`}
              items={inputs}
              emptyLabel="No inputs yet. Add one below."
              placeholder="Add input stream"
              draft={inputDraft}
              onDraftChange={setInputDraft}
              onAdd={handleAddInput}
              onRemove={handleRemoveInput}
              inputFocusRingClass="focus:ring-sky-400"
            />

            <StreamPanel
              title="Outputs"
              countLabel={`${outputs.length} channels`}
              items={outputs}
              emptyLabel="No outputs yet. Add one below."
              placeholder="Add output channel"
              draft={outputDraft}
              onDraftChange={setOutputDraft}
              onAdd={handleAddOutput}
              onRemove={handleRemoveOutput}
              inputFocusRingClass="focus:ring-emerald-400"
            />

            <MetricLibrary metricGroups={metricGroups} categoryStyles={CATEGORY_STYLES} />
          </div>

          <MappingDetails
            mapping={selectedMapping}
            inputs={inputs}
            outputs={outputs}
            metricGroups={metricGroups}
            categoryStyles={CATEGORY_STYLES}
            onRemoveMapping={handleRemoveMapping}
            onMappingChange={handleMappingChange}
            onToggleMetric={toggleMetric}
          />
        </section>
      </div>
    </div>
  );
}

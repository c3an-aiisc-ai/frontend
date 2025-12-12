// =============================================================================
// Evals Modal Component - Evaluation metrics selection
// =============================================================================

import type { EvalOption } from "../../types";

type Props = {
  evalOptions: EvalOption[];
  selectedEvals: string[];
  onClose: () => void;
  onToggleEval: (evalId: string) => void;
  onClearAll: () => void;
};

export default function EvalsModal({
  evalOptions,
  selectedEvals,
  onClose,
  onToggleEval,
  onClearAll,
}: Props) {
  const categories = Array.from(new Set(evalOptions.map((opt) => opt.category)));

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Performance":
        return "emerald";
      case "Quality":
        return "sky";
      case "Safety":
        return "rose";
      default:
        return "amber";
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-[680px] max-h-[85vh] overflow-y-auto rounded-xl bg-white shadow-2xl border border-slate-200 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <div className="absolute -right-5 -top-5 z-[9999]">
          <button
            className="h-9 w-9 rounded-full bg-slate-900 text-white text-sm font-semibold shadow-lg"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {/* Header */}
        <div className="mb-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Evaluation Metrics
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Select metrics to monitor agent performance and quality
              </p>
            </div>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
              {selectedEvals.length} Selected
            </span>
          </div>
        </div>

        {/* Categories */}
        <div className="space-y-5">
          {categories.map((category) => {
            const categoryOptions = evalOptions.filter(
              (opt) => opt.category === category
            );
            const categoryColor = getCategoryColor(category);

            return (
              <div
                key={category}
                className="rounded-lg border border-slate-200 p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={`h-2.5 w-2.5 rounded-full bg-${categoryColor}-500`}
                  />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    {category}
                  </h3>
                </div>

                <div className="space-y-2">
                  {categoryOptions.map((option) => {
                    const isSelected = selectedEvals.includes(option.id);
                    return (
                      <label
                        key={option.id}
                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                          isSelected
                            ? `bg-${categoryColor}-50 border border-${categoryColor}-200`
                            : "bg-slate-50 border border-transparent hover:border-slate-200"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleEval(option.id)}
                          className="mt-0.5 h-4 w-4 rounded border-2 border-slate-300 cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-sm font-semibold ${
                                isSelected
                                  ? `text-${categoryColor}-900`
                                  : "text-slate-800"
                              }`}
                            >
                              {option.name}
                            </span>
                            {isSelected && (
                              <span
                                className={`text-[10px] font-semibold uppercase tracking-wide text-${categoryColor}-600`}
                              >
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5">
                            {option.description}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between gap-3 pt-4 border-t border-slate-200">
          <button
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={onClearAll}
          >
            Clear All
          </button>
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
              onClick={onClose}
            >
              Apply Metrics
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import type { PanelKey, PanelTab, ThemeMode } from "../../types/workflow";

type Props = {
  activePanel: PanelKey | null;
  panelTabs: PanelTab[];
  panelTitles: Record<PanelKey, string>;
  theme: ThemeMode;
  onTogglePanel: (panel: PanelKey) => void;
  onClosePanel: () => void;
  onOpenPlanning?: () => void;
  children?: ReactNode;
};

export default function Sidebar({
  activePanel,
  panelTabs,
  panelTitles,
  theme,
  onTogglePanel,
  onClosePanel,
  onOpenPlanning,
  children,
}: Props) {
  return (
    <div className="absolute left-0 top-0 bottom-0 z-30 flex">
      <div className="flex flex-col items-center gap-2 bg-slate-900/95 px-2 py-3 text-white shadow-xl">
        {onOpenPlanning && (
          <button
            className="h-12 w-12 rounded-md border border-slate-700 text-sm font-semibold transition bg-slate-800/70 text-white hover:bg-slate-800"
            onClick={onOpenPlanning}
            aria-label="Planning"
            title="Planning"
          >
            PL
          </button>
        )}
        {panelTabs.map((item) => (
          <button
            key={item.id}
            className={`h-12 w-12 rounded-md border border-slate-700 text-sm font-semibold transition ${
              activePanel === item.id
                ? "bg-white text-slate-900 shadow-sm"
                : "bg-slate-800/70 text-white hover:bg-slate-800"
            }`}
            onClick={() => onTogglePanel(item.id)}
            aria-pressed={activePanel === item.id}
            aria-label={item.label}
          >
            {item.symbol}
          </button>
        ))}
      </div>

      {activePanel && (
        <div
          className={`w-72 backdrop-blur px-4 py-5 shadow-xl transition-all flex flex-col overflow-hidden ${
            theme === "dark"
              ? "border-r border-slate-800 bg-slate-900/90 text-slate-100"
              : "border-r border-slate-200 bg-white/95 text-slate-900"
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {activePanel ? panelTitles[activePanel] : ""}
              </h2>
            </div>
            <button
              className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
              onClick={onClosePanel}
            >
              Close
            </button>
          </div>
          {children}
        </div>
      )}
    </div>
  );
}

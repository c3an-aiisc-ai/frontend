// =============================================================================
// Sidebar Component - Main sidebar with tabs and panels
// =============================================================================

import type { DragEvent } from "react";
import type { PanelKey, Theme, ToolPreset } from "../../types";
import { PANEL_TABS, PANEL_TITLES } from "../../constants";
import BlocksPanel from "./BlocksPanel";
import ToolsPanel from "./ToolsPanel";
import SettingsPanel from "./SettingsPanel";

type Props = {
  activePanel: PanelKey | null;
  theme: Theme;
  isPlanningView?: boolean;
  toolPalette: ToolPreset[];
  agentJsonInput: string;
  agentParseError: string | null;
  onPanelChange: (panel: PanelKey | null) => void;
  onThemeChange: (theme: Theme) => void;
  onAgentJsonInputChange: (value: string) => void;
  onGenerateAgentsFromJson: () => void;
  onOpenPlanning: () => void;
  planningLoaded: boolean;
  planningName?: string;
  onAddPlanBlock?: () => void;
  onBlockDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onUploadDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onOutputDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onToolDragStart: (toolName: string) => (e: DragEvent<HTMLDivElement>) => void;
};

export default function Sidebar({
  activePanel,
  theme,
  isPlanningView = false,
  toolPalette,
  agentJsonInput,
  agentParseError,
  onPanelChange,
  onThemeChange,
  onAgentJsonInputChange,
  onGenerateAgentsFromJson,
  onOpenPlanning,
  planningLoaded,
  planningName,
  onAddPlanBlock,
  onBlockDragStart,
  onUploadDragStart,
  onOutputDragStart,
  onToolDragStart,
}: Props) {
  return (
    <div className="absolute left-0 top-0 bottom-0 z-30 flex">
      {/* Tab buttons */}
      <div className="flex flex-col items-center gap-2 bg-slate-900/95 px-2 py-3 text-white shadow-xl">
        <button
          className={`h-12 w-12 rounded-md border text-sm font-semibold transition ${
            isPlanningView
              ? "bg-purple-600 text-white border-purple-700 shadow-sm"
              : "bg-slate-800/70 text-white border-slate-700 hover:bg-slate-800"
          }`}
          onClick={onOpenPlanning}
          aria-label="Planning"
          title={planningLoaded ? `Plan ready${planningName ? `: ${planningName}` : ""}` : "Open planner"}
        >
          PL
        </button>
        {PANEL_TABS.map((item) => (
          <button
            key={item.id}
            className={`h-12 w-12 rounded-md border border-slate-700 text-sm font-semibold transition ${
              activePanel === item.id
                ? "bg-white text-slate-900 shadow-sm"
                : "bg-slate-800/70 text-white hover:bg-slate-800"
            }`}
            onClick={() =>
              onPanelChange(activePanel === item.id ? null : (item.id as PanelKey))
            }
            aria-pressed={activePanel === item.id}
            aria-label={item.label}
          >
            {item.symbol}
          </button>
        ))}
      </div>

      {/* Panel content */}
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
                {PANEL_TITLES[activePanel]}
              </h2>
            </div>
            <button
              className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
              onClick={() => onPanelChange(null)}
            >
              Close
            </button>
          </div>

          {activePanel === "blocks" && (
            <BlocksPanel
              isPlanningView={isPlanningView}
              agentJsonInput={agentJsonInput}
              agentParseError={agentParseError}
              onAgentJsonInputChange={onAgentJsonInputChange}
              onGenerateAgentsFromJson={onGenerateAgentsFromJson}
              onAddPlanBlock={onAddPlanBlock}
              onBlockDragStart={onBlockDragStart}
              onUploadDragStart={onUploadDragStart}
              onOutputDragStart={onOutputDragStart}
            />
          )}

          {activePanel === "tools" && (
            <ToolsPanel
              toolPalette={toolPalette}
              onToolDragStart={onToolDragStart}
            />
          )}

          {activePanel === "settings" && (
            <SettingsPanel theme={theme} onThemeChange={onThemeChange} />
          )}
        </div>
      )}
    </div>
  );
}

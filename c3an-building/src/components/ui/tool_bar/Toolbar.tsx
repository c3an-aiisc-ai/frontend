// =============================================================================
// Toolbar Component - Top action buttons
// =============================================================================

import { useEffect, useId, useRef, useState } from "react";
import type { WorkspaceRouteKey } from "../../../config";
import type { Theme } from "../../../shared/types";
import WorkspaceTabs from "../WorkspaceTabs";

type Props = {
  theme: Theme;
  onEvalsClick?: () => void;
  onRunClick?: () => void;
  runButtonLabel?: string;
  runDisabledReason?: string;
  onGenerateClick?: () => void;
  onAddMappingClick?: () => void;
  onResetClick: () => void;
};

export default function Toolbar({
  theme,
  onEvalsClick,
  onRunClick,
  runButtonLabel,
  runDisabledReason,
  onGenerateClick,
  onAddMappingClick,
  onResetClick,
}: Props) {
  const runText = runButtonLabel ?? "Run";
  const isRunDisabled = Boolean(runDisabledReason) || !onRunClick;

  return (
    <div className="fixed bottom-16 left-[4.5rem] z-40 flex items-center gap-2 bg-slate-900/95 p-2 rounded-lg border border-slate-700 shadow-xl backdrop-blur-sm">
      {onEvalsClick && (
        <button
          className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
          onClick={onEvalsClick}
        >
          Evals
        </button>
      )}
      
      <button
        className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
          isRunDisabled 
            ? "text-slate-500 cursor-not-allowed" 
            : "text-emerald-400 hover:bg-emerald-400/10 hover:text-emerald-300"
        }`}
        onClick={() => !isRunDisabled && onRunClick?.()}
        disabled={isRunDisabled}
        title={runDisabledReason}
      >
        {runText}
      </button>

      {onGenerateClick && (
        <button
          className="px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-400/10 hover:text-amber-300 rounded transition-colors"
          onClick={onGenerateClick}
        >
          Generate
        </button>
      )}

      {onAddMappingClick && (
        <button
          className="px-3 py-1.5 text-xs font-semibold text-sky-400 hover:bg-sky-400/10 hover:text-sky-300 rounded transition-colors"
          onClick={onAddMappingClick}
        >
          Add Mapping
        </button>
      )}

      <div className="w-px h-4 bg-slate-700 mx-1" />

      <button
        className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
        onClick={onResetClick}
      >
        Reset
      </button>
    </div>
  );

}

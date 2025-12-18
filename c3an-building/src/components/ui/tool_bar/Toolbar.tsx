// =============================================================================
// Toolbar Component - Top action buttons
// =============================================================================

import type { RefObject } from "react";
import type { Theme } from "../../../types";

type Props = {
  theme: Theme;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onC3ANClick: () => void;
  onAboutClick: () => void;
  onEvalsClick: () => void;
  onDownloadClick: () => void;
  onUploadClick: () => void;
  onRunClick: () => void;
  onResetClick: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export default function Toolbar({
  theme,
  fileInputRef,
  onC3ANClick,
  onAboutClick,
  onEvalsClick,
  onDownloadClick,
  onUploadClick,
  onRunClick,
  onResetClick,
  onFileUpload,
}: Props) {
  const actionButtonClass =
    theme === "dark"
      ? "rounded-full border border-slate-700 bg-slate-800/90 px-4 py-2 text-sm font-semibold text-slate-100 shadow-sm hover:bg-slate-700"
      : "rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100";

  return (
    <div className="absolute top-4 right-6 z-30 flex items-center gap-3">
      <button className={actionButtonClass} onClick={onC3ANClick}>
        C3AN
      </button>
      <button className={actionButtonClass} onClick={onAboutClick}>
        About
      </button>
      <button className={actionButtonClass} onClick={onEvalsClick}>
        Evals
      </button>
      <button className={actionButtonClass} onClick={onDownloadClick}>
        Download JSON
      </button>
      <button className={actionButtonClass} onClick={onUploadClick}>
        Upload JSON
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={onFileUpload}
      />
      <button className={actionButtonClass} onClick={onRunClick}>
        Run
      </button>
      <button className={actionButtonClass} onClick={onResetClick}>
        Reset
      </button>
    </div>
  );
}

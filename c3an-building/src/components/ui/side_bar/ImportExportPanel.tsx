import type { ChangeEvent, RefObject } from "react";
import type { Theme } from "../../../shared/types";

type Props = {
  theme: Theme;
  downloadLabel: string;
  onDownloadClick: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
};

export default function ImportExportPanel({
  theme,
  downloadLabel,
  onDownloadClick,
  fileInputRef,
  onFileUpload,
}: Props) {
  const buttonClass =
    theme === "dark"
      ? "inline-flex max-w-full min-w-0 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-center text-sm font-semibold text-slate-100 transition whitespace-normal break-words hover:bg-slate-800"
      : "inline-flex max-w-full min-w-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-center text-sm font-semibold text-slate-700 transition whitespace-normal break-words hover:bg-slate-100";

  return (
    <div className="mt-4 space-y-5 text-sm">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-500">Workspace JSON</p>
        <div className="flex flex-wrap items-center gap-2">
          <button className={buttonClass} onClick={() => fileInputRef.current?.click()}>
            Upload JSON
          </button>
          <button className={buttonClass} onClick={onDownloadClick}>
            {downloadLabel}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Import the current workspace from JSON or export the active workflow payload.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        Upload imports plan or workflow JSON. Download exports the current plan bundle or triples payload based on the active view.
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={onFileUpload}
      />
    </div>
  );
}

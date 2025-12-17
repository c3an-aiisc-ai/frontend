import type { ChangeEvent, RefObject } from "react";

type Props = {
  actionButtonClass: string;
  fileInputRef: RefObject<HTMLInputElement>;
  onUploadChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onOpenC3AN: () => void;
  onOpenAbout: () => void;
  onNavigatePlanning?: () => void;
  onNavigateEvaluation?: () => void;
  onShowEvals: () => void;
  onDownloadJson: () => void;
  onRun: () => void;
  onReset: () => void;
};

export default function TopBar({
  actionButtonClass,
  fileInputRef,
  onUploadChange,
  onOpenC3AN,
  onOpenAbout,
  onNavigatePlanning,
  onNavigateEvaluation,
  onShowEvals,
  onDownloadJson,
  onRun,
  onReset,
}: Props) {
  return (
    <div className="absolute top-4 right-6 z-30 flex items-center gap-3">
      <button className={actionButtonClass} onClick={onOpenC3AN}>
        C3AN
      </button>
      <button className={actionButtonClass} onClick={onOpenAbout}>
        About
      </button>
      {onNavigatePlanning && (
        <button className={actionButtonClass} onClick={onNavigatePlanning}>
          Planning
        </button>
      )}
      {onNavigateEvaluation && (
        <button className={actionButtonClass} onClick={onNavigateEvaluation}>
          Evaluation
        </button>
      )}
      <button className={actionButtonClass} onClick={onShowEvals}>
        Evals
      </button>
      <button className={actionButtonClass} onClick={onDownloadJson}>
        Download JSON
      </button>
      <button className={actionButtonClass} onClick={() => fileInputRef.current?.click()}>
        Upload JSON
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={onUploadChange}
      />
      <button className={actionButtonClass} onClick={onRun}>
        Run
      </button>
      <button className={actionButtonClass} onClick={onReset}>
        Reset
      </button>
    </div>
  );
}

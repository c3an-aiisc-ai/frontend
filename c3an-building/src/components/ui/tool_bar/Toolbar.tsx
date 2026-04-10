// =============================================================================
// Toolbar Component - Top action buttons
// =============================================================================

import { useEffect, useId, useRef, useState } from "react";
import type { RefObject } from "react";
import type { Theme } from "../../../shared/types";

type Props = {
  theme: Theme;
  fileInputRef: RefObject<HTMLInputElement | null>;
  downloadLabel?: string;
  onPlanBackClick?: () => void;
  onC3ANClick: () => void;
  onSettingsClick: () => void;
  onPlanningClick?: () => void;
  onEvaluationClick?: () => void;
  onAgentGenClick?: () => void;
  onEvalsClick: () => void;
  onDownloadClick: () => void;
  onUploadClick: () => void;
  onRunClick?: () => void;
  runButtonLabel?: string;
  runDisabledReason?: string;
  onResetClick: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export default function Toolbar({
  theme,
  fileInputRef,
  downloadLabel,
  onPlanBackClick,
  onC3ANClick,
  onSettingsClick,
  onPlanningClick,
  onEvaluationClick,
  onAgentGenClick,
  onEvalsClick,
  onDownloadClick,
  onUploadClick,
  onRunClick,
  runButtonLabel,
  runDisabledReason,
  onResetClick,
  onFileUpload,
}: Props) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId().replace(/:/g, "");

  const actionButtonClass =
    theme === "dark"
      ? "toolbar-btn toolbar-btn-dark"
      : "toolbar-btn toolbar-btn-light";

  const menuPanelClass =
    theme === "dark"
      ? "toolbar-menu toolbar-menu-dark"
      : "toolbar-menu toolbar-menu-light";

  const menuItemClass =
    theme === "dark"
      ? "toolbar-menu-item toolbar-menu-item-dark"
      : "toolbar-menu-item toolbar-menu-item-light";

  const downloadText = downloadLabel ?? "Download JSON";
  const runText = runButtonLabel ?? "Run";
  const isRunDisabled = Boolean(runDisabledReason) || !onRunClick;
  const runButtonClass = `${actionButtonClass} ${isRunDisabled ? "cursor-not-allowed opacity-55" : ""}`;

  useEffect(() => {
    if (!isMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current || menuRef.current.contains(event.target as Node)) return;
      setIsMenuOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isMenuOpen]);

  const handleMenuAction = (action: () => void) => {
    action();
    setIsMenuOpen(false);
  };

  return (
    <div className="absolute top-4 right-4 z-30 flex max-w-[calc(100vw-7rem)] items-start gap-3 sm:right-6">
      <div className="hidden max-w-full flex-wrap justify-end gap-3 lg:flex">
        {onPlanBackClick && (
          <button className={actionButtonClass} onClick={onPlanBackClick}>
            Back
          </button>
        )}
        <button className={actionButtonClass} onClick={onC3ANClick}>
          C3AN
        </button>
        <button className={actionButtonClass} onClick={onSettingsClick}>
          Settings
        </button>
        {onPlanningClick && (
          <button className={actionButtonClass} onClick={onPlanningClick}>
            Planning
          </button>
        )}
        {onEvaluationClick && (
          <button className={actionButtonClass} onClick={onEvaluationClick}>
            Evaluation
          </button>
        )}
        {onAgentGenClick && (
          <button className={actionButtonClass} onClick={onAgentGenClick}>
            AgentGen
          </button>
        )}
        <button className={actionButtonClass} onClick={onEvalsClick}>
          Evals
        </button>
        <button className={actionButtonClass} onClick={onDownloadClick}>
          {downloadText}
        </button>
        <button className={actionButtonClass} onClick={onUploadClick}>
          Upload JSON
        </button>
        <button
          className={runButtonClass}
          onClick={onRunClick}
          disabled={isRunDisabled}
          title={runDisabledReason}
        >
          {runText}
        </button>
        <button className={actionButtonClass} onClick={onResetClick}>
          Reset
        </button>
      </div>

      <div className="relative lg:hidden" ref={menuRef}>
        <button
          className={actionButtonClass}
          onClick={() => setIsMenuOpen((prev) => !prev)}
          aria-expanded={isMenuOpen}
          aria-controls={menuId}
        >
          Menu
        </button>
        {isMenuOpen && (
          <div id={menuId} className={menuPanelClass} role="menu">
            {onPlanBackClick && (
              <button
                className={menuItemClass}
                onClick={() => handleMenuAction(onPlanBackClick)}
                role="menuitem"
              >
                Back
              </button>
            )}
            <button className={menuItemClass} onClick={() => handleMenuAction(onC3ANClick)} role="menuitem">
              C3AN
            </button>
            <button className={menuItemClass} onClick={() => handleMenuAction(onSettingsClick)} role="menuitem">
              Settings
            </button>
            {onPlanningClick && (
              <button className={menuItemClass} onClick={() => handleMenuAction(onPlanningClick)} role="menuitem">
                Planning
              </button>
            )}
            {onEvaluationClick && (
              <button className={menuItemClass} onClick={() => handleMenuAction(onEvaluationClick)} role="menuitem">
                Evaluation
              </button>
            )}
            {onAgentGenClick && (
              <button className={menuItemClass} onClick={() => handleMenuAction(onAgentGenClick)} role="menuitem">
                AgentGen
              </button>
            )}
            <button className={menuItemClass} onClick={() => handleMenuAction(onEvalsClick)} role="menuitem">
              Evals
            </button>
            <button className={menuItemClass} onClick={() => handleMenuAction(onDownloadClick)} role="menuitem">
              {downloadText}
            </button>
            <button className={menuItemClass} onClick={() => handleMenuAction(onUploadClick)} role="menuitem">
              Upload JSON
            </button>
            {isRunDisabled ? (
              <button className={`${menuItemClass} cursor-not-allowed opacity-55`} disabled title={runDisabledReason}>
                {runText}
              </button>
            ) : (
              <button
                className={menuItemClass}
                onClick={() => handleMenuAction(onRunClick ?? (() => undefined))}
                role="menuitem"
              >
                {runText}
              </button>
            )}
            <button className={menuItemClass} onClick={() => handleMenuAction(onResetClick)} role="menuitem">
              Reset
            </button>
          </div>
        )}
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

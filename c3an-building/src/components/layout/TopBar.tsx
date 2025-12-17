import { useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent, RefObject } from "react";

type Props = {
  actionButtonClass: string;
  theme: "light" | "dark";
  fileInputRef: RefObject<HTMLInputElement | null>;
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
  theme,
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId().replace(/:/g, "");

  const menuPanelClass =
    theme === "dark"
      ? "absolute right-0 mt-2 w-52 rounded-xl border border-slate-700 bg-slate-900/95 p-2 shadow-lg"
      : "absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-lg";

  const menuItemClass =
    theme === "dark"
      ? "flex w-full items-center rounded-lg px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
      : "flex w-full items-center rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100";

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
    <div className="absolute top-4 right-6 z-30 flex items-center gap-3">
      <div className="hidden lg:flex items-center gap-3">
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
        <button className={actionButtonClass} onClick={onRun}>
          Run
        </button>
        <button className={actionButtonClass} onClick={onReset}>
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
            <button className={menuItemClass} onClick={() => handleMenuAction(onOpenC3AN)} role="menuitem">
              C3AN
            </button>
            <button className={menuItemClass} onClick={() => handleMenuAction(onOpenAbout)} role="menuitem">
              About
            </button>
            {onNavigatePlanning && (
              <button className={menuItemClass} onClick={() => handleMenuAction(onNavigatePlanning)} role="menuitem">
                Planning
              </button>
            )}
            {onNavigateEvaluation && (
              <button className={menuItemClass} onClick={() => handleMenuAction(onNavigateEvaluation)} role="menuitem">
                Evaluation
              </button>
            )}
            <button className={menuItemClass} onClick={() => handleMenuAction(onShowEvals)} role="menuitem">
              Evals
            </button>
            <button className={menuItemClass} onClick={() => handleMenuAction(onDownloadJson)} role="menuitem">
              Download JSON
            </button>
            <button
              className={menuItemClass}
              onClick={() => handleMenuAction(() => fileInputRef.current?.click())}
              role="menuitem"
            >
              Upload JSON
            </button>
            <button className={menuItemClass} onClick={() => handleMenuAction(onRun)} role="menuitem">
              Run
            </button>
            <button className={menuItemClass} onClick={() => handleMenuAction(onReset)} role="menuitem">
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
        onChange={onUploadChange}
      />
    </div>
  );
}

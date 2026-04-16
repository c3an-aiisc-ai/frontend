// =============================================================================
// Toolbar Component - Top action buttons
// =============================================================================

import { useEffect, useId, useRef, useState } from "react";
import type { WorkspaceRouteKey } from "../../../config";
import type { Theme } from "../../../shared/types";
import WorkspaceTabs from "../WorkspaceTabs";

type Props = {
  theme: Theme;
  currentRoute: WorkspaceRouteKey;
  onEvalsClick?: () => void;
  onRunClick?: () => void;
  runButtonLabel?: string;
  runDisabledReason?: string;
  onResetClick: () => void;
};

export default function Toolbar({
  theme,
  currentRoute,
  onEvalsClick,
  onRunClick,
  runButtonLabel,
  runDisabledReason,
  onResetClick,
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
    <div className="relative" ref={menuRef}>
      <button
        className={`h-12 w-12 flex items-center justify-center rounded-md border border-slate-700 text-sm font-semibold transition ${
          isMenuOpen
            ? "bg-white text-slate-900 shadow-sm"
            : "bg-slate-800/70 text-white hover:bg-slate-800"
        }`}
        onClick={() => setIsMenuOpen((prev) => !prev)}
        aria-expanded={isMenuOpen}
        aria-controls={menuId}
        title="Menu"
      >
        <span className="flex flex-col gap-[3px] items-center justify-center pointer-events-none">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`w-4 h-[2px] rounded-full transition-colors ${
                isMenuOpen ? "bg-slate-900" : "bg-white"
              }`}
            />
          ))}
        </span>
      </button>

      {isMenuOpen && (
        <div
          id={menuId}
          className={`${menuPanelClass} !absolute !top-auto !right-auto !left-[calc(100%+12px)] !bottom-0 !w-[220px] shadow-2xl origin-bottom-left`}
          role="menu"
        >
          <WorkspaceTabs
            currentRoute={currentRoute}
            tone={theme === "dark" ? "dark" : "light"}
            orientation="column"
            onItemClick={() => setIsMenuOpen(false)}
          />
          <div className={`my-2 h-px ${theme === "dark" ? "bg-slate-800" : "bg-slate-100"}`} />
          {onEvalsClick && (
            <button className={menuItemClass} onClick={() => handleMenuAction(onEvalsClick)} role="menuitem">
              Evals
            </button>
          )}
          <button
            className={`${menuItemClass} ${isRunDisabled ? "cursor-not-allowed opacity-55" : ""}`}
            onClick={() => !isRunDisabled && handleMenuAction(onRunClick ?? (() => undefined))}
            disabled={isRunDisabled}
            title={runDisabledReason}
            role="menuitem"
          >
            <span className={!isRunDisabled ? "text-emerald-400 font-medium" : ""}>{runText}</span>
          </button>
          <button className={menuItemClass} onClick={() => handleMenuAction(onResetClick)} role="menuitem">
            Reset
          </button>
        </div>
      )}
    </div>
  );

}

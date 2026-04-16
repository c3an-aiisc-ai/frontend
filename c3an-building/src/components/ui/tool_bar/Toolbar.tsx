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
    <div className="absolute top-4 right-4 z-30 flex max-w-[calc(100vw-7rem)] items-start gap-3 sm:right-6">
      <div className="hidden max-w-full flex-wrap justify-end gap-3 lg:flex">
        <WorkspaceTabs currentRoute={currentRoute} tone={theme === "dark" ? "dark" : "light"} />
        {onEvalsClick && (
          <button className={actionButtonClass} onClick={onEvalsClick}>
            Evals
          </button>
        )}
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
            <WorkspaceTabs
              currentRoute={currentRoute}
              tone={theme === "dark" ? "dark" : "light"}
              orientation="column"
              onItemClick={() => setIsMenuOpen(false)}
            />
            {onEvalsClick && (
              <button className={menuItemClass} onClick={() => handleMenuAction(onEvalsClick)} role="menuitem">
                Evals
              </button>
            )}
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
    </div>
  );
}

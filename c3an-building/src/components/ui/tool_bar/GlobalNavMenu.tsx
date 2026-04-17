// =============================================================================
// GlobalNavMenu Component - Top-left consistent navigation
// =============================================================================

import { useEffect, useId, useRef, useState } from "react";
import type { RouteKey } from "../../../config";
import type { Theme } from "../../../shared/types";
import WorkspaceTabs from "../WorkspaceTabs";

type Props = {
  theme: Theme;
  currentRoute: RouteKey;
};

export default function GlobalNavMenu({
  theme,
  currentRoute,
}: Props) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId().replace(/:/g, "");

  const menuPanelClass =
    theme === "dark"
      ? "toolbar-menu toolbar-menu-dark"
      : "toolbar-menu toolbar-menu-light";

  useEffect(() => {
    if (!isMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current || menuRef.current.contains(event.target as Node)) return;
      setIsMenuOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isMenuOpen]);

  // If currentRoute is "home", it is not a WorkspaceRouteKey according to the type,
  // but WorkspaceTabs can handle it. We cast it to any or explicitly pass it.
  const workspaceRoute = currentRoute as any;

  return (
    <div className="fixed top-3 left-3 z-[100]" ref={menuRef}>
      <button
        className={`h-10 w-10 flex items-center justify-center rounded-md border text-sm font-semibold transition ${
          isMenuOpen
            ? "bg-white text-slate-900 border-slate-200 shadow-sm"
            : theme === "dark"
            ? "bg-slate-800/80 text-white border-slate-700 hover:bg-slate-700"
            : "bg-white/80 text-slate-900 border-slate-300 hover:bg-white shadow-sm"
        }`}
        onClick={() => setIsMenuOpen((prev) => !prev)}
        aria-expanded={isMenuOpen}
        aria-controls={menuId}
        title="Navigation Menu"
      >
        <span className="flex flex-col gap-[4px] items-center justify-center pointer-events-none">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`w-4 h-[2px] rounded-full transition-colors ${
                isMenuOpen
                  ? "bg-slate-900"
                  : theme === "dark"
                  ? "bg-slate-200"
                  : "bg-slate-700"
              }`}
            />
          ))}
        </span>
      </button>

      {isMenuOpen && (
        <div
          id={menuId}
          className={`${menuPanelClass} !absolute !top-0 !left-[calc(100%+12px)] !bottom-auto !w-[220px] shadow-2xl origin-top-left`}
          role="menu"
        >
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Workspace Navigation
          </div>
          <WorkspaceTabs
            currentRoute={workspaceRoute}
            tone={theme === "dark" ? "dark" : "light"}
            orientation="column"
            onItemClick={() => setIsMenuOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

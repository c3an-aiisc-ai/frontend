import { useEffect, useMemo, useState } from "react";
import type { ThemeMode } from "../types/workflow";

type ThemeResult = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  userThemeLocked: boolean;
  setUserThemeLocked: (locked: boolean) => void;
  appThemeClass: string;
  actionButtonClass: string;
};

export function useThemeMode(initial: ThemeMode = "dark"): ThemeResult {
  const [theme, setTheme] = useState<ThemeMode>(initial);
  const [userThemeLocked, setUserThemeLocked] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applySystemTheme = (prefersDark: boolean) => {
      if (userThemeLocked) return;
      setTheme(prefersDark ? "dark" : "light");
    };
    applySystemTheme(media.matches);
    const listener = (event: MediaQueryListEvent) => applySystemTheme(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [userThemeLocked]);

  const appThemeClass = useMemo(
    () =>
      theme === "dark"
        ? "bg-slate-950 text-slate-100"
        : "bg-slate-50 text-slate-900",
    [theme],
  );

  const actionButtonClass = useMemo(
    () =>
      theme === "dark"
        ? "rounded-full border border-slate-700 bg-slate-800/90 px-4 py-2 text-sm font-semibold text-slate-100 shadow-sm hover:bg-slate-700"
        : "rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100",
    [theme],
  );

  return {
    theme,
    setTheme,
    userThemeLocked,
    setUserThemeLocked,
    appThemeClass,
    actionButtonClass,
  };
}

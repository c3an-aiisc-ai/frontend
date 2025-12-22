// =============================================================================
// UI Configuration
// =============================================================================
// User interface settings including panels, tabs, and category styles.
// =============================================================================

import type { CategoryStyle } from "../features/evaluation/types";

// Panel configuration
export const panelConfig = {
  titles: {
    blocks: "Blocks",
    tools: "Tools",
    settings: "Settings",
  } as Record<string, string>,

  tabs: [
    { id: "blocks", label: "Blocks", symbol: "[]" },
    { id: "tools", label: "Tools", symbol: "TL" },
    { id: "settings", label: "Settings", symbol: ":" },
  ] as const,
} as const;

// Category styles for evaluation metrics
export const categoryStyles: Record<string, CategoryStyle> = {
  Performance: {
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700",
    selected: "bg-emerald-100 border-emerald-200 text-emerald-800",
    idle: "bg-white border-slate-200 text-slate-600 hover:border-emerald-200",
  },
  Quality: {
    dot: "bg-sky-500",
    chip: "bg-sky-50 text-sky-700",
    selected: "bg-sky-100 border-sky-200 text-sky-800",
    idle: "bg-white border-slate-200 text-slate-600 hover:border-sky-200",
  },
  Safety: {
    dot: "bg-rose-500",
    chip: "bg-rose-50 text-rose-700",
    selected: "bg-rose-100 border-rose-200 text-rose-800",
    idle: "bg-white border-slate-200 text-slate-600 hover:border-rose-200",
  },
  Efficiency: {
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-700",
    selected: "bg-amber-100 border-amber-200 text-amber-800",
    idle: "bg-white border-slate-200 text-slate-600 hover:border-amber-200",
  },
  Default: {
    dot: "bg-slate-400",
    chip: "bg-slate-100 text-slate-600",
    selected: "bg-slate-200 border-slate-300 text-slate-700",
    idle: "bg-white border-slate-200 text-slate-600 hover:border-slate-300",
  },
};

// Type exports
export type PanelConfig = typeof panelConfig;
export type PanelTab = (typeof panelConfig.tabs)[number];

// src/pages/PlanningWorkflowEditor.tsx

import { useState } from "react";
import WorkflowEditorPage from "./WorkflowEditorPage";
import { PlanningCanvas } from "../components/canvas";
import type { PlanningBlock } from "../types";
import { useWorkspace } from "../hooks";

type ViewState =
  | { mode: "planning" }
  | { mode: "workflow"; plan: PlanningBlock };

export default function PlanningWorkflowEditor({ initialPlan }: { initialPlan?: PlanningBlock | null }) {
  const { theme } = useWorkspace();
  const [view, setView] = useState<ViewState>({ mode: "planning" });
  const initialPlans = initialPlan ? [initialPlan] : [];
  const [plans, setPlans] = useState<PlanningBlock[]>(initialPlans);
  const [planConnections, setPlanConnections] = useState<{ from: string; to: string }[]>([]);
  const [linkingPlan, setLinkingPlan] = useState<{ from: string; current: { x: number; y: number } } | null>(null);

  const [activePanel, setActivePanel] = useState<"blocks" | "tools" | "settings" | null>("blocks");
  const panelTabs: { id: "blocks" | "tools" | "settings"; label: string; symbol: string }[] = [
    { id: "blocks", label: "Blocks", symbol: "[]" },
    { id: "tools", label: "Tools", symbol: "TL" },
    { id: "settings", label: "Settings", symbol: ":" },
  ];

  if (view.mode === "workflow") {
    return <WorkflowEditorPage />;
  }

  return (
    <div className={`relative h-screen w-screen overflow-hidden`}>
      <div className="absolute left-0 top-0 bottom-0 z-30 flex">
        <div className="flex flex-col items-center gap-2 bg-slate-900/95 px-2 py-3 text-white shadow-xl">
          <button
            className={`h-12 w-12 rounded-md border border-slate-700 text-sm font-semibold transition ${
              activePanel === "blocks" ? "bg-white text-slate-900 shadow-sm" : "bg-slate-800/70 text-white hover:bg-slate-800"
            }`}
            onClick={() => setActivePanel((prev) => (prev === "blocks" ? null : "blocks"))}
            aria-pressed={activePanel === "blocks"}
            aria-label="Blocks"
          >
            []
          </button>
          {panelTabs.map((item) => (
            <button
              key={item.id}
              className={`h-12 w-12 rounded-md border border-slate-700 text-sm font-semibold transition ${
                activePanel === item.id ? "bg-white text-slate-900 shadow-sm" : "bg-slate-800/70 text-white hover:bg-slate-800"
              }`}
              onClick={() => setActivePanel((prev) => (prev === item.id ? null : item.id))}
              aria-pressed={activePanel === item.id}
              aria-label={item.label}
            >
              {item.symbol}
            </button>
          ))}
        </div>

        {activePanel && (
          <div
            className={`w-72 backdrop-blur px-4 py-5 shadow-xl transition-all flex flex-col overflow-hidden ${
              theme === "dark" ? "border-r border-slate-800 bg-slate-900/90 text-slate-100" : "border-r border-slate-200 bg-white/95 text-slate-900"
            }`}
          >
            <div className="text-sm font-semibold mb-2">{activePanel.toUpperCase()}</div>
            <div className="text-xs text-slate-400">Panel content placeholder</div>
          </div>
        )}
      </div>

      <PlanningCanvas
        theme={theme}
        plans={plans}
        connections={planConnections}
        linking={linkingPlan}
        onStartLink={(id: string, anchor) => setLinkingPlan({ from: id, current: anchor })}
        onMoveLink={(point) => setLinkingPlan((prev) => (prev ? { ...prev, current: point } : prev))}
        onCompleteLink={(id: string) => {
          setPlanConnections((prev) => {
            if (!linkingPlan || linkingPlan.from === id) return prev;
            const exists = prev.some((c) => c.from === linkingPlan.from && c.to === id);
            return exists ? prev : [...prev, { from: linkingPlan.from, to: id }];
          });
          setLinkingPlan(null);
        }}
        onCancelLink={() => setLinkingPlan(null)}
        onPlanMove={(id, x, y) => {
          setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, x, y } : p)));
        }}
        onRemovePlan={(id) => {
          setPlans((prev) => prev.filter((p) => p.id !== id));
          setPlanConnections((prev) => prev.filter((c) => c.from !== id && c.to !== id));
          setLinkingPlan((prev) => (prev && prev.from === id ? null : prev));
        }}
        onEnterWorkflow={(plan: PlanningBlock) => setView({ mode: "workflow", plan })}
      />
    </div>
  );
}

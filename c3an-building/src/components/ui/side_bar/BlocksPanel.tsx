// =============================================================================
// Blocks Panel Component - Agent and IO blocks panel
// =============================================================================

import type { DragEvent } from "react";
import { AGENT_REGISTRY_AGENTS, listMandatoryOptional } from "../../../constants";
import type { ViewMode } from "../../../types";

type Props = {
  viewMode: ViewMode;
  onAgentDragStart: (agentId: string) => (e: DragEvent<HTMLDivElement>) => void;
  onPlanDragStart: (e: DragEvent<HTMLDivElement>) => void;
};

export default function BlocksPanel({
  viewMode,
  onAgentDragStart,
  onPlanDragStart,
}: Props) {
  if (viewMode === "plan") {
    return (
      <div className="mt-4 space-y-4 flex-1 overflow-y-auto pr-1">
        <p className="text-xs uppercase tracking-wide text-slate-500">Plan Blocks</p>
        <div className="space-y-4">
          <div
            className="cursor-grab rounded-xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 p-4 shadow-sm active:cursor-grabbing"
            draggable
            onDragStart={onPlanDragStart}
          >
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-semibold text-slate-900">Plan Block</p>
                <p className="text-xs text-slate-600 leading-snug">
                  Drag onto the canvas to create a plan node.
                </p>
              </div>
              <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-amber-100">
                Drag
              </span>
            </div>
            <p className="mt-3 text-xs text-slate-600">
              Plan view does not support tools.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4 flex-1 overflow-y-auto pr-1">
      <p className="text-xs uppercase tracking-wide text-slate-500">Agent Blocks</p>
      <div className="space-y-4">
        {AGENT_REGISTRY_AGENTS.map((agent) => {
          const input = listMandatoryOptional(agent.input_data_streams);
          const output = listMandatoryOptional(agent.output_data_streams);
          const totalInputs = input.mandatory.length + input.optional.length;
          const totalOutputs = output.mandatory.length + output.optional.length;

          return (
            <div
              key={agent.id}
              className="cursor-grab rounded-xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 p-4 shadow-sm active:cursor-grabbing"
              draggable
              onDragStart={onAgentDragStart(agent.id)}
              title={agent.id}
            >
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-semibold text-slate-900">{agent.name}</p>
                  <p className="text-xs text-slate-600 leading-snug">{agent.description}</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                  Drag
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-700">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 ring-1 ring-emerald-100">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  {totalInputs} inputs
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-1 ring-1 ring-sky-100">
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                  {totalOutputs} outputs
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 ring-1 ring-indigo-100">
                  <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                  0 tools
                </span>
              </div>

              <p className="mt-3 text-xs text-slate-600">Agent ID: {agent.id}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

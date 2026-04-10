// =============================================================================
// Blocks Panel Component - Agent and IO blocks panel
// =============================================================================

import type { DragEvent } from "react";
import { navigateTo } from "../../../config";
import { listMandatoryOptional } from "../../../shared/constants";
import type { AgentRegistryEntry, ViewMode } from "../../../shared/types";
import type { PlanTemplate } from "../../../shared/types/planning";

type Props = {
  viewMode: ViewMode;
  registryAgents: AgentRegistryEntry[];
  customAgents: AgentRegistryEntry[];
  planTemplates: PlanTemplate[];
  onAgentDragStart: (agentId: string) => (e: DragEvent<HTMLDivElement>) => void;
  onPlanDragStart: (template?: PlanTemplate) => (e: DragEvent<HTMLDivElement>) => void;
};

export default function BlocksPanel({
  viewMode,
  registryAgents,
  customAgents,
  planTemplates,
  onAgentDragStart,
  onPlanDragStart,
}: Props) {
  if (viewMode === "plan") {
    return (
      <div className="mt-4 space-y-6 flex-1 overflow-y-auto pr-1">
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Subplans</p>
          <div
            className="draggable-card"
            draggable
            onDragStart={onPlanDragStart()}
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                <p className="text-sm font-semibold text-slate-900">Subplan</p>
                <p className="text-xs text-slate-600 leading-snug">
                  Drag onto the canvas to create a subplan node.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-amber-100">
                Drag
              </span>
            </div>
            <p className="mt-3 text-xs text-slate-600">
              Subplan view does not support tools.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-slate-500">Subplan Templates</p>
            <button
              className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-500"
              onClick={() => navigateTo("planning")}
            >
              Planning
            </button>
          </div>
          {planTemplates.length === 0 ? (
            <div className="empty-state p-4 text-xs text-slate-500">
              No plan templates yet. Add some from the planning page.
            </div>
          ) : (
            <div className="space-y-3">
              {planTemplates.map((plan, index) => (
                <div
                  key={`${plan.id}-${index}`}
                  className="draggable-card"
                  draggable
                  onDragStart={onPlanDragStart(plan)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                      <p className="text-sm font-semibold text-slate-900">{plan.name}</p>
                      <p className="text-xs text-slate-600 leading-snug">
                        {plan.query || "No query provided."}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-amber-100">
                      Custom
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-700">
                    <span className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-center whitespace-normal break-words">
                      {plan.triples.length} triples
                    </span>
                    <span className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-center whitespace-normal break-words">
                      ID: {plan.id}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const renderAgentCard = (
    agent: AgentRegistryEntry,
    badgeLabel: string,
    badgeClass: string,
    keySuffix = ""
  ) => {
    const input = listMandatoryOptional(agent.input_data_streams);
    const output = listMandatoryOptional(agent.output_data_streams);
    const totalInputs = input.mandatory.length + input.optional.length;
    const totalOutputs = output.mandatory.length + output.optional.length;

    return (
      <div
        key={`${agent.id}${keySuffix}`}
        className="draggable-card"
        draggable
        onDragStart={onAgentDragStart(agent.id)}
        title={agent.id}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 flex flex-col gap-0.5">
            <p className="text-sm font-semibold text-slate-900">{agent.name}</p>
            <p className="text-xs text-slate-600 leading-snug">{agent.description}</p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${badgeClass}`}
          >
            {badgeLabel}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-700">
          <span className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 ring-1 ring-emerald-100 text-center whitespace-normal break-words">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            {totalInputs} inputs
          </span>
          <span className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full bg-sky-50 px-2 py-1 ring-1 ring-sky-100 text-center whitespace-normal break-words">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
            {totalOutputs} outputs
          </span>
          <span className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 ring-1 ring-indigo-100 text-center whitespace-normal break-words">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
            0 tools
          </span>
        </div>

        <p className="mt-3 break-all text-xs text-slate-600">Agent ID: {agent.id}</p>
      </div>
    );
  };

  return (
    <div className="mt-4 space-y-6 flex-1 overflow-y-auto pr-1">
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Registry Agents</p>
        {registryAgents.map((agent) =>
          renderAgentCard(agent, "Drag", "bg-emerald-50 text-emerald-700")
        )}
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-wide text-slate-500">Custom Agents</p>
          <button
            className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-500"
            onClick={() => navigateTo("agentgen")}
          >
            AgentGen
          </button>
        </div>
        {customAgents.length === 0 ? (
          <div className="empty-state p-4 text-xs text-slate-500">
            No custom agents yet. Generate some in AgentGen to add them here.
          </div>
        ) : (
          customAgents.map((agent, index) =>
            renderAgentCard(
              agent,
              "Custom",
              "bg-amber-50 text-amber-700",
              `-custom-${index}`
            )
          )
        )}
      </div>
    </div>
  );
}

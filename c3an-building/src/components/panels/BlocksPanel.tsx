// =============================================================================
// Blocks Panel Component - Agent and IO blocks panel
// =============================================================================

import type { DragEvent } from "react";
type Props = {
  isPlanningView?: boolean;
  agentJsonInput: string;
  agentParseError: string | null;
  onAgentJsonInputChange: (value: string) => void;
  onGenerateAgentsFromJson: () => void;
  onAddPlanBlock?: () => void;
  onBlockDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onUploadDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onOutputDragStart: (e: DragEvent<HTMLDivElement>) => void;
};

export default function BlocksPanel({
  isPlanningView = false,
  agentJsonInput,
  agentParseError,
  onAgentJsonInputChange,
  onGenerateAgentsFromJson,
  onAddPlanBlock,
  onBlockDragStart,
  onUploadDragStart,
  onOutputDragStart,
}: Props) {
  if (isPlanningView) {
    return (
      <div className="mt-4 space-y-4 flex-1 overflow-y-auto pr-1">
        <p className="text-xs uppercase tracking-wide text-slate-500">Planning Blocks</p>
        <div className="space-y-3">
          <div
            className="w-full rounded-xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 p-4 text-left shadow-sm hover:shadow-md transition cursor-grab active:cursor-grabbing"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "copy";
              e.dataTransfer.setData("application/json", JSON.stringify({ type: "planning-block" }));
            }}
            onClick={onAddPlanBlock}
          >
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-semibold text-slate-900">Add plan block</p>
                <p className="text-xs text-slate-600 leading-snug">Creates a planning card with id/query you can wire to others.</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Add</span>
            </div>
            <p className="mt-3 text-xs text-slate-600">Use this view to organize plans before entering workflows.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4 flex-1 overflow-y-auto pr-1">
      <p className="text-xs uppercase tracking-wide text-slate-500">
        Agent & IO Blocks
      </p>
      <div className="space-y-4">
        {/* Agent Block */}
        <div
          className="cursor-grab rounded-xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 p-4 shadow-sm active:cursor-grabbing"
          draggable
          onDragStart={onBlockDragStart}
        >
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-semibold text-slate-900">Agent: Solo</p>
              <p className="text-xs text-slate-600 leading-snug">
                Starter block that adapts as you connect.
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              Drag
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-700">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 ring-1 ring-emerald-100">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              1 input
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-1 ring-1 ring-sky-100">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
              1 output
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 ring-1 ring-indigo-100">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
              0 tools
            </span>
          </div>
          <p className="mt-3 text-xs text-slate-600">
            Drag to canvas and add links; inputs/outputs grow as you connect
            more wires.
          </p>
        </div>

        <div className="grid gap-3">
          {/* Upload Block */}
          <div
            className="cursor-grab rounded-xl border border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-sky-100 p-4 shadow-sm ring-1 ring-inset ring-indigo-100 active:cursor-grabbing"
            draggable
            onDragStart={onUploadDragStart}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Upload block
                </p>
                <p className="text-xs text-slate-600">
                  PDF, CSV, Excel, JSON, TXT and more
                </p>
              </div>
              <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700 ring-1 ring-slate-200">
                Drag
              </span>
            </div>
            <div className="mt-3 grid grid-cols-[auto,1fr,auto] gap-3 items-center text-[11px] text-slate-700">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200" />
                <span className="text-[11px] font-medium text-emerald-900">
                  Input
                </span>
              </div>
              <div className="h-px bg-gradient-to-r from-emerald-200 via-emerald-100 to-transparent" />
              <div className="flex items-center gap-2 justify-end">
                <span className="text-[11px] font-medium text-slate-700">
                  Output
                </span>
                <div className="h-2.5 w-2.5 rounded-full bg-sky-500 shadow-sm shadow-sky-200" />
              </div>
            </div>
            <p className="mt-3 text-[11px] text-slate-600">
              Use this as a data source before branching into agents or tools.
            </p>
          </div>

          {/* Output Block */}
          <div
            className="cursor-grab rounded-xl border border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-amber-100 p-4 shadow-sm ring-1 ring-inset ring-emerald-100 active:cursor-grabbing"
            draggable
            onDragStart={onOutputDragStart}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Output block
                </p>
                <p className="text-xs text-slate-600">
                  Define response/formatting requirements
                </p>
              </div>
              <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700 ring-1 ring-slate-200">
                Drag
              </span>
            </div>
            <div className="mt-3 grid grid-cols-[auto,1fr,auto] gap-3 items-center text-[11px] text-slate-700">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200" />
                <span className="text-[11px] font-medium text-emerald-900">
                  Input
                </span>
              </div>
              <div className="h-px bg-gradient-to-r from-emerald-200 via-emerald-100 to-transparent" />
              <div className="flex items-center gap-2 justify-end">
                <span className="text-[11px] font-medium text-slate-700">
                  Output
                </span>
                <div className="h-2.5 w-2.5 rounded-full bg-sky-500 shadow-sm shadow-sky-200" />
              </div>
            </div>
            <p className="mt-3 text-[11px] text-slate-600">
              Collect results and specify final format.
            </p>
          </div>
        </div>

        {/* JSON Generator */}
        <div className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Generate from JSON
              </p>
              <p className="text-xs text-slate-600">
                Build agents, inputs, outputs, and capability tools.
              </p>
            </div>
            <span className="rounded-full bg-slate-900/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
              Beta
            </span>
          </div>
          <textarea
            className="mt-3 w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            rows={6}
            value={agentJsonInput}
            onChange={(e) => onAgentJsonInputChange(e.target.value)}
            spellCheck={false}
          />
          {agentParseError && (
            <p className="mt-2 text-xs font-semibold text-rose-600">
              {agentParseError}
            </p>
          )}
          <div className="mt-3 flex items-center justify-between">
            <p className="text-[11px] text-slate-600">
              Agents become blocks with matching input/output counts;
              capabilities become tools linked underneath.
            </p>
            <button
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500"
              onClick={onGenerateAgentsFromJson}
            >
              Generate agents
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

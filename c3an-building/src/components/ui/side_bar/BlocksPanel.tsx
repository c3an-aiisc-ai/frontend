// =============================================================================
// Blocks Panel Component - Agent and IO blocks panel
// =============================================================================

import type { DragEvent } from "react";

type Props = {
  onBlockDragStart: (e: DragEvent<HTMLDivElement>) => void;
};

export default function BlocksPanel({
  onBlockDragStart,
}: Props) {
  return (
    <div className="mt-4 space-y-4 flex-1 overflow-y-auto pr-1">
      <p className="text-xs uppercase tracking-wide text-slate-500">Agent Blocks</p>
      <div className="space-y-4">
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
            Drag to canvas and add links; inputs/outputs grow as you connect more wires.
          </p>
        </div>
      </div>
    </div>
  );
}

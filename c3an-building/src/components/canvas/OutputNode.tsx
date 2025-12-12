// =============================================================================
// Output Node Component - Output/sink block on canvas
// =============================================================================

import type { ChangeEvent, PointerEvent as ReactPointerEvent } from "react";
import type {
  OutputNode as OutputNodeType,
  OutputHandles,
  LinkTarget,
} from "../../types";
import HandleDot from "./HandleDot";

type Props = {
  output: OutputNodeType;
  handles: OutputHandles;
  isActive: boolean;
  isDragging: boolean;
  showHandles: boolean;
  onPointerDown: (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => void;
  onRemove: (id: string) => void;
  onHoverEnter: (id: string) => void;
  onHoverLeave: (id: string) => void;
  onFormatChange: (id: string) => (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onFormatBlur: (id: string) => () => void;
  onInputEnter: (target: { type: "output"; id: string; inputIndex: number }) => () => void;
  onInputLeave: (target: { type: "output"; id: string; inputIndex: number }) => () => void;
  onStartLinkingFromInput: (target: LinkTarget) => (e: ReactPointerEvent<HTMLDivElement>) => void;
  onFinalizeLinking: (target?: LinkTarget) => void;
};

export default function OutputNode({
  output,
  handles,
  isActive,
  isDragging,
  showHandles,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onRemove,
  onHoverEnter,
  onHoverLeave,
  onFormatChange,
  onFormatBlur,
  onInputEnter,
  onInputLeave,
  onStartLinkingFromInput,
  onFinalizeLinking,
}: Props) {
  return (
    <div
      className="absolute"
      style={{ left: output.x, top: output.y }}
      onPointerEnter={() => onHoverEnter(output.id)}
      onPointerLeave={() => onHoverLeave(output.id)}
    >
      <div
        className={`relative rounded-xl border border-slate-200 bg-white/90 p-4 shadow-md backdrop-blur-sm transition-all duration-150 ${
          isActive ? "ring-2 ring-amber-300" : ""
        } ${isDragging ? "scale-[1.01]" : "scale-[0.98]"} cursor-grab active:cursor-grabbing select-none flex flex-col gap-3`}
        data-output
        style={{ width: handles.width, height: handles.height }}
        onPointerDown={onPointerDown(output.id)}
        onPointerMove={onPointerMove(output.id)}
        onPointerUp={onPointerUp(output.id)}
      >
        {/* Remove button */}
        <button
          className={`absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white text-xs shadow-md transition-all duration-150 ${
            isActive
              ? "scale-100 opacity-100"
              : "scale-75 opacity-0 pointer-events-none"
          }`}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onClick={() => onRemove(output.id)}
          aria-label="Remove output block"
        >
          ×
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">{output.name}</p>
            <p className="text-xs text-slate-600">
              Describe the final response shape
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-amber-100">
            Sink
          </span>
        </div>

        {/* Format textarea */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 flex flex-col gap-2">
          <p className="text-[11px] font-semibold text-slate-800 mb-2">
            Output format
          </p>
          <textarea
            className="w-full rounded-md border border-slate-200 bg-white/90 px-2 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none min-h-[88px]"
            rows={3}
            value={output.format}
            onChange={onFormatChange(output.id)}
            spellCheck={false}
            data-output-control
            onBlur={onFormatBlur(output.id)}
          />
        </div>
      </div>

      {/* Input handle (left side) */}
      <div
        className={`absolute flex h-8 w-8 items-center justify-center transition-all duration-150 z-10 ${
          showHandles ? "opacity-100 scale-100" : "opacity-0 scale-75"
        }`}
        style={{
          top: handles.input.y - output.y - 12,
          left: handles.input.x - output.x - 12,
          width: 24,
          height: 24,
          pointerEvents: "auto",
        }}
        data-input
        data-connector
        onPointerDownCapture={onStartLinkingFromInput({
          type: "output",
          id: output.id,
          inputIndex: 0,
        })}
        onPointerEnter={onInputEnter({
          type: "output",
          id: output.id,
          inputIndex: 0,
        })}
        onPointerLeave={onInputLeave({
          type: "output",
          id: output.id,
          inputIndex: 0,
        })}
        onPointerDown={onStartLinkingFromInput({
          type: "output",
          id: output.id,
          inputIndex: 0,
        })}
        onPointerUp={() =>
          onFinalizeLinking({
            type: "output",
            id: output.id,
            inputIndex: 0,
          })
        }
      >
        <HandleDot />
      </div>
    </div>
  );
}

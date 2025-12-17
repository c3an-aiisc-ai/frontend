import type { ChangeEvent, PointerEventHandler } from "react";
import type { LinkTarget, OutputHandles, OutputNode } from "../../../types/workflow";
import FloatingRemoveButton from "../../ui/FloatingRemoveButton";
import HandleDot from "../HandleDot";

type Props = {
  output: OutputNode;
  handles: OutputHandles;
  isActive: boolean;
  isDragging: boolean;
  showHandles: boolean;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onRemove: () => void;
  onOutputPointerDown: PointerEventHandler<HTMLDivElement>;
  onOutputPointerMove: PointerEventHandler<HTMLDivElement>;
  onOutputPointerUp: PointerEventHandler<HTMLDivElement>;
  onFormatChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onFormatBlur: () => void;
  startLinkingFromInput: (target: LinkTarget) => PointerEventHandler<HTMLDivElement>;
  handleInputEnter: (target: LinkTarget) => PointerEventHandler<HTMLDivElement>;
  handleInputLeave: (target: LinkTarget) => PointerEventHandler<HTMLDivElement>;
  finalizeLinking: (overrideTarget?: LinkTarget) => void;
};

export default function OutputNode({
  output,
  handles,
  isActive,
  isDragging,
  showHandles,
  onPointerEnter,
  onPointerLeave,
  onRemove,
  onOutputPointerDown,
  onOutputPointerMove,
  onOutputPointerUp,
  onFormatChange,
  onFormatBlur,
  startLinkingFromInput,
  handleInputEnter,
  handleInputLeave,
  finalizeLinking,
}: Props) {
  return (
    <div
      className="absolute"
      style={{ left: output.x, top: output.y }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <div
        className={`relative rounded-xl border border-slate-200 bg-white/90 p-4 shadow-md backdrop-blur-sm transition-all duration-150 ${
          isActive ? "ring-2 ring-amber-300" : ""
        } ${isDragging ? "scale-[1.01]" : "scale-[0.98]"} cursor-grab active:cursor-grabbing select-none flex flex-col gap-3`}
        data-output
        style={{ width: handles.width, height: handles.height }}
        onPointerDown={onOutputPointerDown}
        onPointerMove={onOutputPointerMove}
        onPointerUp={onOutputPointerUp}
      >
        <FloatingRemoveButton
          visible={isActive}
          ariaLabel="Remove output block"
          onClick={onRemove}
        />
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">{output.name}</p>
            <p className="text-xs text-slate-600">Describe the final response shape</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-amber-100">
            Sink
          </span>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 flex flex-col gap-2">
          <p className="text-[11px] font-semibold text-slate-800 mb-2">Output format</p>
          <textarea
            className="w-full rounded-md border border-slate-200 bg-white/90 px-2 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none min-h-[88px]"
            rows={3}
            value={output.format}
            onChange={onFormatChange}
            spellCheck={false}
            data-output-control
            onBlur={onFormatBlur}
          />
        </div>
      </div>
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
        onPointerDownCapture={startLinkingFromInput({ type: "output", id: output.id, inputIndex: 0 })}
        onPointerEnter={handleInputEnter({ type: "output", id: output.id, inputIndex: 0 })}
        onPointerLeave={handleInputLeave({ type: "output", id: output.id, inputIndex: 0 })}
        onPointerDown={startLinkingFromInput({ type: "output", id: output.id, inputIndex: 0 })}
        onPointerUp={() =>
          finalizeLinking({
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

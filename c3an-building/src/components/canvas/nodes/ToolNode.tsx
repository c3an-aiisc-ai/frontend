import type { PointerEventHandler } from "react";
import type { LinkSource, LinkTarget, ToolHandles, ToolNode } from "../../../types/workflow";
import FloatingRemoveButton from "../../ui/FloatingRemoveButton";
import HandleDot from "../HandleDot";

type Props = {
  tool: ToolNode;
  handles: ToolHandles;
  isActive: boolean;
  isDragging: boolean;
  showHandles: boolean;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onRemove: () => void;
  onOpenDetails: () => void;
  onToolPointerDown: PointerEventHandler<HTMLDivElement>;
  onToolPointerMove: PointerEventHandler<HTMLDivElement>;
  onToolPointerUp: PointerEventHandler<HTMLDivElement>;
  startLinkingFromOutput: (source: LinkSource) => PointerEventHandler<HTMLDivElement>;
  handleOutputEnter: (source: LinkSource) => PointerEventHandler<HTMLDivElement>;
  handleOutputLeave: (source: LinkSource) => PointerEventHandler<HTMLDivElement>;
  onMoveLinking: PointerEventHandler<HTMLDivElement>;
  finalizeLinking: (overrideTarget?: LinkTarget) => void;
};

export default function ToolNode({
  tool,
  handles,
  isActive,
  isDragging,
  showHandles,
  onPointerEnter,
  onPointerLeave,
  onRemove,
  onOpenDetails,
  onToolPointerDown,
  onToolPointerMove,
  onToolPointerUp,
  startLinkingFromOutput,
  handleOutputEnter,
  handleOutputLeave,
  onMoveLinking,
  finalizeLinking,
}: Props) {
  const width = handles.width;
  const height = handles.height;

  return (
    <div
      className="absolute"
      style={{ left: tool.x, top: tool.y }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <div
        className={`relative overflow-visible ${isActive ? "ring-2 ring-offset-2 ring-offset-white shadow-lg" : ""} ${
          isDragging ? "scale-[1.01]" : ""
        } cursor-grab active:cursor-grabbing select-none`}
        data-tool
        style={{ width, height }}
        onPointerDown={onToolPointerDown}
        onPointerMove={onToolPointerMove}
        onPointerUp={onToolPointerUp}
      >
        <div
          className={`absolute inset-0 rounded-lg bg-gradient-to-br ${tool.gradient} ring-1 ring-inset ${tool.ring} shadow-sm transition-all duration-150 pointer-events-none`}
        />
        <div className="relative h-full w-full flex flex-col items-center justify-center px-4 text-center gap-2">
          <FloatingRemoveButton
            visible={isActive}
            ariaLabel="Remove tool"
            size="sm"
            onClick={onRemove}
          />
          <p className="text-base font-semibold text-slate-900">{tool.name}</p>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white shadow-sm"
              onPointerDown={(event) => {
                event.stopPropagation();
                event.preventDefault();
              }}
              onClick={(event) => {
                event.stopPropagation();
                onOpenDetails();
              }}
            >
              Details
            </button>
          </div>
        </div>
        <div
          className={`absolute left-1/2 -top-4 -translate-x-1/2 flex h-8 w-8 items-center justify-center transition-all duration-150 z-10 ${
            showHandles ? "opacity-100 scale-100" : "opacity-0 scale-75"
          }`}
          style={{ top: handles.output.y - tool.y - 16, pointerEvents: "auto" }}
          data-output
          data-input
          data-connector
          onPointerDown={startLinkingFromOutput({ type: "tool", id: tool.id, port: 0 })}
          onPointerDownCapture={startLinkingFromOutput({ type: "tool", id: tool.id, port: 0 })}
          onPointerEnter={handleOutputEnter({ type: "tool", id: tool.id, port: 0 })}
          onPointerLeave={handleOutputLeave({ type: "tool", id: tool.id, port: 0 })}
          onPointerMove={onMoveLinking}
          onPointerUp={() => finalizeLinking({ type: "tool", id: tool.id })}
        >
          <HandleDot />
        </div>
      </div>
    </div>
  );
}

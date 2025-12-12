// =============================================================================
// Tool Node Component - Tool block on canvas
// =============================================================================

import type { PointerEvent as ReactPointerEvent } from "react";
import type {
  ToolNode as ToolNodeType,
  ToolHandles,
  LinkSource,
  LinkTarget,
} from "../../types";
import HandleDot from "./HandleDot";

type Props = {
  tool: ToolNodeType;
  handles: ToolHandles;
  isActive: boolean;
  isDragging: boolean;
  showHandles: boolean;
  onPointerDown: (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => void;
  onRemove: (id: string) => void;
  onDetailsClick: (id: string) => void;
  onHoverEnter: (id: string) => void;
  onHoverLeave: (id: string) => void;
  onOutputEnter: (source: LinkSource) => () => void;
  onOutputLeave: (source: LinkSource) => () => void;
  onStartLinkingFromOutput: (source: LinkSource) => (e: ReactPointerEvent<HTMLDivElement>) => void;
  onFinalizeLinking: (target?: LinkTarget) => void;
  onMoveLinking: (e: ReactPointerEvent<HTMLDivElement>) => void;
};

export default function ToolNode({
  tool,
  handles,
  isActive,
  isDragging,
  showHandles,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onRemove,
  onDetailsClick,
  onHoverEnter,
  onHoverLeave,
  onOutputEnter,
  onOutputLeave,
  onStartLinkingFromOutput,
  onFinalizeLinking,
  onMoveLinking,
}: Props) {
  const { width, height } = handles;

  return (
    <div
      className="absolute"
      style={{ left: tool.x, top: tool.y }}
      onPointerEnter={() => onHoverEnter(tool.id)}
      onPointerLeave={() => onHoverLeave(tool.id)}
    >
      <div
        className={`relative overflow-visible ${
          isActive ? "ring-2 ring-offset-2 ring-offset-white shadow-lg" : ""
        } ${isDragging ? "scale-[1.01]" : ""} cursor-grab active:cursor-grabbing select-none`}
        data-tool
        style={{ width, height }}
        onPointerDown={onPointerDown(tool.id)}
        onPointerMove={onPointerMove(tool.id)}
        onPointerUp={onPointerUp(tool.id)}
      >
        {/* Background gradient */}
        <div
          className={`absolute inset-0 rounded-lg bg-gradient-to-br ${tool.gradient} ring-1 ring-inset ${tool.ring} shadow-sm transition-all duration-150 pointer-events-none`}
        />

        {/* Content */}
        <div className="relative h-full w-full flex flex-col items-center justify-center px-4 text-center gap-2">
          {/* Remove button */}
          <button
            className={`absolute -right-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white text-xs shadow-md transition-all duration-150 ${
              isActive
                ? "scale-100 opacity-100"
                : "scale-75 opacity-0 pointer-events-none"
            }`}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onClick={() => onRemove(tool.id)}
            aria-label="Remove tool"
          >
            ×
          </button>

          <p className="text-base font-semibold text-slate-900">{tool.name}</p>
          
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white shadow-sm"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onClick={(e) => {
                e.stopPropagation();
                onDetailsClick(tool.id);
              }}
            >
              Details
            </button>
          </div>
        </div>

        {/* Connection handle (top) */}
        <div
          className={`absolute left-1/2 -top-4 -translate-x-1/2 flex h-8 w-8 items-center justify-center transition-all duration-150 z-10 ${
            showHandles ? "opacity-100 scale-100" : "opacity-0 scale-75"
          }`}
          style={{ top: handles.output.y - tool.y - 16, pointerEvents: "auto" }}
          data-output
          data-input
          data-connector
          onPointerDown={onStartLinkingFromOutput({
            type: "tool",
            id: tool.id,
            port: 0,
          })}
          onPointerDownCapture={onStartLinkingFromOutput({
            type: "tool",
            id: tool.id,
            port: 0,
          })}
          onPointerEnter={onOutputEnter({ type: "tool", id: tool.id, port: 0 })}
          onPointerLeave={onOutputLeave({ type: "tool", id: tool.id, port: 0 })}
          onPointerMove={onMoveLinking}
          onPointerUp={() => onFinalizeLinking({ type: "tool", id: tool.id })}
        >
          <HandleDot />
        </div>
      </div>
    </div>
  );
}

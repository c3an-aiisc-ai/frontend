// src/components/canvas/PlanningBlockNode.tsx

import { useEffect, useRef, useState } from "react";
import HandleDot from "./HandleDot";
import { PLAN_CARD_DEFAULT_HEIGHT, PLAN_CARD_WIDTH } from "../../shared/constants";
import { iconPaths } from "../../shared/assets";
import type { PlanningBlock } from "../../shared/types/planning";

type Props = {
  plan: PlanningBlock;
  modeOverride?: "sequential" | "branch" | "aggregate" | null;
  pillLabel?: string;
  onEnterWorkflow: () => void;
  onMove: (x: number, y: number) => void;
  toWorldPoint: (
    clientX: number,
    clientY: number
  ) => { x: number; y: number } | null;
  linkingFrom?: boolean;
  linkingTarget?: boolean;
  onStartLink?: (anchor: { x: number; y: number }) => void;
  onCompleteLink?: () => void;
  onRemove?: () => void;
  onHover?: (hover: boolean) => void;
  onSize?: (size: { width: number; height: number }) => void;
  onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  onPointerMove?: React.PointerEventHandler<HTMLDivElement>;
  onPointerUp?: React.PointerEventHandler<HTMLDivElement>;
  showHandles?: boolean;
  isAgentPanelOpen?: boolean;
  agentPanelId?: string;
  onToggleAgentPanel?: (triggerElement: HTMLButtonElement) => void;
};

export default function PlanningBlockNode({
  plan,
  modeOverride,
  pillLabel = "Subplan",
  onEnterWorkflow,
  onMove,
  toWorldPoint,
  linkingFrom,
  linkingTarget,
  onStartLink,
  onCompleteLink,
  onRemove,
  onHover,
  onSize,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  showHandles = false,
  isAgentPanelOpen = false,
  agentPanelId,
  onToggleAgentPanel,
}: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const onSizeRef = useRef<Props["onSize"]>(onSize);
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: PLAN_CARD_WIDTH,
    height: PLAN_CARD_DEFAULT_HEIGHT,
  });
  const effectiveMode = modeOverride ?? null;
  const hasSubPlans = Boolean(plan.sub_plans?.plans?.length);

  // Touching props to satisfy usage and keep lints clean
  void onMove;
  void toWorldPoint;

  useEffect(() => {
    onSizeRef.current = onSize;
  }, [onSize]);

  useEffect(() => {
    if (!cardRef.current) return;
    const applySize = (width: number, height: number) => {
      setSize((prev) => {
        if (prev.width === width && prev.height === height) return prev;
        return { width, height };
      });
      onSizeRef.current?.({ width, height });
    };
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      applySize(width, height);
    });
    observer.observe(cardRef.current);
    const initialWidth = Math.round(cardRef.current.offsetWidth);
    const initialHeight = Math.round(cardRef.current.offsetHeight);
    applySize(initialWidth, initialHeight);
    return () => observer.disconnect();
  }, []);

  const outputAnchor = { x: plan.x + size.width, y: plan.y + size.height / 2 };

  return (
    <div
      className="absolute"
      style={{ left: plan.x, top: plan.y }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerEnter={() => onHover?.(true)}
      onPointerLeave={() => onHover?.(false)}
      data-block
    >
      <div
        ref={cardRef}
        className={`plan-card group flex min-h-[106px] flex-col ${
          linkingFrom || linkingTarget ? "plan-card-active" : ""
        }`}
      >
        {onRemove && (
          <button
            className={`absolute -right-3.5 -top-3.5 z-10 h-7 w-7 shrink-0 rounded-full bg-slate-900 text-white text-xs font-bold shadow transition-all duration-150 ${
              linkingFrom || linkingTarget ? "opacity-100 scale-100" : "opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            aria-label="Remove plan"
          >
            ×
          </button>
        )}

        <div className="flex items-start gap-3 pr-9">
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-sm font-semibold text-slate-900 leading-snug"
              title={plan.name}
            >
              {plan.name}
            </p>
            {effectiveMode && (
              <p className="text-[11px] text-slate-600 leading-snug">Mode: {effectiveMode}</p>
            )}
            <p
              className="mt-0.5 truncate text-[11px] text-slate-700 leading-snug"
              title={plan.query}
            >
              {plan.query || "(no query)"}
            </p>
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold uppercase text-amber-700 ring-1 ring-amber-100">
            {pillLabel}
          </span>

          <div className="flex items-center gap-2">
            {onToggleAgentPanel && (
              <button
                type="button"
                className={`plan-card-icon-btn ${isAgentPanelOpen ? "plan-card-icon-btn-active" : ""}`}
                data-interactive
                aria-label={isAgentPanelOpen ? `Hide agents for ${plan.name}` : `View agents for ${plan.name}`}
                aria-expanded={isAgentPanelOpen}
                aria-controls={agentPanelId}
                onPointerDown={(e) => {
                  e.stopPropagation();
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleAgentPanel(e.currentTarget);
                }}
              >
                <img
                  src={isAgentPanelOpen ? iconPaths.close : iconPaths.eye}
                  alt=""
                  className="h-3.5 w-3.5"
                  draggable={false}
                />
              </button>
            )}

            <button
              className="inline-flex max-w-full min-w-0 items-center justify-center gap-1 rounded-full bg-slate-900 px-3 py-0.5 text-center text-[9px] font-semibold uppercase tracking-wide text-white shadow-sm whitespace-normal break-words"
              data-interactive
              onPointerDown={(e) => {
                e.stopPropagation();
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                onEnterWorkflow();
              }}
            >
              {hasSubPlans ? "See Subplans" : "See Agents"}
            </button>
          </div>
        </div>
      </div>

      {/* Connection handles (must be direct siblings so they are always clickable) */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 -left-3.5 h-8 w-8 flex items-center justify-center transition-all duration-150 ${
          showHandles ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-75 pointer-events-none"
        }`}
        data-connector
        onPointerDownCapture={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onCompleteLink?.();
        }}
      >
        <HandleDot />
      </div>
      <div
        className={`absolute top-1/2 -translate-y-1/2 -right-3.5 h-8 w-8 flex items-center justify-center transition-all duration-150 ${
          showHandles ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-75 pointer-events-none"
        }`}
        data-connector
        onPointerDownCapture={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onStartLink?.(outputAnchor);
        }}
      >
        <HandleDot />
      </div>
    </div>
  );
}

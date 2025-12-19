// src/components/canvas/PlanningCanvas.tsx

import { useCallback, useEffect, useRef, useState } from "react";
import { usePanZoom } from "../../hooks";
import { Background } from "../";
import PlanningBlockNode from "./PlanningBlockNode";
import type { CSSProperties } from "react";
import type { PlanningBlock } from "../../types";
import type { AnchorPoint } from "../../types";

function buildConnectionPath(start: AnchorPoint, end: AnchorPoint) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.hypot(dx, dy);
  const curve = Math.max(40, Math.min(200, dist * 0.35));

  const startDir = start.dir ?? "right";
  // If the end has no direction (e.g., linking preview), aim the arrow in the drag direction.
  const majorAxis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
  const endDir =
    end.dir ??
    (majorAxis === "x" ? (dx >= 0 ? "right" : "left") : dy >= 0 ? "down" : "up");

  const c1x = start.x + (startDir === "right" ? curve : startDir === "left" ? -curve : 0);
  const c1y = start.y + (startDir === "down" ? curve : startDir === "up" ? -curve : 0);
  const c2x = end.x + (endDir === "left" ? curve : endDir === "right" ? -curve : 0);
  const c2y = end.y + (endDir === "up" ? curve : endDir === "down" ? -curve : 0);

  return `M ${start.x} ${start.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${end.x} ${end.y}`;
}


type Props = {
  onEnterWorkflow: (plan: PlanningBlock) => void;
  plans: PlanningBlock[];
  onDropPlanBlock?: (point: { x: number; y: number }) => void;
  onPlanMove?: (id: string, x: number, y: number) => void;
  connections?: { from: string; to: string }[];
  linking?: { from: string; current: { x: number; y: number } } | null;
  onStartLink?: (id: string, anchor: { x: number; y: number }) => void;
  onMoveLink?: (point: { x: number; y: number }) => void;
  onCompleteLink?: (id: string) => void;
  onCancelLink?: () => void;
  onRemovePlan?: (id: string) => void;
  theme?: "light" | "dark";
};

export default function PlanningCanvas({ onEnterWorkflow, plans, onDropPlanBlock, onPlanMove, connections = [], linking, onStartLink, onMoveLink, onCompleteLink, onCancelLink, onRemovePlan, theme = "dark" }: Props) {
  const [hoveredPlanId, setHoveredPlanId] = useState<string | null>(null);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [planSizes, setPlanSizes] = useState<Record<string, { width: number; height: number }>>({});
  const [draggingPlanId, setDraggingPlanId] = useState<string | null>(null);
  const planDragOffsetRef = useRef({ x: 0, y: 0 });
  const [localLink, setLocalLink] = useState<{ from: string; current: { x: number; y: number } } | null>(null);
  const activeLink = localLink ?? linking;

  const allowPan = useCallback((event: PointerEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("[data-block],[data-connector]")) return false;
    return true;
  }, []);

  const isPanDisabled = useCallback(() => Boolean(linking || localLink), [linking, localLink]);

  const { containerRef, transform } = usePanZoom({
    initial: { x: 0, y: 0, zoom: 1 },
    shouldAllowPan: allowPan,
    isPanDisabled,
  });

  // keep pan-zoom bounded to supplied plans
  useEffect(() => {
    void plans; // placeholder for future fit logic
  }, [plans]);

  const toWorldPoint = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    return { x: (localX - transform.x) / transform.zoom, y: (localY - transform.y) / transform.zoom };
  }, [containerRef, transform.x, transform.y, transform.zoom]);

  const lineStyle: CSSProperties = {
    stroke: "#38bdf8",
    strokeWidth: 2,
    fill: "none",
    filter: "drop-shadow(0 0 4px rgba(56,189,248,0.35))",
    strokeLinecap: "round",
  };

  const getSize = useCallback(
    (plan: PlanningBlock) => planSizes[plan.id] ?? { width: 240, height: 150 },
    [planSizes]
  );

  const getPlanMode = useCallback(
    (planId: string): "sequential" | "branch" | "aggregate" | null => {
      const inboundSources = new Set(connections.filter((c) => c.to === planId).map((c) => c.from));
      const outboundTargets = new Set(connections.filter((c) => c.from === planId).map((c) => c.to));
      if (inboundSources.size > 1) return "aggregate";
      if (outboundTargets.size > 1) return "branch";
      // Only label sequential on blocks that actually emit a step.
      if (outboundTargets.size > 0) return "sequential";
      return null;
    },
    [connections]
  );
  const getAnchors = (plan: PlanningBlock) => {
    const size = getSize(plan);
    return {
      output: { x: plan.x + size.width, y: plan.y + size.height / 2, dir: "right" as const },
      input: { x: plan.x, y: plan.y + size.height / 2, dir: "left" as const },
    };
  };

  const findPlanAtPoint = useCallback(
    (point: { x: number; y: number } | null) => {
      if (!point) return null;
      return (
        plans.find((plan) => {
          const size = getSize(plan);
          return (
            point.x >= plan.x &&
            point.x <= plan.x + size.width &&
            point.y >= plan.y &&
            point.y <= plan.y + size.height
          );
        }) ?? null
      );
    },
    [getSize, plans]
  );

  // ensure linking preview follows pointer even outside the canvas
  useEffect(() => {
    const active = localLink ?? linking;
    if (!active) return;
    const handleMove = (e: PointerEvent) => {
      const world = toWorldPoint(e.clientX, e.clientY);
      if (!world) return;
      setLocalLink((prev) => (prev ? { ...prev, current: world } : prev));
      onMoveLink?.(world);
    };
    const handleUp = (e: PointerEvent) => {
      const currentLink = localLink ?? linking;
      if (!currentLink) return;
      const world = toWorldPoint(e.clientX, e.clientY);
      const hitPlanId = hoveredPlanId ?? findPlanAtPoint(world)?.id;
      if (hitPlanId && currentLink.from !== hitPlanId) {
        onCompleteLink?.(hitPlanId);
      } else {
        onCancelLink?.();
      }
      setLocalLink(null);
    };
    window.addEventListener("pointermove", handleMove, { passive: true });
    window.addEventListener("pointerup", handleUp, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [findPlanAtPoint, hoveredPlanId, linking, localLink, onCancelLink, onCompleteLink, onMoveLink, toWorldPoint]);

  const startLinking = useCallback((fromId: string, anchor: AnchorPoint) => {
    setLocalLink({ from: fromId, current: { x: anchor.x, y: anchor.y } });
    onStartLink?.(fromId, { x: anchor.x, y: anchor.y });
  }, [onStartLink]);

  const completeLinking = useCallback((toId: string) => {
    setLocalLink(null);
    onCompleteLink?.(toId);
  }, [onCompleteLink]);

  const handlePlanPointerDown = (plan: PlanningBlock) => (e: React.PointerEvent<HTMLDivElement>) => {
    const isConnector = (e.target as HTMLElement | null)?.closest("[data-connector]");
    const isInteractive = (e.target as HTMLElement | null)?.closest("button, a, input, textarea, [role='button'], [data-interactive]");
    if (activeLink && !isConnector) {
      onCancelLink?.();
    }
    if (activeLink) return;
    if (isConnector) return;
    if (isInteractive) return; // allow buttons/links inside the card to work normally
    e.stopPropagation();
    e.preventDefault();

    setActivePlanId(plan.id);

    const world = toWorldPoint(e.clientX, e.clientY);
    if (!world) return;
    planDragOffsetRef.current = { x: world.x - plan.x, y: world.y - plan.y };
    setDraggingPlanId(plan.id);
    (e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId);
  };

  const handlePlanPointerMove = (plan: PlanningBlock) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingPlanId !== plan.id) return;
    if (linking || localLink) return;
    const world = toWorldPoint(e.clientX, e.clientY);
    if (!world) return;
    onPlanMove?.(plan.id, world.x - planDragOffsetRef.current.x, world.y - planDragOffsetRef.current.y);
  };

  const handlePlanPointerUp = (plan: PlanningBlock) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingPlanId !== plan.id) return;
    setDraggingPlanId(null);
    planDragOffsetRef.current = { x: 0, y: 0 };
    (e.currentTarget as HTMLElement | null)?.releasePointerCapture?.(e.pointerId);
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      onDragOver={(e) => {
        if (!onDropPlanBlock) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(e) => {
        if (!onDropPlanBlock) return;
        e.preventDefault();

        const raw = e.dataTransfer.getData("application/json");
        if (!raw) return;

        try {
          const payload = JSON.parse(raw) as { type?: string };
          if (payload.type !== "plan-block") return;
        } catch {
          return;
        }

        const world = toWorldPoint(e.clientX, e.clientY);
        if (!world) return;
        onDropPlanBlock(world);
      }}
      onPointerDown={(e) => {
        const target = e.target as HTMLElement | null;
        // Clicking empty canvas deactivates the current plan (matches workflow selection behavior).
        if (!target?.closest("[data-block],[data-connector]") && !activeLink) {
          setActivePlanId(null);
        }
      }}
      onPointerMove={(e) => {
        if (!activeLink) return;
        const world = toWorldPoint(e.clientX, e.clientY);
        if (world) {
          setLocalLink((prev) => (prev ? { ...prev, current: world } : prev));
          onMoveLink?.(world);
        }
      }}
      onPointerUp={(e) => {
        if (activeLink && hoveredPlanId && activeLink.from !== hoveredPlanId) {
          completeLinking(hoveredPlanId);
          return;
        }
        if (activeLink && e.pointerType === "mouse") {
          const world = toWorldPoint(e.clientX, e.clientY);
          const hitPlan = findPlanAtPoint(world);
          if (hitPlan && activeLink.from !== hitPlan.id) {
            completeLinking(hitPlan.id);
            return;
          }
          if (world) {
            setLocalLink((prev) => (prev ? { ...prev, current: world } : prev));
            onMoveLink?.(world);
          }
        }
        // do not cancel here; global pointerup handles cancel/finalize
      }}
    >
      <Background transform={transform} theme={theme} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
          transformOrigin: "0 0",
          pointerEvents: "none",
        }}
      >
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
          overflow="visible"
          style={{ zIndex: 5 }}
        >
          <defs>
            <marker id="plan-arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L9,3 z" fill="#38bdf8" />
            </marker>
            <marker id="plan-arrow-preview" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L9,3 z" fill="#3b82f6" />
            </marker>
          </defs>
          {connections.map((conn) => {
            const from = plans.find((p) => p.id === conn.from);
            const to = plans.find((p) => p.id === conn.to);
            if (!from || !to) return null;
            const a = getAnchors(from).output;
            const b = getAnchors(to).input;
            return (
              <path
                key={`${conn.from}->${conn.to}`}
                d={buildConnectionPath(a, b)}
                style={lineStyle}
                markerEnd="url(#plan-arrow)"
              />
            );
          })}

          {activeLink && (() => {
            const from = plans.find((p) => p.id === activeLink.from);
            if (!from) return null;
            const a = getAnchors(from).output;
            const b = activeLink.current;
            const end = { x: b.x, y: b.y, dir: "left" as const };
            return (
              <path
                d={buildConnectionPath(a, end)}
                style={{ ...lineStyle, strokeDasharray: "6 6" }}
                markerEnd="url(#plan-arrow-preview)"
              />
            );
          })()}
        </svg>

        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "auto",
          }}
          onPointerDown={(e) => {
            const target = e.target as HTMLElement | null;
            // Clicking empty space deselects the active plan (matches workflow selection).
            if (!activeLink && !target?.closest("[data-block],[data-connector]")) {
              setActivePlanId(null);
            }
          }}
        >
          {plans.map((plan) => (
            <PlanningBlockNode
              key={plan.id}
              plan={plan}
              isActive={activePlanId === plan.id}
              modeOverride={getPlanMode(plan.id)}
              onEnterWorkflow={() => onEnterWorkflow(plan)}
              toWorldPoint={toWorldPoint}
              linkingFrom={activeLink?.from === plan.id}
              linkingTarget={Boolean(activeLink && activeLink.from !== plan.id)}
              onStartLink={(anchor) => startLinking(plan.id, anchor as AnchorPoint)}
              onCompleteLink={() => completeLinking(plan.id)}
              onRemove={() => onRemovePlan?.(plan.id)}
              onHover={(hover) => {
                setHoveredPlanId((prev) => {
                  if (hover) return plan.id;
                  return prev === plan.id ? null : prev;
                });
              }}
              onSize={(size) => {
                setPlanSizes((prev) => {
                  const existing = prev[plan.id];
                  if (existing && existing.width === size.width && existing.height === size.height) return prev;
                  return { ...prev, [plan.id]: size };
                });
              }}
              onPointerDown={handlePlanPointerDown(plan)}
              onPointerMove={(e) => {
                handlePlanPointerMove(plan)(e);
              }}
              onPointerUp={(e) => {
                handlePlanPointerUp(plan)(e);
              }}
              showHandles={
                hoveredPlanId === plan.id ||
                draggingPlanId === plan.id ||
                activeLink?.from === plan.id ||
                Boolean(activeLink && activeLink.from !== plan.id)
              }
              onMove={(x, y) => {
                onPlanMove?.(plan.id, x, y);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

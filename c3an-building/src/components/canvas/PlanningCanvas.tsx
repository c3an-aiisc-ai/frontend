// src/components/canvas/PlanningCanvas.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePanZoom } from "../../hooks";
import { canvasConfig } from "../../config";
import { PLAN_CARD_DEFAULT_HEIGHT, PLAN_CARD_WIDTH } from "../../shared/constants";
import { Background } from "../";
import { PlanningBlockNode } from "./index";
import ConnectionLines from "./ConnectionLines";
import SubplanAgentsPanel from "./SubplanAgentsPanel";
import type { AnchorPoint, Connection, LinkingState } from "../../shared/types";
import type { PlanTemplate, PlanningBlock } from "../../shared/types/planning";

type PlanLinkState = { from: string; current: { x: number; y: number } } | null;
type PlanDropPayload =
  | { type: "plan-block" }
  | { type: "plan-template"; template: PlanTemplate };
type AgentPanelState = {
  planId: string;
  anchorRect: DOMRect;
  triggerElement: HTMLButtonElement | null;
} | null;

type Props = {
  onEnterWorkflow: (plan: PlanningBlock) => void;
  onSelectPlan?: (plan: PlanningBlock) => void;
  plans: PlanningBlock[];
  planPillLabel?: string;
  onDropPlanBlock?: (point: { x: number; y: number }, payload?: PlanDropPayload) => void;
  onPlanMove?: (id: string, x: number, y: number) => void;
  connections?: { from: string; to: string }[];
  linking?: PlanLinkState;
  onStartLink?: (id: string, anchor: { x: number; y: number }) => void;
  onMoveLink?: (point: { x: number; y: number }) => void;
  onCompleteLink?: (id: string) => void;
  onCancelLink?: () => void;
  onRemovePlan?: (id: string) => void;
  theme?: "light" | "dark";
};

export default function PlanningCanvas({
  onEnterWorkflow,
  onSelectPlan,
  plans,
  planPillLabel,
  onDropPlanBlock,
  onPlanMove,
  connections = [],
  linking,
  onStartLink,
  onMoveLink,
  onCompleteLink,
  onCancelLink,
  onRemovePlan,
  theme = "dark",
}: Props) {
  const [hoveredPlanId, setHoveredPlanId] = useState<string | null>(null);
  const [planSizes, setPlanSizes] = useState<Record<string, { width: number; height: number }>>({});
  const [draggingPlanId, setDraggingPlanId] = useState<string | null>(null);
  const [openAgentPanel, setOpenAgentPanel] = useState<AgentPanelState>(null);
  const hasAutoFitRef = useRef(false);
  const planDragOffsetRef = useRef({ x: 0, y: 0 });
  const [localLink, setLocalLink] = useState<PlanLinkState>(null);
  const activeLink = localLink ?? linking;

  const getAgentPanelId = useCallback(
    (planId: string) => `subplan-agents-panel-${planId.replace(/[^a-zA-Z0-9_-]+/g, "-")}`,
    []
  );

  const getEventElement = useCallback((target: EventTarget | null) => {
    if (target instanceof Element) return target;
    if (target && "parentElement" in target) return target.parentElement as Element | null;
    return null;
  }, []);

  const allowPan = useCallback((event: PointerEvent) => {
    const target = getEventElement(event.target);
    if (target?.closest("[data-block],[data-connector]")) return false;
    return true;
  }, [getEventElement]);

  const isPanDisabled = useCallback(() => Boolean(linking || localLink), [linking, localLink]);

  const { containerRef, containerEl, transform, setTransform, getTransform } = usePanZoom({
    initial: { x: 0, y: 0, zoom: 1 },
    shouldAllowPan: allowPan,
    isPanDisabled,
  });

  const toWorldPoint = useCallback((clientX: number, clientY: number) => {
    const el = containerEl;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    return { x: (localX - transform.x) / transform.zoom, y: (localY - transform.y) / transform.zoom };
  }, [containerEl, transform.x, transform.y, transform.zoom]);

  const getSize = useCallback(
    (plan: PlanningBlock) => planSizes[plan.id] ?? { width: PLAN_CARD_WIDTH, height: PLAN_CARD_DEFAULT_HEIGHT },
    [planSizes]
  );

  useEffect(() => {
    if (!containerEl || plans.length === 0 || hasAutoFitRef.current) return;

    const frame = window.requestAnimationFrame(() => {
      const rect = containerEl.getBoundingClientRect();
      const viewportWidth = rect.width || containerEl.clientWidth || window.innerWidth;
      const viewportHeight = rect.height || containerEl.clientHeight || window.innerHeight;
      if (!viewportWidth || !viewportHeight) return;

      const horizontalPadding = 96;
      const verticalPadding = 88;
      const bounds = plans.reduce(
        (acc, plan) => {
          const size = getSize(plan);
          return {
            minX: Math.min(acc.minX, plan.x),
            minY: Math.min(acc.minY, plan.y),
            maxX: Math.max(acc.maxX, plan.x + size.width),
            maxY: Math.max(acc.maxY, plan.y + size.height),
          };
        },
        {
          minX: Number.POSITIVE_INFINITY,
          minY: Number.POSITIVE_INFINITY,
          maxX: Number.NEGATIVE_INFINITY,
          maxY: Number.NEGATIVE_INFINITY,
        }
      );

      const contentWidth = Math.max(1, bounds.maxX - bounds.minX);
      const contentHeight = Math.max(1, bounds.maxY - bounds.minY);
      const zoomX = Math.max(0.1, (viewportWidth - horizontalPadding * 2) / contentWidth);
      const zoomY = Math.max(0.1, (viewportHeight - verticalPadding * 2) / contentHeight);
      const zoom = Math.min(1, Math.max(canvasConfig.zoom.min, Math.min(zoomX, zoomY)));
      const x = (viewportWidth - contentWidth * zoom) / 2 - bounds.minX * zoom;
      const y = (viewportHeight - contentHeight * zoom) / 2 - bounds.minY * zoom;

      hasAutoFitRef.current = true;
      setTransform({ x, y, zoom });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [containerEl, getSize, plans, setTransform]);

  const toWorldPointDuringDrag = useCallback(
    (clientX: number, clientY: number, plan: PlanningBlock) => {
      const el = containerEl;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const margin = 140;
      const maxSpeed = 22;
      const base = getTransform();
      const size = getSize(plan);
      const leftEdge = base.x + plan.x * base.zoom;
      const rightEdge = base.x + (plan.x + size.width) * base.zoom;
      const topEdge = base.y + plan.y * base.zoom;
      const bottomEdge = base.y + (plan.y + size.height) * base.zoom;

      let dx = 0;
      let dy = 0;
      const overflowRight = rightEdge - (rect.right - margin);
      const overflowLeft = (rect.left + margin) - leftEdge;
      const overflowBottom = bottomEdge - (rect.bottom - margin);
      const overflowTop = (rect.top + margin) - topEdge;

      if (overflowRight > 0) {
        dx = -Math.min(maxSpeed, overflowRight);
      } else if (overflowLeft > 0) {
        dx = Math.min(maxSpeed, overflowLeft);
      }

      if (overflowBottom > 0) {
        dy = -Math.min(maxSpeed, overflowBottom);
      } else if (overflowTop > 0) {
        dy = Math.min(maxSpeed, overflowTop);
      }

      const nextX = base.x + dx;
      const nextY = base.y + dy;
      if (dx || dy) {
        setTransform({ x: nextX, y: nextY, zoom: base.zoom });
      }

      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      return {
        x: (localX - nextX) / base.zoom,
        y: (localY - nextY) / base.zoom,
      };
    },
    [containerEl, getSize, getTransform, setTransform]
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
  const getAnchors = useCallback(
    (plan: PlanningBlock) => {
      const size = getSize(plan);
      return {
        output: { x: plan.x + size.width, y: plan.y + size.height / 2, dir: "right" as const },
        input: { x: plan.x, y: plan.y + size.height / 2, dir: "left" as const },
      };
    },
    [getSize]
  );

  const benchConnections = useMemo<Connection[]>(
    () =>
      connections.map((conn, index) => ({
        id: `plan-conn-${index}-${conn.from}-${conn.to}`,
        from: { type: "block", id: conn.from, port: 0 },
        to: { type: "block", id: conn.to, inputIndex: 0 },
      })),
    [connections],
  );

  const getOutputAnchor = useCallback(
    (source: Connection["from"]) => {
      if (source.type !== "block") return null;
      const plan = plans.find((item) => item.id === source.id);
      if (!plan) return null;
      return getAnchors(plan).output;
    },
    [getAnchors, plans],
  );

  const getInputAnchor = useCallback(
    (target: Connection["to"]) => {
      if (target.type !== "block") return null;
      const plan = plans.find((item) => item.id === target.id);
      if (!plan) return null;
      return getAnchors(plan).input;
    },
    [getAnchors, plans],
  );

  const linkingState: LinkingState = activeLink
    ? {
        origin: "output",
        from: { type: "block", id: activeLink.from, port: 0 },
        current: activeLink.current,
      }
    : null;

  const findPlanAtPoint = useCallback((point: { x: number; y: number } | null) => {
    if (!point) return null;
    return plans.find((plan) => {
      const size = getSize(plan);
      return (
        point.x >= plan.x &&
        point.x <= plan.x + size.width &&
        point.y >= plan.y &&
        point.y <= plan.y + size.height
      );
    }) ?? null;
  }, [getSize, plans]);

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

  const handleToggleAgentPanel = useCallback((plan: PlanningBlock, triggerElement: HTMLButtonElement) => {
    setOpenAgentPanel((prev) => {
      if (prev?.planId === plan.id) return null;
      return {
        planId: plan.id,
        anchorRect: triggerElement.getBoundingClientRect(),
        triggerElement,
      };
    });
  }, []);

  const handleCloseAgentPanel = useCallback(() => {
    setOpenAgentPanel((prev) => {
      prev?.triggerElement?.focus();
      return null;
    });
  }, []);

  const handlePlanPointerDown = (plan: PlanningBlock) => (e: React.PointerEvent<HTMLDivElement>) => {
    const target = getEventElement(e.target);
    const isConnector = target?.closest("[data-connector]");
    const isInteractive = target?.closest("button, a, input, textarea, [role='button'], [data-interactive]");
    if (activeLink && !isConnector) {
      onCancelLink?.();
    }
    if (activeLink) return;
    if (isConnector) return;
    if (isInteractive) return; // allow buttons/links inside the card to work normally
    e.stopPropagation();
    e.preventDefault();
    const world = toWorldPoint(e.clientX, e.clientY);
    if (!world) return;
    planDragOffsetRef.current = { x: world.x - plan.x, y: world.y - plan.y };
    setDraggingPlanId(plan.id);
    (e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId);
  };

  const handlePlanPointerMove = (plan: PlanningBlock) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingPlanId !== plan.id) return;
    if (linking || localLink) return;
    const world = toWorldPointDuringDrag(e.clientX, e.clientY, plan);
    if (!world) return;
    onPlanMove?.(plan.id, world.x - planDragOffsetRef.current.x, world.y - planDragOffsetRef.current.y);
  };

  const handlePlanPointerUp = (plan: PlanningBlock) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingPlanId !== plan.id) return;
    setDraggingPlanId(null);
    planDragOffsetRef.current = { x: 0, y: 0 };
    (e.currentTarget as HTMLElement | null)?.releasePointerCapture?.(e.pointerId);
    const target = getEventElement(e.target);
    const isConnector = target?.closest("[data-connector]");
    const isInteractive = target?.closest("button, a, input, textarea, [role='button'], [data-interactive]");
    if (isConnector || isInteractive) return;
    onSelectPlan?.(plan);
  };

  const selectedAgentPanelPlan = openAgentPanel
    ? plans.find((plan) => plan.id === openAgentPanel.planId) ?? null
    : null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      onDragOver={(event) => {
        if (!onDropPlanBlock) return;
        event.preventDefault();
      }}
      onDrop={(event) => {
        if (!onDropPlanBlock) return;
        event.preventDefault();
        const raw = event.dataTransfer.getData("application/json");
        let payload: PlanDropPayload | null = null;
        try {
          payload = raw ? (JSON.parse(raw) as PlanDropPayload) : null;
        } catch {
          payload = null;
        }
        const world = toWorldPoint(event.clientX, event.clientY);
        if (!world) return;
        if (payload) {
          onDropPlanBlock(world, payload);
          return;
        }
        onDropPlanBlock(world);
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
        data-testid="plan-world-layer"
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
          transformOrigin: "0 0",
          pointerEvents: "none",
        }}
      >
        <ConnectionLines
          connections={benchConnections}
          linking={linkingState}
          selected={null}
          getOutputAnchor={getOutputAnchor}
          getInputAnchor={getInputAnchor}
          onConnectionPointerDown={() => () => {}}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "auto",
          }}
        >
          {plans.map((plan) => (
            <PlanningBlockNode
              key={plan.id}
              plan={plan}
              modeOverride={getPlanMode(plan.id)}
              pillLabel={planPillLabel}
              onEnterWorkflow={() => onEnterWorkflow(plan)}
              isAgentPanelOpen={openAgentPanel?.planId === plan.id}
              agentPanelId={getAgentPanelId(plan.id)}
              onToggleAgentPanel={(triggerElement) => handleToggleAgentPanel(plan, triggerElement)}
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
                  const current = prev[plan.id];
                  if (current && current.width === size.width && current.height === size.height) return prev;
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

          {selectedAgentPanelPlan && openAgentPanel && (
            <SubplanAgentsPanel
              key={selectedAgentPanelPlan.id}
              panelId={getAgentPanelId(selectedAgentPanelPlan.id)}
              plan={selectedAgentPanelPlan}
              anchorRect={openAgentPanel.anchorRect}
              triggerElement={openAgentPanel.triggerElement}
              onClose={handleCloseAgentPanel}
            />
          )}
        </div>
      </div>
    </div>
  );
}

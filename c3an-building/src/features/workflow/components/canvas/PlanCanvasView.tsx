import PlanningCanvas from "./PlanningCanvas";
import type { PlanningBlock, Theme } from "../../../../shared/types";

type Props = {
  theme: Theme;
  plans: PlanningBlock[];
  connections: Array<{ from: string; to: string }>;
  planLinkFromRef: React.MutableRefObject<string | null>;
  setPlans: React.Dispatch<React.SetStateAction<PlanningBlock[]>>;
  setPlanConnections: React.Dispatch<React.SetStateAction<Array<{ from: string; to: string }>>>;
  setActivePlanId: React.Dispatch<React.SetStateAction<string | null>>;
  activePlanId: string | null;
  nextPlanIdRef: React.MutableRefObject<number>;
  onEnterWorkflow: (plan: PlanningBlock) => void;
};

export default function PlanCanvasView({
  theme,
  plans,
  connections,
  planLinkFromRef,
  setPlans,
  setPlanConnections,
  setActivePlanId,
  activePlanId,
  nextPlanIdRef,
  onEnterWorkflow,
}: Props) {
  return (
    <PlanningCanvas
      theme={theme}
      plans={plans}
      connections={connections}
      onStartLink={(fromId) => {
        planLinkFromRef.current = fromId;
      }}
      onCompleteLink={(toId) => {
        const fromId = planLinkFromRef.current;
        planLinkFromRef.current = null;
        if (!fromId || fromId === toId) return;
        setPlanConnections((prev) => {
          if (prev.some((c) => c.from === fromId && c.to === toId)) return prev;
          return [...prev, { from: fromId, to: toId }];
        });
      }}
      onCancelLink={() => {
        planLinkFromRef.current = null;
      }}
      onPlanMove={(id, x, y) => {
        setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, x, y } : p)));
      }}
      onRemovePlan={(id) => {
        setPlans((prev) => prev.filter((p) => p.id !== id));
        setPlanConnections((prev) => prev.filter((c) => c.from !== id && c.to !== id));
        if (planLinkFromRef.current === id) planLinkFromRef.current = null;
        if (activePlanId === id) setActivePlanId(null);
      }}
      onDropPlanBlock={(point, payload) => {
        const id = `plan-${nextPlanIdRef.current++}`;
        const template = payload?.type === "plan-template" ? payload.template : null;
        setPlans((prev) => [
          ...prev,
          {
            id,
            x: point.x,
            y: point.y,
            name: template?.name ?? "Plan",
            query: template?.query ?? "",
            triples: template?.triples ?? [],
          },
        ]);
      }}
      onEnterWorkflow={onEnterWorkflow}
    />
  );
}

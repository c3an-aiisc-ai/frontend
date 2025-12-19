import { useCallback } from "react";
import type { PlanningBlock } from "../../../shared/types";

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

export function useWorkflowReset(args: {
  reset: () => void;
  resetWorkspace: () => void;
  setPlans: SetState<PlanningBlock[]>;
  setPlanCanvasKey: SetState<number>;
  setActivePlanId: SetState<string | null>;
  agentPlanTemplateRef: React.MutableRefObject<unknown | null>;
  setSelectedEvals: SetState<string[]>;
}) {
  const {
    reset,
    resetWorkspace,
    setPlans,
    setPlanCanvasKey,
    setActivePlanId,
    agentPlanTemplateRef,
    setSelectedEvals,
  } = args;

  const handleReset = useCallback(() => {
    reset();
    resetWorkspace();

    setPlans([]);
    setPlanCanvasKey((k) => k + 1);
    setActivePlanId(null);

    agentPlanTemplateRef.current = null;
    setSelectedEvals([]);
  }, [agentPlanTemplateRef, reset, resetWorkspace, setActivePlanId, setPlanCanvasKey, setPlans, setSelectedEvals]);

  return { handleReset };
}

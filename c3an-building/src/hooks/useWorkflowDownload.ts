import { useCallback } from "react";
import type { MutableRefObject } from "react";
import { downloadWorkflow } from "../shared/utils";
import type { PlanningBlock, ViewMode } from "../shared/types";
import {
  buildPlanHierarchyDownload,
  buildPlanSubPlanBundle,
  buildWorkflowTriplesFromWorkflow,
} from "../features/workflow/utils/planDownload";

type SnapshotBuilder = () => PlanningBlock["workflow"];

export function useWorkflowDownload(args: {
  viewMode: ViewMode;
  activePlanId: string | null;
  plans: PlanningBlock[];
  planConnections: Array<{ from: string; to: string }>;
  buildPlanWorkflowSnapshot: SnapshotBuilder;
  planStackDepth?: number;
  agentPlanTemplateRef?: MutableRefObject<unknown | null>;
}) {
  const {
    viewMode,
    plans,
    planConnections,
    buildPlanWorkflowSnapshot,
    planStackDepth = 0,
  } = args;
  const downloadLabel = viewMode === "agent" ? "Download Triples" : "Download Plan";

  const handleDownload = useCallback(() => {
    if (viewMode === "plan") {
      if (planStackDepth > 0) {
        const payload = buildPlanSubPlanBundle(plans);
        downloadWorkflow(payload, "plans.json");
        return;
      }
      const rootPlan = plans.length === 1 ? plans[0] : null;
      const nestedPlans = rootPlan?.sub_plans?.plans ?? [];
      if (nestedPlans.length > 0) {
        const payload = buildPlanHierarchyDownload({
          plans: nestedPlans,
          connections: rootPlan?.sub_plans?.connections ?? [],
          taskId: rootPlan?.task_id ?? rootPlan?.id,
          mainTask: rootPlan?.main_task ?? rootPlan?.name ?? rootPlan?.query,
        });
        downloadWorkflow(payload, "plans.json");
        return;
      }
      const isMainPlan = plans.length > 1 || planConnections.length > 0;
      const payload = isMainPlan
        ? buildPlanHierarchyDownload({
            plans,
            connections: planConnections,
          })
        : buildPlanSubPlanBundle(plans);
      downloadWorkflow(payload, "plans.json");
      return;
    }

    const workflowSnapshot = buildPlanWorkflowSnapshot();
    const triples = buildWorkflowTriplesFromWorkflow({
      blocks: workflowSnapshot.blocks ?? [],
      connections: workflowSnapshot.connections ?? [],
    });
    downloadWorkflow({ triples }, "triples.json");
  }, [
    buildPlanWorkflowSnapshot,
    planStackDepth,
    planConnections,
    plans,
    viewMode,
  ]);

  return { downloadLabel, handleDownload };
}

import { useCallback } from "react";
import type { MutableRefObject } from "react";
import { downloadWorkflow } from "../shared/utils";
import type { PlanningBlock, ViewMode } from "../shared/types";
import {
  buildPlanSubPlanBundle,
  buildWorkflowTriplesFromWorkflow,
  buildPlanDownloadEntry,
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
        // When a root plan contains sub_plans, download the root plan itself
        // in the same schema we accept on upload.
        // IMPORTANT: we intentionally DO NOT serialize sub_plans here; the user expects
        // the original plan JSON shape {task_id, main_task, sub_tasks, triples}.
        const payload = buildPlanDownloadEntry(rootPlan!);
        downloadWorkflow(payload, "plans.json");
        return;
      }
      // Root plan view: download the plan itself (task_id/main_task/sub_tasks/triples).
      // Subplan view (planStackDepth > 0) is handled above via buildPlanSubPlanBundle.
      const single = plans.length === 1 ? plans[0] : null;
      if (single) {
        downloadWorkflow(buildPlanDownloadEntry(single), "plans.json");
        return;
      }

      // Fallback: if somehow multiple plans are visible at the root without a container plan,
      // export them as a sub_plans bundle.
      downloadWorkflow(buildPlanSubPlanBundle(plans), "plans.json");
      return;
    }

    const workflowSnapshot = buildPlanWorkflowSnapshot();
    if (!workflowSnapshot) {
      downloadWorkflow({ triples: [] }, "triples.json");
      return;
    }
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

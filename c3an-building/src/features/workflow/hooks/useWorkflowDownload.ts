import { useCallback } from "react";
import { downloadWorkflow } from "../../../shared/utils";
import type { AgentRegistryEntry, PlanningBlock, ViewMode } from "../../../shared/types";
import { buildPlanDownloadBundle } from "../utils/planDownload";

type SnapshotBuilder = () => PlanningBlock["workflow"];

export function useWorkflowDownload(args: {
  viewMode: ViewMode;
  activePlanId: string | null;
  plans: PlanningBlock[];
  availableAgents: AgentRegistryEntry[];
  buildPlanWorkflowSnapshot: SnapshotBuilder;
}) {
  const { viewMode, activePlanId, plans, availableAgents, buildPlanWorkflowSnapshot } = args;
  const downloadLabel = viewMode === "plan" ? "Download Plan" : "Download Workflow";

  const handleDownload = useCallback(() => {
    if (viewMode === "plan") {
      const activeSnapshot = activePlanId ? buildPlanWorkflowSnapshot() : null;
      const bundle = buildPlanDownloadBundle({
        plans,
        activePlanId,
        activeSnapshot,
        availableAgents,
      });
      downloadWorkflow(bundle, "plans.json");
      return;
    }

    const workflowSnapshot = buildPlanWorkflowSnapshot();
    const filename = activePlanId ? `${activePlanId}-workflow.json` : "workflow.json";
    downloadWorkflow(workflowSnapshot, filename);
  }, [
    activePlanId,
    availableAgents,
    buildPlanWorkflowSnapshot,
    plans,
    viewMode,
  ]);

  return { downloadLabel, handleDownload };
}

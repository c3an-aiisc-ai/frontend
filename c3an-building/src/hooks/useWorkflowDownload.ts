import { useCallback } from "react";
import type { MutableRefObject } from "react";
import { downloadWorkflow, isRecord } from "../shared/utils";
import type { PlanningBlock, ViewMode } from "../shared/types";
import {
  buildPlanDownloadBundle,
  buildPlanDownloadEntry,
  buildPlanDownloadEntryFromWorkflow,
} from "../features/workflow/utils/planDownload";
import { parsePlanningJSON } from "../shared/planning/parsePlan";

type SnapshotBuilder = () => PlanningBlock["workflow"];

export function useWorkflowDownload(args: {
  viewMode: ViewMode;
  activePlanId: string | null;
  plans: PlanningBlock[];
  buildPlanWorkflowSnapshot: SnapshotBuilder;
  agentPlanTemplateRef?: MutableRefObject<unknown | null>;
}) {
  const {
    viewMode,
    activePlanId,
    plans,
    buildPlanWorkflowSnapshot,
    agentPlanTemplateRef,
  } = args;
  const isPlanTemplate = (
    value: unknown
  ): value is Record<string, unknown> & { triples: unknown[] } =>
    isRecord(value) && Array.isArray(value.triples);
  const planTemplate = isPlanTemplate(agentPlanTemplateRef?.current)
    ? agentPlanTemplateRef?.current
    : null;
  const hasPlanTemplate = viewMode === "agent" && Boolean(planTemplate);
  const downloadLabel = "Download Plan";

  const handleDownload = useCallback(() => {
    if (viewMode === "plan") {
      const bundle = buildPlanDownloadBundle(plans);
      const payload = bundle.plans.length === 1 ? bundle.plans[0] : bundle;
      downloadWorkflow(payload, "plans.json");
      return;
    }

    if (hasPlanTemplate && planTemplate) {
      try {
        const parsed = parsePlanningJSON(planTemplate);
        const entry = buildPlanDownloadEntry(parsed);
        downloadWorkflow(entry, `${entry.task_id}.json`);
        return;
      } catch {
        // Fall back to workflow snapshot if the template is invalid.
      }
    }

    const workflowSnapshot = buildPlanWorkflowSnapshot();
    const entry = buildPlanDownloadEntryFromWorkflow({
      blocks: workflowSnapshot.blocks ?? [],
      connections: workflowSnapshot.connections ?? [],
      taskId: activePlanId,
      mainTask: activePlanId,
    });
    downloadWorkflow(entry, `${entry.task_id}.json`);
  }, [
    activePlanId,
    buildPlanWorkflowSnapshot,
    hasPlanTemplate,
    planTemplate,
    plans,
    viewMode,
  ]);

  return { downloadLabel, handleDownload };
}

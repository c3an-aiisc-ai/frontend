import { useMemo } from "react";
import WorkflowEditorPage from "../workflow/WorkflowEditorPage";
import type { Theme } from "../../shared/types";
import { buildSmartPilotRunAction } from "./smartPilotRunAction";
import {
  SMART_PILOT_WORKFLOW_WORKSPACE_ID,
  buildSmartPilotWorkflowBuilderPayload,
} from "./smartPilotWorkflowBuilder";

export default function SmartPilotWorkflowPage({ theme }: { theme: Theme }) {
  const initialPlanPayload = useMemo(() => buildSmartPilotWorkflowBuilderPayload(), []);
  const runAction = useMemo(() => buildSmartPilotRunAction(), []);

  return (
    <WorkflowEditorPage
      theme={theme}
      workspaceId={SMART_PILOT_WORKFLOW_WORKSPACE_ID}
      initialPlanPayload={initialPlanPayload}
      pendingPlanStorageKey={null}
      runAction={runAction}
    />
  );
}

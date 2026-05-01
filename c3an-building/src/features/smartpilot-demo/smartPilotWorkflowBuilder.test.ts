import { describe, expect, it } from "vitest";
import {
  buildSmartPilotWorkflowBuilderPayload,
  buildSmartPilotWorkflowBuilderPlan,
} from "./smartPilotWorkflowBuilder";

describe("buildSmartPilotWorkflowBuilderPlan", () => {
  it("draws the SmartPilot orchestration as clickable registry-backed subplans", () => {
    const plan = buildSmartPilotWorkflowBuilderPlan();

    expect(plan.task_id).toBe("smartpilot-manufacturing-demo");
    expect(plan.sub_plans.plans.map((subplan) => subplan.task_id)).toEqual(["SP-1", "SP-2", "SP-3", "SP-4"]);
    expect(plan.sub_plans.connections).toEqual([
      { from: "SP-1", to: "SP-4" },
      { from: "SP-2", to: "SP-4" },
      { from: "SP-3", to: "SP-4" },
    ]);

    const predictx = plan.sub_plans.plans.find((subplan) => subplan.task_id === "SP-1");
    expect(predictx?.name).toBe("PredictX");
    expect(predictx?.workflow?.blocks.map((block) => block.agentId)).toEqual([
      "timeseries-agent",
      "vision-agent",
      "fusion-agent",
      "anomaly-prediction-agent",
    ]);
    expect(predictx?.workflow?.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "PredictX sensor features",
        "PredictX image probabilities",
        "LSTM Model",
        "CNN Model",
        "Knowledge adjustment",
      ])
    );
    expect(
      predictx?.workflow?.connections.some(
        (connection) => connection.from.type === "block" && connection.from.id === "block-3" && connection.to.id === "block-4"
      )
    ).toBe(true);

    const foresight = plan.sub_plans.plans.find((subplan) => subplan.task_id === "SP-2");
    expect(foresight?.workflow?.blocks.map((block) => block.agentId)).toEqual(["foresight-agent"]);
    expect(foresight?.workflow?.tools.map((tool) => tool.name)).toContain("ForeSight production CSV");

    const infoguide = plan.sub_plans.plans.find((subplan) => subplan.task_id === "SP-3");
    expect(infoguide?.workflow?.blocks.map((block) => block.agentId)).toContain("qa-agent");
    expect(infoguide?.workflow?.tools.map((tool) => tool.name)).toContain("InfoGuide Q&A dataset");
  });

  it("builds a plan-mode payload that can be injected into a namespaced Workflow Builder", () => {
    const payload = buildSmartPilotWorkflowBuilderPayload() as {
      mode?: string;
      plans?: Array<ReturnType<typeof buildSmartPilotWorkflowBuilderPlan>>;
    };

    expect(payload.mode).toBe("plan");
    expect(payload.plans?.[0]?.task_id).toBe("smartpilot-manufacturing-demo");
    expect(payload.plans?.[0]?.sub_plans.plans[0]?.workflow?.blocks.map((block) => block.agentId)).toEqual([
      "timeseries-agent",
      "vision-agent",
      "fusion-agent",
      "anomaly-prediction-agent",
    ]);
  });
});

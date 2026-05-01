import {
  TOOL_PORT_OFFSET,
  buildRegistryWorkflowDemoPlan,
  type RegistryWorkflowPlanDefinition,
  type WorkflowDemoPlanPayload,
} from "../workflow/workflowDemoBuilder";

export const SMART_PILOT_WORKFLOW_TASK_ID = "smartpilot-manufacturing-demo";
export const SMART_PILOT_WORKFLOW_WORKSPACE_ID = "smartpilot-workflow-demo";
export const SMART_PILOT_SUBPLAN_IDS = ["SP-1", "SP-2", "SP-3", "SP-4"] as const;

export const SMART_PILOT_DATA_PATHS = {
  predictxFeatures: "Data/Primary/PredictX/fusion_features_sample.csv",
  foresightProduction: "Data/Primary/Foresight/foresight_test_production.csv",
  foresightProcess: "Data/Primary/Foresight/foresight_test_process.csv",
  infoguideQa: "Data/Primary/InfoGuide/LLM_FT_dataset.csv",
} as const;

const smartPilotWorkflowDefinition: RegistryWorkflowPlanDefinition = {
  task_id: SMART_PILOT_WORKFLOW_TASK_ID,
  main_task: "SmartPilot multiagent copilot for adaptive and intelligent manufacturing.",
  sub_tasks: [
    {
      sub_task_id: "SP-1",
      name: "PredictX anomaly prediction",
      description: "Open this subplan to inspect TimeSeriesAnalyzer, VisionInspector, FusionModel, and AnomalyPredictor.",
      Tools: ["LSTM Model", "CNN Model"],
    },
    {
      sub_task_id: "SP-2",
      name: "ForeSight production forecasting",
      description: "Open this subplan to inspect ForeSight with production/process data and LSTM forecasting tools.",
      Tools: ["LSTM Model"],
    },
    {
      sub_task_id: "SP-3",
      name: "InfoGuide domain Q&A",
      description: "Open this subplan to inspect retrieval and Q&A orchestration over the InfoGuide dataset.",
      Tools: ["Embedding Model", "LLM"],
    },
    {
      sub_task_id: "SP-4",
      name: "SmartPilot response synthesis",
      description: "Aggregate anomaly, forecast, and Q&A outputs into a connected copilot response.",
      Tools: ["LLM"],
    },
  ],
  triples: [
    { from: "SP-1", op: "agg", to: "SP-4" },
    { from: "SP-2", op: "agg", to: "SP-4" },
    { from: "SP-3", op: "agg", to: "SP-4" },
  ],
  sub_plans: {
    plans: [
      {
        task_id: "SP-1",
        name: "PredictX",
        main_task: "PredictX anomaly prediction",
        query: "Sensor and image features flow through time-series, vision, fusion, and anomaly agents.",
        workflow: {
          agents: [
            { id: "block-1", agentId: "timeseries-agent", x: 400, y: 90 },
            { id: "block-2", agentId: "vision-agent", x: 400, y: 330 },
            { id: "block-3", agentId: "fusion-agent", x: 710, y: 210 },
            { id: "block-4", agentId: "anomaly-prediction-agent", x: 1010, y: 210 },
          ],
          tools: [
            {
              id: "tool-1",
              presetName: "Data Asset",
              x: 95,
              y: 105,
              name: "PredictX sensor features",
              tagline: SMART_PILOT_DATA_PATHS.predictxFeatures,
            },
            {
              id: "tool-2",
              presetName: "Data Asset",
              x: 95,
              y: 345,
              name: "PredictX image probabilities",
              tagline: SMART_PILOT_DATA_PATHS.predictxFeatures,
            },
            {
              id: "tool-3",
              presetName: "LSTM Model",
              x: 205,
              y: 225,
              tagline: "Autoencoder sensor features",
            },
            {
              id: "tool-4",
              presetName: "CNN Model",
              x: 205,
              y: 465,
              tagline: "EfficientNet image features",
            },
            {
              id: "tool-5",
              presetName: "Data Asset",
              x: 510,
              y: 520,
              name: "Knowledge adjustment",
              tagline: "knowledge_adjustment column",
            },
          ],
          connections: [
            { id: "conn-1", from: { type: "tool", id: "tool-1", port: 0 }, to: { type: "block", id: "block-1", inputIndex: TOOL_PORT_OFFSET } },
            { id: "conn-2", from: { type: "tool", id: "tool-3", port: 0 }, to: { type: "block", id: "block-1", inputIndex: TOOL_PORT_OFFSET } },
            { id: "conn-3", from: { type: "tool", id: "tool-2", port: 0 }, to: { type: "block", id: "block-2", inputIndex: TOOL_PORT_OFFSET } },
            { id: "conn-4", from: { type: "tool", id: "tool-4", port: 0 }, to: { type: "block", id: "block-2", inputIndex: TOOL_PORT_OFFSET } },
            { id: "conn-5", from: { type: "block", id: "block-1", port: 0 }, to: { type: "block", id: "block-3", inputIndex: 0 } },
            { id: "conn-6", from: { type: "block", id: "block-2", port: 0 }, to: { type: "block", id: "block-3", inputIndex: 1 } },
            { id: "conn-7", from: { type: "tool", id: "tool-5", port: 0 }, to: { type: "block", id: "block-3", inputIndex: TOOL_PORT_OFFSET } },
            { id: "conn-8", from: { type: "block", id: "block-3", port: 0 }, to: { type: "block", id: "block-4", inputIndex: 0 } },
          ],
        },
      },
      {
        task_id: "SP-2",
        name: "ForeSight",
        main_task: "ForeSight production forecasting",
        query: "Production and process data flow into the registered ForeSight forecasting agent.",
        workflow: {
          agents: [{ id: "block-1", agentId: "foresight-agent", x: 430, y: 180 }],
          tools: [
            {
              id: "tool-1",
              presetName: "Data Asset",
              x: 120,
              y: 105,
              name: "ForeSight production CSV",
              tagline: SMART_PILOT_DATA_PATHS.foresightProduction,
            },
            {
              id: "tool-2",
              presetName: "Data Asset",
              x: 120,
              y: 260,
              name: "ForeSight process CSV",
              tagline: SMART_PILOT_DATA_PATHS.foresightProcess,
            },
            {
              id: "tool-3",
              presetName: "LSTM Model",
              x: 235,
              y: 415,
              tagline: "Production forecasting",
            },
          ],
          connections: [
            { id: "conn-1", from: { type: "tool", id: "tool-1", port: 0 }, to: { type: "block", id: "block-1", inputIndex: TOOL_PORT_OFFSET } },
            { id: "conn-2", from: { type: "tool", id: "tool-2", port: 0 }, to: { type: "block", id: "block-1", inputIndex: TOOL_PORT_OFFSET } },
            { id: "conn-3", from: { type: "tool", id: "tool-3", port: 0 }, to: { type: "block", id: "block-1", inputIndex: TOOL_PORT_OFFSET } },
          ],
        },
      },
      {
        task_id: "SP-3",
        name: "InfoGuide",
        main_task: "InfoGuide domain Q&A",
        query: "Manufacturing Q&A data flows through retrieval and query-answering agents.",
        workflow: {
          agents: [
            { id: "block-1", agentId: "rag-agent", x: 400, y: 120 },
            { id: "block-2", agentId: "qa-agent", x: 720, y: 120 },
          ],
          tools: [
            {
              id: "tool-1",
              presetName: "Data Asset",
              x: 110,
              y: 125,
              name: "InfoGuide Q&A dataset",
              tagline: SMART_PILOT_DATA_PATHS.infoguideQa,
            },
            {
              id: "tool-2",
              presetName: "Embedding Model",
              x: 210,
              y: 285,
              tagline: "Context retrieval",
            },
            {
              id: "tool-3",
              presetName: "LLM",
              x: 530,
              y: 305,
              tagline: "Domain Q&A synthesis",
            },
          ],
          connections: [
            { id: "conn-1", from: { type: "tool", id: "tool-1", port: 0 }, to: { type: "block", id: "block-1", inputIndex: TOOL_PORT_OFFSET } },
            { id: "conn-2", from: { type: "tool", id: "tool-2", port: 0 }, to: { type: "block", id: "block-1", inputIndex: TOOL_PORT_OFFSET } },
            { id: "conn-3", from: { type: "block", id: "block-1", port: 0 }, to: { type: "block", id: "block-2", inputIndex: 1 } },
            { id: "conn-4", from: { type: "tool", id: "tool-3", port: 0 }, to: { type: "block", id: "block-2", inputIndex: TOOL_PORT_OFFSET } },
          ],
        },
      },
      {
        task_id: "SP-4",
        name: "SmartPilot response",
        main_task: "SmartPilot response synthesis",
        query: "Aggregate PredictX, ForeSight, and InfoGuide outputs for the operator.",
        workflow: {
          agents: [{ id: "block-1", agentId: "response-agent", x: 430, y: 180 }],
          tools: [
            {
              id: "tool-1",
              presetName: "LLM",
              x: 180,
              y: 310,
              tagline: "Synthesize SmartPilot response",
            },
          ],
          connections: [
            { id: "conn-1", from: { type: "tool", id: "tool-1", port: 0 }, to: { type: "block", id: "block-1", inputIndex: TOOL_PORT_OFFSET } },
          ],
        },
      },
    ],
    connections: [
      { from: "SP-1", to: "SP-4" },
      { from: "SP-2", to: "SP-4" },
      { from: "SP-3", to: "SP-4" },
    ],
  },
};

export function buildSmartPilotWorkflowBuilderPlan(): WorkflowDemoPlanPayload {
  return buildRegistryWorkflowDemoPlan(smartPilotWorkflowDefinition);
}

export function buildSmartPilotWorkflowBuilderPayload() {
  return {
    mode: "plan",
    plans: [buildSmartPilotWorkflowBuilderPlan()],
  };
}

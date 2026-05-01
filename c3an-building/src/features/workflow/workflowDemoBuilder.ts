import {
  TOOL_PALETTE,
  TOOL_PORT_OFFSET,
  getAgentRegistryEntryById,
  listMandatoryOptional,
} from "../../shared/constants";
import type { AgentBlock, AgentRegistryEntry, Connection, ToolNode, ToolPreset } from "../../shared/types";
import type { PlanConnections, PlanSubTask, PlanTriple, PlanningBlock } from "../../shared/types/planning";

export type RegistryAgentNodeDefinition = {
  id: string;
  agentId: string;
  x: number;
  y: number;
  required?: boolean;
};

export type WorkflowToolNodeDefinition = {
  id: string;
  presetName: string;
  x: number;
  y: number;
  name?: string;
  tagline?: string;
};

export type WorkflowConnectionDefinition = {
  id: string;
  from: Connection["from"];
  to: Connection["to"];
};

export type RegistryWorkflowDefinition = {
  agents: RegistryAgentNodeDefinition[];
  tools?: WorkflowToolNodeDefinition[];
  connections?: WorkflowConnectionDefinition[];
};

export type RegistryWorkflowSubplanDefinition = {
  task_id: string;
  name: string;
  main_task: string;
  query: string;
  triples?: PlanTriple[];
  workflow?: RegistryWorkflowDefinition;
};

export type RegistryWorkflowPlanDefinition = {
  task_id: string;
  main_task: string;
  sub_tasks: PlanSubTask[];
  triples: PlanTriple[];
  sub_plans: {
    plans: RegistryWorkflowSubplanDefinition[];
    connections: PlanConnections;
  };
};

export type WorkflowDemoPlanPayload = {
  task_id: string;
  main_task: string;
  sub_tasks: PlanSubTask[];
  triples: PlanTriple[];
  sub_plans: {
    plans: Array<{
      task_id: string;
      name: string;
      main_task: string;
      query: string;
      triples: PlanTriple[];
      workflow?: PlanningBlock["workflow"];
    }>;
    connections: PlanConnections;
  };
};

function getToolPreset(name: string): ToolPreset {
  return (
    TOOL_PALETTE.find((tool) => tool.name === name) ??
    TOOL_PALETTE[0] ?? {
      name,
      tagline: "",
      gradient: "from-slate-50 via-white to-cyan-100",
      ring: "ring-cyan-200",
      accent: "bg-cyan-600",
      inputCount: 1,
      outputCount: 1,
      inputRequired: [false],
      outputRequired: [false],
    }
  );
}

function blockFromAgent(agent: AgentRegistryEntry, id: string, x: number, y: number): AgentBlock {
  const input = listMandatoryOptional(agent.input_data_streams);
  const output = listMandatoryOptional(agent.output_data_streams);
  const inputNames = [...input.mandatory, ...input.optional];
  const outputNames = [...output.mandatory, ...output.optional];
  const inputCount = Math.max(1, Math.min(5, inputNames.length || 1));
  const outputCount = Math.max(1, Math.min(5, outputNames.length || 1));

  return {
    id,
    x,
    y,
    name: agent.name,
    description: agent.description,
    agentId: agent.id,
    presetId: agent.id,
    inputCount,
    outputCount,
    inputRequired: Array.from({ length: inputCount }, (_, index) => index < input.mandatory.length),
    outputRequired: Array.from({ length: outputCount }, (_, index) => index < output.mandatory.length),
    inputNames: inputNames.slice(0, inputCount),
    outputNames: outputNames.slice(0, outputCount),
    mandatoryInputCount: Math.min(input.mandatory.length, inputCount),
    mandatoryOutputCount: Math.min(output.mandatory.length, outputCount),
  };
}

function toolFromDefinition(definition: WorkflowToolNodeDefinition): ToolNode {
  const preset = getToolPreset(definition.presetName);
  return {
    ...preset,
    id: definition.id,
    x: definition.x,
    y: definition.y,
    ...(definition.name ? { name: definition.name } : {}),
    ...(definition.tagline ? { tagline: definition.tagline } : {}),
  };
}

function buildRegistryWorkflowSnapshot(definition: RegistryWorkflowDefinition): PlanningBlock["workflow"] {
  const blockIds = new Set<string>();
  const toolIds = new Set((definition.tools ?? []).map((tool) => tool.id));
  const blocks = definition.agents
    .map((agentNode) => {
      const agent = getAgentRegistryEntryById(agentNode.agentId);
      if (!agent) {
        if (agentNode.required === false) return null;
        throw new Error(`Workflow demo requires registered agent '${agentNode.agentId}'.`);
      }
      blockIds.add(agentNode.id);
      return blockFromAgent(agent, agentNode.id, agentNode.x, agentNode.y);
    })
    .filter((block): block is AgentBlock => Boolean(block));

  return {
    blocks,
    tools: (definition.tools ?? []).map(toolFromDefinition),
    connections: (definition.connections ?? []).filter((connection) => {
      const fromExists =
        connection.from.type === "block" ? blockIds.has(connection.from.id) : toolIds.has(connection.from.id);
      const toExists =
        connection.to.type === "block" ? blockIds.has(connection.to.id) : toolIds.has(connection.to.id);
      return fromExists && toExists;
    }),
    evals: [],
    notes: [],
    uploads: [],
    outputs: [],
  };
}

export function buildRegistryWorkflowDemoPlan(
  definition: RegistryWorkflowPlanDefinition
): WorkflowDemoPlanPayload {
  return {
    task_id: definition.task_id,
    main_task: definition.main_task,
    sub_tasks: definition.sub_tasks,
    triples: definition.triples,
    sub_plans: {
      plans: definition.sub_plans.plans.map((plan) => ({
        task_id: plan.task_id,
        name: plan.name,
        main_task: plan.main_task,
        query: plan.query,
        triples: plan.triples ?? [],
        ...(plan.workflow ? { workflow: buildRegistryWorkflowSnapshot(plan.workflow) } : {}),
      })),
      connections: definition.sub_plans.connections,
    },
  };
}

export { TOOL_PORT_OFFSET };

import type { AgentRegistryEntry, PlanningBlock } from "../../../shared/types";
import { findAgentRegistryEntryByIdOrName, listMandatoryOptional } from "../../../shared/constants";
import { resizeRequired } from "../../../shared/utils";

type PlanDownloadAgent = {
  block_id?: string;
  agent_id: string;
  name: string;
  description?: string;
  input_data_streams: { mandatory: string[]; optional: string[] };
  output_data_streams: { mandatory: string[]; optional: string[] };
};

type PlanDownloadEntry = {
  plan_id: string;
  name: string;
  query: string;
  triples: PlanningBlock["triples"];
  agents: PlanDownloadAgent[];
  workflow: PlanningBlock["workflow"] | null;
};

export type PlanDownloadBundle = {
  exported_at: string;
  plans: PlanDownloadEntry[];
};

function buildPortLabels(
  names: string[] | undefined,
  count: number,
  fallbackPrefix: string,
  fallbackNames?: string[]
) {
  return Array.from({ length: count }, (_, index) => {
    const primary = names?.[index]?.trim();
    if (primary) return primary;
    const fallback = fallbackNames?.[index]?.trim();
    if (fallback) return fallback;
    return `${fallbackPrefix} ${index + 1}`;
  });
}

function splitStreams(labels: string[], required: boolean[]) {
  const mandatory: string[] = [];
  const optional: string[] = [];
  labels.forEach((label, index) => {
    if (required[index]) {
      mandatory.push(label);
    } else {
      optional.push(label);
    }
  });
  return { mandatory, optional };
}

function buildAgentFromBlock(
  block: {
    id: string;
    name: string;
    description?: string;
    agentId?: string;
    inputCount: number;
    outputCount: number;
    inputRequired?: boolean[];
    outputRequired?: boolean[];
    inputNames?: string[];
    outputNames?: string[];
  },
  availableAgents: AgentRegistryEntry[]
): PlanDownloadAgent {
  const registryEntry = findAgentRegistryEntryByIdOrName(block.agentId ?? block.name, availableAgents);
  const registryInput = listMandatoryOptional(registryEntry?.input_data_streams);
  const registryOutput = listMandatoryOptional(registryEntry?.output_data_streams);

  const inputLabels = buildPortLabels(
    block.inputNames,
    block.inputCount,
    "Input",
    [...registryInput.mandatory, ...registryInput.optional]
  );
  const outputLabels = buildPortLabels(
    block.outputNames,
    block.outputCount,
    "Output",
    [...registryOutput.mandatory, ...registryOutput.optional]
  );
  const inputRequired = resizeRequired(block.inputRequired, block.inputCount);
  const outputRequired = resizeRequired(block.outputRequired, block.outputCount);
  const inputStreams = splitStreams(inputLabels, inputRequired);
  const outputStreams = splitStreams(outputLabels, outputRequired);
  const description = block.description?.trim() || registryEntry?.description || "";

  return {
    block_id: block.id,
    agent_id: block.agentId ?? registryEntry?.id ?? block.name,
    name: block.name,
    description,
    input_data_streams: inputStreams,
    output_data_streams: outputStreams,
  };
}

function buildAgentsFromTriples(
  triples: PlanningBlock["triples"] | undefined,
  availableAgents: AgentRegistryEntry[]
) {
  const agents: PlanDownloadAgent[] = [];
  const seen = new Set<string>();
  const normalized = triples ?? [];

  const addAgent = (label: string) => {
    const name = label.trim();
    if (!name || seen.has(name)) return;
    seen.add(name);
    const registryEntry = findAgentRegistryEntryByIdOrName(name, availableAgents);
    const input = listMandatoryOptional(registryEntry?.input_data_streams);
    const output = listMandatoryOptional(registryEntry?.output_data_streams);
    agents.push({
      agent_id: registryEntry?.id ?? name,
      name: registryEntry?.name ?? name,
      description: registryEntry?.description ?? "",
      input_data_streams: { mandatory: input.mandatory, optional: input.optional },
      output_data_streams: { mandatory: output.mandatory, optional: output.optional },
    });
  };

  normalized.forEach((triple) => {
    addAgent(String(triple.from ?? ""));
    addAgent(String(triple.to ?? ""));
  });

  return agents;
}

export function buildPlanDownloadBundle(args: {
  plans: PlanningBlock[];
  activePlanId: string | null;
  activeSnapshot: PlanningBlock["workflow"] | null;
  availableAgents: AgentRegistryEntry[];
}): PlanDownloadBundle {
  const exportPlans = args.plans.map((plan) =>
    plan.id === args.activePlanId && args.activeSnapshot ? { ...plan, workflow: args.activeSnapshot } : plan
  );

  return {
    exported_at: new Date().toISOString(),
    plans: exportPlans.map((plan) => {
      const workflowBlocks = plan.workflow?.blocks ?? [];
      const agents =
        workflowBlocks.length > 0
          ? workflowBlocks.map((block) => buildAgentFromBlock(block, args.availableAgents))
          : buildAgentsFromTriples(plan.triples, args.availableAgents);
      return {
        plan_id: plan.id,
        name: plan.name,
        query: plan.query,
        triples: plan.triples,
        agents,
        workflow: plan.workflow ?? null,
      };
    }),
  };
}

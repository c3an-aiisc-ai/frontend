import {
  AGENT_REGISTRY_AGENTS,
  findAgentRegistryEntryByIdOrName,
  getAgentRegistryEntryById,
} from "../../shared/constants/agentRegistry";
import type { AgentRegistryEntry } from "../../shared/types";

export type SmartPilotCapabilityKey = "predictx" | "foresight" | "infoguide";

export type SmartPilotRegistryBinding = {
  key: SmartPilotCapabilityKey;
  title: string;
  paperCapability: string;
  runtimeAgentId: string;
  catalogCandidates: string[];
};

export type SmartPilotResolvedAgent = SmartPilotRegistryBinding & {
  agent: AgentRegistryEntry | null;
  missingMessage: string | null;
};

export const SMART_PILOT_AGENT_BINDINGS: Record<SmartPilotCapabilityKey, SmartPilotRegistryBinding> = {
  predictx: {
    key: "predictx",
    title: "PredictX",
    paperCapability: "Anomaly prediction",
    runtimeAgentId: "predictx",
    catalogCandidates: ["predictx-agent", "PredictX"],
  },
  foresight: {
    key: "foresight",
    title: "ForeSight",
    paperCapability: "Production forecasting",
    runtimeAgentId: "foresight",
    catalogCandidates: ["foresight-agent", "ForeSight"],
  },
  infoguide: {
    key: "infoguide",
    title: "InfoGuide",
    paperCapability: "Domain-specific Q&A",
    runtimeAgentId: "infoguide",
    catalogCandidates: ["qa-agent", "InfoGuideQA", "manuals-guide-agent", "ManualsGuide"],
  },
};

function resolveFromRegistry(
  candidates: string[],
  agents: AgentRegistryEntry[] = AGENT_REGISTRY_AGENTS
): AgentRegistryEntry | null {
  for (const candidate of candidates) {
    const match = getAgentRegistryEntryById(candidate, agents) ?? findAgentRegistryEntryByIdOrName(candidate, agents);
    if (match) return match;
  }
  return null;
}

export function resolveSmartPilotAgents(
  agents: AgentRegistryEntry[] = AGENT_REGISTRY_AGENTS
): SmartPilotResolvedAgent[] {
  return (Object.keys(SMART_PILOT_AGENT_BINDINGS) as SmartPilotCapabilityKey[]).map((key) => {
    const binding = SMART_PILOT_AGENT_BINDINGS[key];
    const agent = resolveFromRegistry(binding.catalogCandidates, agents);
    return {
      ...binding,
      agent,
      missingMessage: agent
        ? null
        : `No registered agent matched ${binding.catalogCandidates.join(", ")}.`,
    };
  });
}

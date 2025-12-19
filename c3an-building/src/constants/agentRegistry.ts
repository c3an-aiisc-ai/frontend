import type { AgentRegistryEntry, AgentRegistryFile, AgentBlock } from "../types";
import raw from "./registries/agent_registry.json";

export const AGENT_REGISTRY: AgentRegistryFile = raw as AgentRegistryFile;
export const AGENT_REGISTRY_AGENTS: AgentRegistryEntry[] = Array.isArray(AGENT_REGISTRY.agents)
  ? AGENT_REGISTRY.agents
  : [];

export function getAgentRegistryEntryById(agentId: string | undefined | null): AgentRegistryEntry | null {
  if (!agentId) return null;
  return AGENT_REGISTRY_AGENTS.find((a) => a.id === agentId) ?? null;
}

export function findAgentRegistryEntryByIdOrName(label: string | undefined | null): AgentRegistryEntry | null {
  if (!label) return null;
  const exact = AGENT_REGISTRY_AGENTS.find((a) => a.id === label);
  if (exact) return exact;
  const normalized = label.trim().toLowerCase();
  return AGENT_REGISTRY_AGENTS.find((a) => a.name.trim().toLowerCase() === normalized) ?? null;
}

export function getRegistryAgentForBlock(block: AgentBlock): AgentRegistryEntry | null {
  return getAgentRegistryEntryById(block.agentId) ?? findAgentRegistryEntryByIdOrName(block.name);
}

export function listMandatoryOptional(streams: { mandatory: string[]; optional?: string[] } | undefined) {
  return {
    mandatory: Array.isArray(streams?.mandatory) ? streams!.mandatory : [],
    optional: Array.isArray(streams?.optional) ? streams!.optional! : [],
  };
}

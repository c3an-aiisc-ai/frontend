import type { AgentRegistryEntry } from "../types";
import { CUSTOM_AGENT_STORAGE_KEY } from "../constants";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeStreams(value: unknown) {
  if (Array.isArray(value)) {
    return { mandatory: toStringArray(value), optional: [] };
  }
  if (isRecord(value)) {
    return {
      mandatory: toStringArray(value.mandatory),
      optional: toStringArray(value.optional),
    };
  }
  return { mandatory: [], optional: [] };
}

function normalizeStoredAgent(value: unknown, index: number): AgentRegistryEntry | null {
  if (!isRecord(value)) return null;
  const rawId = typeof value.id === "string" ? value.id.trim() : "";
  const rawName = typeof value.name === "string" ? value.name.trim() : "";
  const id = rawId || `custom-agent-${index + 1}`;
  const name = rawName || id;
  const description = typeof value.description === "string" ? value.description : "";
  const capabilities = toStringArray(value.capabilities);

  return {
    id,
    name,
    description,
    capabilities,
    input_data_streams: normalizeStreams(value.input_data_streams),
    output_data_streams: normalizeStreams(value.output_data_streams),
  };
}

export function readCustomAgents(): AgentRegistryEntry[] {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return [];
  const raw = localStorage.getItem(CUSTOM_AGENT_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    const list = Array.isArray(parsed)
      ? parsed
      : isRecord(parsed) && Array.isArray(parsed.agents)
        ? parsed.agents
        : [];
    return list
      .map((entry, index) => normalizeStoredAgent(entry, index))
      .filter((entry): entry is AgentRegistryEntry => Boolean(entry));
  } catch {
    return [];
  }
}

export function writeCustomAgents(agents: AgentRegistryEntry[]): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CUSTOM_AGENT_STORAGE_KEY, JSON.stringify(agents));
  } catch {
    // Ignore storage failures (e.g., quota or private mode).
  }
}

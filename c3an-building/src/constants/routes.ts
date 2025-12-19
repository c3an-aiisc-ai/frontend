const API_BASE = "/api";

export const AGENT_ROUTES = {
  list: `${API_BASE}/agents`,
  detail: (agentId: string) => `${API_BASE}/agents/${encodeURIComponent(agentId)}`,
  capabilities: (agentId: string) => `${API_BASE}/agents/${encodeURIComponent(agentId)}/capabilities`,
  streams: {
    input: (agentId: string) => `${API_BASE}/agents/${encodeURIComponent(agentId)}/streams/input`,
    output: (agentId: string) => `${API_BASE}/agents/${encodeURIComponent(agentId)}/streams/output`,
  },
} as const;

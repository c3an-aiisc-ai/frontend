// Defines constant base path all endpoints share 
const API_BASE = "/api";

// starts exported object named Agent Routes 
export const AGENT_ROUTES = {
  // string endpoint for list all agents 
  list: `${API_BASE}/agents`,

  // details endpoint for getting one agent by id 
  detail: (agentId: string) => `${API_BASE}/agents/${encodeURIComponent(agentId)}`,
  capabilities: (agentId: string) => `${API_BASE}/agents/${encodeURIComponent(agentId)}/capabilities`,
  // starts group for stream related endpoints 
  streams: {
    input: (agentId: string) => `${API_BASE}/agents/${encodeURIComponent(agentId)}/streams/input`,
    output: (agentId: string) => `${API_BASE}/agents/${encodeURIComponent(agentId)}/streams/output`,
  },
} as const;

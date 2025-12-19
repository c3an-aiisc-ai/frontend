import type { AgentSpecTemplate } from "../types/workflow";
import llmAuditorRegistry from "./LLM - registry.json" assert { type: "json" };
import tsaeAgentRegistry from "./TSAE-Agent.json" assert { type: "json" };

export type RegistryTemplatePreset = {
  id: string;
  name: string;
  description?: string;
  template: AgentSpecTemplate;
};

const llmAuditorTemplate = llmAuditorRegistry as AgentSpecTemplate;
const tsaeAgentTemplate = tsaeAgentRegistry as AgentSpecTemplate;

const describe = (template: AgentSpecTemplate) =>
  typeof template.query === "string" && template.query.trim().length > 0
    ? template.query.trim()
    : typeof template.intent === "string"
      ? template.intent
      : undefined;

export const REGISTRY_TEMPLATES: RegistryTemplatePreset[] = [
  {
    id: "llm-auditor",
    name: "LLM Auditor",
    description: describe(llmAuditorTemplate),
    template: llmAuditorTemplate,
  },
  {
    id: "tsae-agent",
    name: "TSAE Agent",
    description: describe(tsaeAgentTemplate),
    template: tsaeAgentTemplate,
  },
];

export const REGISTRY_TEMPLATES_BY_ID = REGISTRY_TEMPLATES.reduce<Record<string, RegistryTemplatePreset>>(
  (acc, preset) => {
    acc[preset.id] = preset;
    return acc;
  },
  {},
);

import { useCallback, useMemo } from "react";
import { REGISTRY_TEMPLATES } from "../../constants/registryTemplates";

type Options = {
  agentSpecTemplate: any;
  setAgentSpecTemplate: (value: any) => void;
  setAgentParseError: (value: any) => void;
};

export function useRegistryTemplates({ agentSpecTemplate, setAgentSpecTemplate, setAgentParseError }: Options) {
  const activeRegistryTemplateId = useMemo(() => {
    if (!agentSpecTemplate) return null;
    const templateAgentId =
      (agentSpecTemplate as { agent_id?: string }).agent_id ??
      (agentSpecTemplate as { id?: string }).id ??
      null;
    if (!templateAgentId) return null;
    const match = REGISTRY_TEMPLATES.find((preset) => {
      const presetAgentId =
        (preset.template as { agent_id?: string }).agent_id ?? (preset.template as { id?: string }).id ?? null;
      return Boolean(presetAgentId) && presetAgentId === templateAgentId;
    });
    return match?.id ?? null;
  }, [agentSpecTemplate]);

  const registryTemplateLabel = useMemo(() => {
    if (activeRegistryTemplateId) {
      const preset = REGISTRY_TEMPLATES.find((item) => item.id === activeRegistryTemplateId);
      if (preset) return preset.name;
    }
    if (agentSpecTemplate) {
      const templateName =
        (agentSpecTemplate as { agent_id?: string }).agent_id ??
        (agentSpecTemplate as { name?: string }).name ??
        (agentSpecTemplate as { query?: string }).query ??
        null;
      return templateName ?? "Custom template";
    }
    return null;
  }, [activeRegistryTemplateId, agentSpecTemplate]);

  const handleApplyRegistryTemplate = useCallback(
    (presetId: string) => {
      const preset = REGISTRY_TEMPLATES.find((item) => item.id === presetId);
      if (!preset) return;
      setAgentSpecTemplate(preset.template);
      setAgentParseError(null);
    },
    [setAgentParseError, setAgentSpecTemplate],
  );

  const handleClearRegistryTemplate = useCallback(() => {
    setAgentSpecTemplate(null);
  }, [setAgentSpecTemplate]);

  return { activeRegistryTemplateId, registryTemplateLabel, handleApplyRegistryTemplate, handleClearRegistryTemplate };
}

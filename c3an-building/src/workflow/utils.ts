import type { AgentBlock, AgentSpecTemplate, Connection, ToolNode } from "../types/workflow";

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function formatBytes(size?: number) {
  if (size === undefined || size === null) return "";
  if (size < 1024) return `${size} B`;
  const units = ["KB", "MB", "GB"];
  let value = size / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const formatted = value >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${formatted} ${units[unitIndex]}`;
}

export function downloadWorkflow(snapshot: unknown, filename = "c3an-workflow.json") {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function captureAgentSpecTemplate(raw: unknown): AgentSpecTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const rest = { ...(raw as Record<string, unknown>) };
  delete rest.agents;
  delete rest.blocks;
  delete rest.tools;
  delete rest.uploads;
  delete rest.outputs;
  delete rest.connections;
  delete rest.notes;
  return rest;
}

export function buildAgentRegistrySpec(
  agentSpecTemplate: AgentSpecTemplate | null,
  blocks: AgentBlock[],
  connections: Connection[],
  tools: ToolNode[],
  toolPortOffset: number,
) {
  const baseTemplate: AgentSpecTemplate = agentSpecTemplate ?? {
    metadata: { version: "1.0.0" },
    registry_type: "agent_registry",
    global_protocols: ["a2a", "mcp"],
  };

  const rawMetadata = baseTemplate.metadata;
  const metadata: Record<string, unknown> =
    rawMetadata && typeof rawMetadata === "object" && !Array.isArray(rawMetadata)
      ? { ...rawMetadata }
      : {};
  if (typeof metadata.version !== "string") {
    metadata.version = "1.0.0";
  }

  const toStringArray = (value: unknown, fallback: string[]) => {
    if (!Array.isArray(value)) return fallback;
    return (value as unknown[]).filter((item): item is string => typeof item === "string");
  };

  const ensureNames = (names: string[] | undefined, count: number, prefix: string) => {
    const base = (names ?? []).slice(0, count);
    const next = [...base];
    while (next.length < count) {
      next.push(`${prefix}_${next.length + 1}`);
    }
    return next;
  };

  const agentsSpec = blocks.map((block) => {
    const inputs = ensureNames(block.inputNames, block.inputCount, "input");
    const outputs = ensureNames(block.outputNames, block.outputCount, "output");

    const mandatoryInputs: string[] = [];
    const optionalInputs: string[] = [];
    inputs.forEach((name, idx) => {
      const isRequired = block.inputRequired[idx] ?? false;
      (isRequired ? mandatoryInputs : optionalInputs).push(name);
    });

    const mandatoryOutputs: string[] = [];
    const optionalOutputs: string[] = [];
    outputs.forEach((name, idx) => {
      const isRequired = block.outputRequired[idx] ?? false;
      (isRequired ? mandatoryOutputs : optionalOutputs).push(name);
    });

    const capabilityConnections = connections.filter(
      (conn) =>
        conn.to.type === "block" &&
        conn.to.id === block.id &&
        (conn.to.inputIndex ?? 0) >= toolPortOffset &&
        conn.from.type === "tool",
    );

    const capabilities: string[] = [];
    capabilityConnections.forEach((conn) => {
      const toolName = tools.find((tool) => tool.id === conn.from.id)?.name;
      if (toolName && !capabilities.includes(toolName)) {
        capabilities.push(toolName);
      }
    });

    return {
      id: block.sourceAgentId ?? block.name ?? block.id,
      name: block.name,
      description: block.description,
      capabilities,
      input_data_streams: {
        mandatory: mandatoryInputs,
        optional: optionalInputs,
      },
      output_data_streams: {
        mandatory: mandatoryOutputs,
        optional: optionalOutputs,
      },
    };
  });

  const registryType =
    typeof baseTemplate.registry_type === "string" ? baseTemplate.registry_type : "agent_registry";
  const globalProtocols = toStringArray(baseTemplate.global_protocols, ["a2a", "mcp"]);
  const description = typeof baseTemplate.description === "string" ? baseTemplate.description : undefined;

  const rest = { ...(baseTemplate ?? {}) };
  delete rest.metadata;
  delete rest.registry_type;
  delete rest.global_protocols;
  delete rest.description;

  return {
    ...rest,
    metadata,
    registry_type: registryType,
    global_protocols: globalProtocols,
    ...(description ? { description } : {}),
    agents: agentsSpec,
  };
}

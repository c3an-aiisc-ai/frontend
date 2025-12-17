import type { MutableRefObject } from "react";
import type { AgentBlock, Connection, ToolNode, ToolPreset } from "../types/workflow";
import { TOOL_PORT_OFFSET } from "./constants";

export type AgentDefinition = {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  input_data_streams?: {
    mandatory?: unknown;
    optional?: unknown;
  };
  output_data_streams?: {
    mandatory?: unknown;
    optional?: unknown;
  };
  capabilities?: unknown;
};

type BuildParams = {
  agents: AgentDefinition[];
  existingBlockCount: number;
  toolPalette: ToolPreset[];
  nextBlockIdRef: MutableRefObject<number>;
  nextToolIdRef: MutableRefObject<number>;
  nextConnectionIdRef: MutableRefObject<number>;
};

export function buildAgentsFromDefinition({
  agents,
  existingBlockCount,
  toolPalette,
  nextBlockIdRef,
  nextToolIdRef,
  nextConnectionIdRef,
}: BuildParams) {
  const newBlocks: AgentBlock[] = [];
  const newTools: ToolNode[] = [];
  const newConnections: Connection[] = [];
  const baseX = 140 + existingBlockCount * 40;
  const baseY = 200;
  const blockSpacing = 340;
  const toolSpacingX = 150;
  const toolSpacingY = 150;

  const toStringArray = (value: unknown) =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

  agents.forEach((agent, idx) => {
    const mandatoryInputs = toStringArray(agent.input_data_streams?.mandatory);
    const optionalInputs = toStringArray(agent.input_data_streams?.optional);
    const mandatoryOutputs = toStringArray(agent.output_data_streams?.mandatory);
    const optionalOutputs = toStringArray(agent.output_data_streams?.optional);
    const inputCount = mandatoryInputs.length + optionalInputs.length;
    const outputCount = mandatoryOutputs.length + optionalOutputs.length;
    const blockId = `block-${nextBlockIdRef.current++}`;
    const blockX = baseX + idx * blockSpacing;
    const blockY = baseY;
    const agentId = typeof agent.id === "string" ? agent.id : undefined;
    const agentName = typeof agent.name === "string" ? agent.name : undefined;
    const agentDescription = typeof agent.description === "string" ? agent.description : undefined;

    newBlocks.push({
      id: blockId,
      x: blockX,
      y: blockY,
      sourceAgentId: agentId ?? agentName ?? `agent-${idx + 1}`,
      name: agentName ?? agentId ?? `Agent ${idx + 1}`,
      description: agentDescription ?? "Generated from JSON",
      inputCount: Math.max(1, inputCount || 1),
      outputCount: Math.max(1, outputCount || 1),
      inputRequired: [
        ...Array(mandatoryInputs.length).fill(true),
        ...Array(Math.max(0, inputCount - mandatoryInputs.length)).fill(false),
      ].slice(0, Math.max(1, inputCount || 1)),
      outputRequired: [
        ...Array(mandatoryOutputs.length).fill(true),
        ...Array(Math.max(0, outputCount - mandatoryOutputs.length)).fill(false),
      ].slice(0, Math.max(1, outputCount || 1)),
      inputNames: [...mandatoryInputs, ...optionalInputs].slice(0, Math.max(1, inputCount || 1)),
      outputNames: [...mandatoryOutputs, ...optionalOutputs].slice(0, Math.max(1, outputCount || 1)),
      mandatoryInputCount: mandatoryInputs.length,
      mandatoryOutputCount: mandatoryOutputs.length,
    });

    const capabilities = toStringArray(agent.capabilities);
    capabilities.forEach((cap, capIdx) => {
      const palette = toolPalette[capIdx % toolPalette.length];
      const toolId = `tool-${nextToolIdRef.current++}`;
      const toolX = blockX + (capIdx % 2) * toolSpacingX - 40;
      const toolY = blockY + 220 + Math.floor(capIdx / 2) * toolSpacingY;
      newTools.push({
        ...palette,
        id: toolId,
        x: toolX,
        y: toolY,
        name: typeof cap === "string" ? cap : `Capability ${capIdx + 1}`,
        tagline: "Capability tool",
      });
      const connId = `conn-${nextConnectionIdRef.current++}`;
      newConnections.push({
        id: connId,
        from: { type: "tool", id: toolId, port: 0 },
        to: { type: "block", id: blockId, inputIndex: TOOL_PORT_OFFSET },
      });
    });
  });

  return { newBlocks, newTools, newConnections };
}

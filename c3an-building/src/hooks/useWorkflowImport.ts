import { useCallback } from "react";
import type {
  AgentBlock,
  AgentRegistryEntry,
  Connection,
  LinkSource,
  LinkTarget,
  Selection,
  ToolNode,
  ViewMode,
} from "../shared/types";
import { importAgentViewPlanJson } from "../shared/planning/handleIO";
import {
  MAX_IO,
  TOOL_PORT_OFFSET,
  findAgentRegistryEntryByIdOrName,
  getAgentRegistryEntryById,
} from "../shared/constants";
import { clamp } from "../shared/utils";
import { buildIoFromStreams, detectWorkflowType } from "../features/workflow/utils/workflowIO";

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

function normalizeBlocksWithRegistry(
  blocks: AgentBlock[],
  availableAgents: AgentRegistryEntry[]
) {
  return blocks.map((b) => {
    const maybeAgent =
      getAgentRegistryEntryById(b.agentId, availableAgents) ??
      findAgentRegistryEntryByIdOrName(b.name, availableAgents);

    if (!maybeAgent) return b;

    const io = buildIoFromStreams({
      input: maybeAgent.input_data_streams,
      output: maybeAgent.output_data_streams,
    });

    const rawInputCount = Number(b.inputCount);
    const rawOutputCount = Number(b.outputCount);
    const inputCount = Math.max(1, Number.isFinite(rawInputCount) ? rawInputCount : 1, io.inputCount);
    const outputCount = Math.max(1, Number.isFinite(rawOutputCount) ? rawOutputCount : 1, io.outputCount);

    const mergeNames = (existing: unknown, fallback: string[], length: number) => {
      const ex = Array.isArray(existing) ? (existing as unknown[]).map((v) => String(v)) : [];
      return Array.from({ length }, (_, i) => ex[i] ?? fallback[i] ?? "");
    };

    const ensureRequired = (existing: unknown, length: number, mandatoryCount: number) => {
      const ex = Array.isArray(existing) ? (existing as unknown[]).map((v) => Boolean(v)) : [];
      return Array.from({ length }, (_, i) => (i < mandatoryCount ? true : ex[i] ?? false));
    };

    return {
      ...b,
      agentId: b.agentId ?? maybeAgent.id,
      name: maybeAgent.name ?? b.name,
      description: maybeAgent.description ?? b.description,
      inputCount,
      outputCount,
      mandatoryInputCount: io.mandatoryInputCount,
      mandatoryOutputCount: io.mandatoryOutputCount,
      inputNames: mergeNames(b.inputNames, io.inputNames, inputCount),
      outputNames: mergeNames(b.outputNames, io.outputNames, outputCount),
      inputRequired: ensureRequired(b.inputRequired, inputCount, io.mandatoryInputCount),
      outputRequired: ensureRequired(b.outputRequired, outputCount, io.mandatoryOutputCount),
    } satisfies AgentBlock;
  });
}

function enablePortsFromConnections(blocks: AgentBlock[], connections: Connection[]) {
  const blocksWithUsedPorts: AgentBlock[] = blocks.map((b) => ({
    ...b,
    inputRequired: [...(b.inputRequired ?? [])],
    outputRequired: [...(b.outputRequired ?? [])],
  }));
  const mutableById = new Map(blocksWithUsedPorts.map((b) => [b.id, b] as const));
  for (const conn of connections) {
    if (conn.from.type === "block") {
      const b = mutableById.get(conn.from.id);
      if (b && conn.from.port >= 0 && conn.from.port < b.outputRequired.length) {
        b.outputRequired[conn.from.port] = true;
      }
    }
    if (conn.to.type === "block") {
      const idx = conn.to.inputIndex ?? 0;
      if (idx >= 0 && idx < TOOL_PORT_OFFSET) {
        const b = mutableById.get(conn.to.id);
        if (b && idx < b.inputRequired.length) b.inputRequired[idx] = true;
      }
    }
  }
  return blocksWithUsedPorts;
}

export function useWorkflowImport(args: {
  availableAgents: AgentRegistryEntry[];
  agentPlanTemplateRef: React.MutableRefObject<unknown | null>;
  bumpIdCounters: (args: {
    blocks?: Array<{ id: string }>;
    tools?: Array<{ id: string }>;
    connections?: Array<{ id: string }>;
  }) => void;
  linkingRef: React.MutableRefObject<boolean>;
  recalcBlockPorts: (connections: Connection[], blocks: AgentBlock[]) => AgentBlock[];
  setBlocks: SetState<AgentBlock[]>;
  setTools: SetState<ToolNode[]>;
  setConnections: SetState<Connection[]>;
  setSelectedEvals: SetState<string[]>;
  setSelected: SetState<Selection>;
  setHoveredInput: SetState<LinkTarget | null>;
  setHoveredOutput: SetState<LinkSource | null>;
  setHoveredBlockId: SetState<string | null>;
  setHoveredToolId: SetState<string | null>;
  setLinking: SetState<{
    origin: "output";
    from: LinkSource;
    current: { x: number; y: number };
  } | {
    origin: "input";
    target: LinkTarget;
    current: { x: number; y: number };
  } | null>;
  setViewMode: SetState<ViewMode>;
}) {
  const {
    agentPlanTemplateRef,
    availableAgents,
    bumpIdCounters,
    linkingRef,
    recalcBlockPorts,
    setBlocks,
    setConnections,
    setHoveredBlockId,
    setHoveredInput,
    setHoveredOutput,
    setHoveredToolId,
    setLinking,
    setSelected,
    setSelectedEvals,
    setTools,
    setViewMode,
  } = args;

  const resetWorkspaceUi = useCallback(() => {
    setSelected(null);
    setHoveredInput(null);
    setHoveredOutput(null);
    setHoveredBlockId(null);
    setHoveredToolId(null);
    setLinking(null);
    linkingRef.current = false;
  }, [
    linkingRef,
    setHoveredBlockId,
    setHoveredInput,
    setHoveredOutput,
    setHoveredToolId,
    setLinking,
    setSelected,
  ]);

  const applyPlanJson = useCallback(
    (src: unknown) => {
      const imported = importAgentViewPlanJson(src);
      agentPlanTemplateRef.current = imported.template;

      resetWorkspaceUi();

      const loadedBlocks = imported.workflow.blocks;
      const loadedConnections = imported.workflow.connections;

      const normalizedBlocks = normalizeBlocksWithRegistry(loadedBlocks, availableAgents);
      const normalizedConnections = loadedConnections.map((c: Connection) => {
        const next = { ...c } as Connection;
        if (next.from.type === "block") {
          next.from = { ...next.from, port: clamp(next.from.port, 0, MAX_IO - 1) };
        }
        if (next.to.type === "block") {
          const idx = next.to.inputIndex ?? 0;
          if (idx < TOOL_PORT_OFFSET) {
            next.to = { ...next.to, inputIndex: clamp(idx, 0, MAX_IO - 1) };
          }
        }
        return next;
      });

      const blocksWithUsedPorts = enablePortsFromConnections(normalizedBlocks, normalizedConnections);

      setBlocks(blocksWithUsedPorts);
      setTools([]);
      setSelectedEvals([]);
      setConnections(normalizedConnections);
      setBlocks((prev) => recalcBlockPorts(normalizedConnections, prev));

      bumpIdCounters({
        blocks: blocksWithUsedPorts,
        connections: normalizedConnections,
        tools: [],
      });

      setViewMode("agent");
    },
    [
      agentPlanTemplateRef,
      availableAgents,
      bumpIdCounters,
      recalcBlockPorts,
      resetWorkspaceUi,
      setBlocks,
      setConnections,
      setSelectedEvals,
      setTools,
      setViewMode,
    ]
  );

  const handleUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const src = JSON.parse(ev.target?.result as string);
          const kind = detectWorkflowType(src);

          if (kind === "planning") {
            applyPlanJson(src);
            return;
          }

          if (kind === "agent") {
            resetWorkspaceUi();

            const loadedBlocks = Array.isArray(src.blocks) ? (src.blocks as AgentBlock[]) : [];

            const normalizedBlocks = normalizeBlocksWithRegistry(loadedBlocks, availableAgents);
            const normalizedBlockById = new Map(normalizedBlocks.map((b) => [b.id, b] as const));

            const loadedConnections = (src.connections ?? []).map((c: Connection) => {
              const next = { ...c } as Connection;
              if (next.from.type === "block") {
                const fromBlock = normalizedBlockById.get(next.from.id);
                const maxPort = Math.max(0, (fromBlock?.outputCount ?? 1) - 1);
                next.from = { ...next.from, port: Math.max(0, Math.min(maxPort, next.from.port)) };
              }
              if (next.to.type === "block") {
                const toBlock = normalizedBlockById.get(next.to.id);
                const idx = next.to.inputIndex ?? 0;
                if (idx < TOOL_PORT_OFFSET) {
                  const maxIdx = Math.max(0, (toBlock?.inputCount ?? 1) - 1);
                  next.to = { ...next.to, inputIndex: Math.max(0, Math.min(maxIdx, idx)) };
                }
              }
              return next;
            });

            const blocksWithUsedPorts = enablePortsFromConnections(normalizedBlocks, loadedConnections);

            setBlocks(blocksWithUsedPorts);
            setTools(src.tools ?? []);
            setSelectedEvals(src.evals ?? []);
            setConnections(loadedConnections);
            setBlocks((prev) => recalcBlockPorts(loadedConnections, prev));
            agentPlanTemplateRef.current = null;

            bumpIdCounters({
              blocks: blocksWithUsedPorts,
              tools: src.tools ?? [],
              connections: loadedConnections,
            });
            return;
          }

          throw new Error("Unsupported workflow");
        } catch {
          alert("Invalid workflow file");
        }
      };

      reader.readAsText(file);
      e.target.value = "";
    },
    [
      agentPlanTemplateRef,
      applyPlanJson,
      availableAgents,
      bumpIdCounters,
      recalcBlockPorts,
      resetWorkspaceUi,
      setBlocks,
      setConnections,
      setSelectedEvals,
      setTools,
    ]
  );

  return { applyPlanJson, handleUpload };
}

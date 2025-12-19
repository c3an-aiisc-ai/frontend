import { useCallback } from "react";
import type { ChangeEvent, Dispatch, MutableRefObject, SetStateAction } from "react";
import type {
  AgentBlock,
  AgentSpecTemplate,
  Connection,
  Note,
  OutputNode,
  ToolNode,
  ToolPreset,
  UploadNode,
} from "../types/workflow";
import type { PlanOp, PlanTriple } from "../types/planning";
import { buildAgentsFromDefinition, type AgentDefinition } from "./agentBuilders";
import { TOOL_PORT_OFFSET } from "./constants";
import { buildAgentRegistrySpec, captureAgentSpecTemplate, downloadWorkflow } from "./utils";

type Params = {
  agentJsonInput: string;
  setAgentParseError: Dispatch<SetStateAction<string | null>>;
  agentSpecTemplate: AgentSpecTemplate | null;
  setAgentSpecTemplate: Dispatch<SetStateAction<AgentSpecTemplate | null>>;
  notes: Note[];
  blocks: AgentBlock[];
  tools: ToolNode[];
  uploads: UploadNode[];
  outputs: OutputNode[];
  connections: Connection[];
  selectedEvals: string[];
  theme: "light" | "dark";
  setTheme: Dispatch<SetStateAction<"light" | "dark">>;
  setNotes: Dispatch<SetStateAction<Note[]>>;
  setBlocks: Dispatch<SetStateAction<AgentBlock[]>>;
  setTools: Dispatch<SetStateAction<ToolNode[]>>;
  setUploads: Dispatch<SetStateAction<UploadNode[]>>;
  setOutputs: Dispatch<SetStateAction<OutputNode[]>>;
  setConnections: Dispatch<SetStateAction<Connection[]>>;
  setSelectedEvals: Dispatch<SetStateAction<string[]>>;
  nextIdRef: MutableRefObject<number>;
  nextBlockIdRef: MutableRefObject<number>;
  nextToolIdRef: MutableRefObject<number>;
  nextUploadIdRef: MutableRefObject<number>;
  nextOutputIdRef: MutableRefObject<number>;
  nextConnectionIdRef: MutableRefObject<number>;
  toolPalette: ToolPreset[];
  resetInteractionState: () => void;
};

export type ImportPayload = {
  notes?: Note[];
  blocks?: AgentBlock[];
  tools?: ToolNode[];
  uploads?: UploadNode[];
  outputs?: OutputNode[];
  connections?: Connection[];
  evals?: string[];
  theme?: "light" | "dark";
  agentSpecTemplate?: AgentSpecTemplate | null;
};

export function useWorkflowImportExport({
  agentJsonInput,
  setAgentParseError,
  agentSpecTemplate,
  setAgentSpecTemplate,
  notes,
  blocks,
  tools,
  uploads,
  outputs,
  connections,
  selectedEvals,
  theme,
  setNotes,
  setBlocks,
  setTools,
  setUploads,
  setOutputs,
  setConnections,
  setSelectedEvals,
  setTheme,
  nextIdRef,
  nextBlockIdRef,
  nextToolIdRef,
  nextUploadIdRef,
  nextOutputIdRef,
  nextConnectionIdRef,
  toolPalette,
  resetInteractionState,
}: Params) {
  const updateIdRefsFromImport = useCallback(
    (payload: { blocks?: AgentBlock[]; tools?: ToolNode[]; uploads?: UploadNode[]; outputs?: OutputNode[]; connections?: Connection[]; notes?: Note[] }) => {
      const bumpRef = (items: { id?: string }[], ref: typeof nextBlockIdRef, prefix: string) => {
        let maxSeen = ref.current - 1;
        items.forEach((item) => {
          const match = typeof item.id === "string" ? item.id.match(new RegExp(`^${prefix}-(\\d+)$`)) : null;
          if (!match) return;
          const numeric = Number(match[1]);
          if (!Number.isNaN(numeric)) {
            maxSeen = Math.max(maxSeen, numeric);
          }
        });
        ref.current = Math.max(ref.current, maxSeen + 1);
      };

      bumpRef(payload.blocks ?? [], nextBlockIdRef, "block");
      bumpRef(payload.tools ?? [], nextToolIdRef, "tool");
      bumpRef(payload.uploads ?? [], nextUploadIdRef, "upload");
      bumpRef(payload.outputs ?? [], nextOutputIdRef, "output");
      bumpRef(payload.connections ?? [], nextConnectionIdRef, "conn");
      bumpRef(payload.notes ?? [], nextIdRef, "note");
    },
    [nextBlockIdRef, nextConnectionIdRef, nextIdRef, nextOutputIdRef, nextToolIdRef, nextUploadIdRef],
  );

  const applyImportedWorkspace = useCallback(
    (payload: ImportPayload) => {
      resetInteractionState();
      setNotes(payload.notes ?? []);
      setBlocks(payload.blocks ?? []);
      setTools(payload.tools ?? []);
      setUploads(payload.uploads ?? []);
      setOutputs(payload.outputs ?? []);
      setSelectedEvals(payload.evals ?? []);
      if (payload.theme) setTheme(payload.theme);
      setAgentSpecTemplate(payload.agentSpecTemplate ?? null);
      updateIdRefsFromImport(payload);

      const loadedConnections = payload.connections ?? [];
      setTimeout(() => {
        setConnections(loadedConnections);
      }, 50);
    },
    [
      resetInteractionState,
      setNotes,
      setBlocks,
      setTools,
      setUploads,
      setOutputs,
      setSelectedEvals,
      setAgentSpecTemplate,
      setTheme,
      updateIdRefsFromImport,
      setConnections,
    ],
  );

  const buildAgents = useCallback(
    (agents: AgentDefinition[], existingBlockCount: number) =>
      buildAgentsFromDefinition({
        agents,
        existingBlockCount,
        toolPalette,
        nextBlockIdRef,
        nextToolIdRef,
        nextConnectionIdRef,
      }),
    [nextBlockIdRef, nextConnectionIdRef, nextToolIdRef, toolPalette],
  );

  const handleGenerateAgentsFromJson = useCallback(() => {
    setAgentParseError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(agentJsonInput) as unknown;
    } catch {
      setAgentParseError("Invalid JSON: please check formatting.");
      return;
    }
    const parsedObject = parsed && typeof parsed === "object" ? (parsed as { agents?: unknown }) : null;
    const agentsRaw = parsedObject?.agents;
    const agents: AgentDefinition[] | null = Array.isArray(agentsRaw) ? (agentsRaw as AgentDefinition[]) : null;
    if (!agents || agents.length === 0) {
      setAgentParseError("No agents found in JSON (expected an `agents` array).");
      return;
    }

    setAgentSpecTemplate(captureAgentSpecTemplate(parsed));
    const { newBlocks, newTools, newConnections } = buildAgents(agents, blocks.length);

    setBlocks((prev) => [...prev, ...newBlocks]);
    setTools((prev) => [...prev, ...newTools]);
    setConnections((prev) => [...prev, ...newConnections]);
  }, [agentJsonInput, blocks.length, buildAgents, setAgentParseError, setAgentSpecTemplate, setBlocks, setConnections, setTools]);

  const handleUpload = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const src = JSON.parse(ev.target?.result as string);
          const template = captureAgentSpecTemplate(src);

          if (Array.isArray(src.blocks) && Array.isArray(src.connections)) {
            applyImportedWorkspace({
              notes: src.notes ?? [],
              blocks: src.blocks ?? [],
              tools: src.tools ?? [],
              uploads: src.uploads ?? [],
              outputs: src.outputs ?? [],
              connections: src.connections ?? [],
              evals: src.evals ?? [],
              theme: src.theme,
              agentSpecTemplate: src.agentSpecTemplate ?? template ?? null,
            });
            return;
          }

          const agentDefinitions = Array.isArray(src?.agents) ? src.agents : null;
          if (agentDefinitions?.length) {
            const { newBlocks, newTools, newConnections } = buildAgents(agentDefinitions, 0);
            applyImportedWorkspace({
              notes: [],
              blocks: newBlocks,
              tools: newTools,
              uploads: [],
              outputs: [],
              connections: newConnections,
              evals: [],
              agentSpecTemplate: template ?? null,
            });
            return;
          }

          const srcRecord = src as Record<string, unknown>;
          const planRecord =
            srcRecord.plan && typeof srcRecord.plan === "object" ? (srcRecord.plan as Record<string, unknown>) : null;
          const rawTriples = Array.isArray(srcRecord.triples)
            ? srcRecord.triples
            : Array.isArray(planRecord?.triples)
              ? planRecord?.triples
              : null;
          const triples = Array.isArray(rawTriples)
            ? rawTriples
                .map((item): PlanTriple | null => {
                  if (!item || typeof item !== "object") return null;
                  const record = item as Record<string, unknown>;
                  const from = record.from;
                  const to = record.to;
                  if (typeof from !== "string" || typeof to !== "string") return null;
                  const label = typeof record.label === "string" ? record.label : undefined;
                  const op: PlanOp = record.op === "brn" || record.op === "agg" || record.op === "seq" ? (record.op as PlanOp) : "seq";
                  return { from, to, op, label };
                })
                .filter((item): item is PlanTriple => item !== null)
            : null;
          if (!triples || triples.length === 0) {
            if (template) {
              setAgentSpecTemplate(template);
              setAgentParseError(null);
              return;
            }
            alert("Unrecognised JSON format");
            return;
          }

          const newBlocks: AgentBlock[] = [];
          const newConnections: Connection[] = [];
          const newTools: ToolNode[] = [];

          const agentIds = Array.from(new Set(triples.flatMap((t) => [t.from, t.to])));

          const outgoing: Record<string, string[]> = {};
          const incoming: Record<string, string[]> = {};
          agentIds.forEach((id) => {
            outgoing[id] = [];
            incoming[id] = [];
          });
          triples.forEach((t) => {
            if (outgoing[t.from] && incoming[t.to]) {
              outgoing[t.from].push(t.to);
              incoming[t.to].push(t.from);
            }
          });

          const levels: Record<string, number> = {};
          const visited = new Set<string>();

          const calcLevel = (nodeId: string): number => {
            if (levels[nodeId] !== undefined) return levels[nodeId];
            if (visited.has(nodeId)) return 0;
            visited.add(nodeId);

            const parents = incoming[nodeId] || [];
            if (parents.length === 0) {
              levels[nodeId] = 0;
            } else {
              levels[nodeId] = Math.max(...parents.map(calcLevel)) + 1;
            }
            return levels[nodeId];
          };

          agentIds.forEach(calcLevel);

          const nodesByLevel: Record<number, string[]> = {};
          agentIds.forEach((id) => {
            const level = levels[id] ?? 0;
            if (!nodesByLevel[level]) nodesByLevel[level] = [];
            nodesByLevel[level].push(id);
          });

          const HORIZONTAL_SPACING = 450;
          const VERTICAL_SPACING = 200;
          const BASE_X = 350;
          const BASE_Y = 300;

          agentIds.forEach((id, idx) => {
            const level = levels[id] ?? 0;
            const nodesAtLevel = nodesByLevel[level];
            const verticalIndex = nodesAtLevel.indexOf(id);
            const totalAtLevel = nodesAtLevel.length;
            const verticalOffset = (verticalIndex - (totalAtLevel - 1) / 2) * VERTICAL_SPACING;

            newBlocks.push({
              id: `block-${idx}`,
              x: BASE_X + level * HORIZONTAL_SPACING,
              y: BASE_Y + verticalOffset,
              sourceAgentId: id,
              name: id,
              description: "Imported from plan",
              inputCount: 1,
              outputCount: 1,
              inputRequired: [false],
              outputRequired: [false],
              inputNames: [],
              outputNames: [],
            });
          });

          triples.forEach((t, idx) => {
            const fromIdx = agentIds.indexOf(t.from);
            const toIdx = agentIds.indexOf(t.to);
            if (fromIdx === -1 || toIdx === -1) return;
            newConnections.push({
              id: `conn-${idx}`,
              from: { type: "block", id: `block-${fromIdx}`, port: 0 },
              to: { type: "block", id: `block-${toIdx}`, inputIndex: 0 },
            });
          });

          applyImportedWorkspace({
            notes: [],
            blocks: newBlocks,
            tools: newTools,
            uploads: [],
            outputs: [],
            connections: newConnections,
            evals: [],
            agentSpecTemplate: null,
          });
        } catch {
          alert("Invalid workflow file");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [applyImportedWorkspace, buildAgents, setAgentParseError, setAgentSpecTemplate],
  );

  const handleDownloadJson = useCallback(() => {
    if (agentSpecTemplate) {
      const spec = buildAgentRegistrySpec(agentSpecTemplate, blocks, connections, tools, TOOL_PORT_OFFSET);
      downloadWorkflow(spec);
      return;
    }

    const snapshot = {
      notes,
      blocks,
      tools,
      uploads,
      outputs,
      connections,
      evals: selectedEvals,
      theme,
      agentSpecTemplate,
      nextBlockId: nextBlockIdRef.current,
      nextToolId: nextToolIdRef.current,
      nextUploadId: nextUploadIdRef.current,
      nextOutputId: nextOutputIdRef.current,
      nextConnectionId: nextConnectionIdRef.current,
      nextNoteId: nextIdRef.current,
    };
    downloadWorkflow(snapshot);
  }, [
    agentSpecTemplate,
    blocks,
    connections,
    nextBlockIdRef,
    nextConnectionIdRef,
    nextIdRef,
    nextOutputIdRef,
    nextToolIdRef,
    nextUploadIdRef,
    notes,
    outputs,
    selectedEvals,
    theme,
    tools,
    uploads,
  ]);

  const persistWorkspace = useCallback(() => {
    const snapshot = {
      notes,
      blocks,
      tools,
      uploads,
      outputs,
      connections,
      theme,
      agentSpecTemplate,
      nextBlockId: nextBlockIdRef.current,
      nextToolId: nextToolIdRef.current,
      nextUploadId: nextUploadIdRef.current,
      nextOutputId: nextOutputIdRef.current,
      nextConnectionId: nextConnectionIdRef.current,
      nextNoteId: nextIdRef.current,
    };
    localStorage.setItem("c3an-workspace", JSON.stringify(snapshot));
  }, [
    agentSpecTemplate,
    blocks,
    connections,
    nextBlockIdRef,
    nextConnectionIdRef,
    nextIdRef,
    nextOutputIdRef,
    nextToolIdRef,
    nextUploadIdRef,
    notes,
    outputs,
    theme,
    tools,
    uploads,
  ]);

  return {
    handleGenerateAgentsFromJson,
    handleUpload,
    handleDownloadJson,
    applyImportedWorkspace,
    persistWorkspace,
  };
}

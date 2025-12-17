import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { AgentBlock, ToolNode } from "../types/workflow";
import type { Connection } from "../types/workflow";
import { clamp } from "./utils";
import { MAX_IO, MIN_IO, TOOL_PORT_OFFSET } from "./constants";

type Params = {
  blocks: AgentBlock[];
  setBlocks: Dispatch<SetStateAction<AgentBlock[]>>;
  setTools: Dispatch<SetStateAction<ToolNode[]>>;
  setConnections: Dispatch<SetStateAction<Connection[]>>;
};

export function useWorkflowIO({ blocks, setBlocks, setTools, setConnections }: Params) {
  const resizeRequired = useCallback((arr: boolean[], count: number) => {
    const next = arr.slice(0, count);
    while (next.length < count) next.push(false);
    return next;
  }, []);

  const clampNames = useCallback((arr: string[] | undefined, count: number) => (arr ?? []).slice(0, count), []);

  const recalcBlockPorts = useCallback(
    (conns: Connection[], blocksState: AgentBlock[]) => {
      const maxInputs: Record<string, number> = {};
      const maxOutputs: Record<string, number> = {};
      conns.forEach((conn) => {
        if (conn.to.type === "block") {
          const idx = conn.to.inputIndex ?? 0;
          if (idx < TOOL_PORT_OFFSET) {
            maxInputs[conn.to.id] = Math.max(maxInputs[conn.to.id] ?? -1, idx);
          }
        }
        if (conn.from.type === "block") {
          maxOutputs[conn.from.id] = Math.max(maxOutputs[conn.from.id] ?? -1, conn.from.port);
        }
      });
      return blocksState.map((b) => {
        const desiredInputs = Math.max(
          b.inputCount,
          clamp((maxInputs[b.id] ?? -1) + 1, MIN_IO, MAX_IO),
        );
        const desiredOutputs = Math.max(
          b.outputCount,
          clamp((maxOutputs[b.id] ?? -1) + 1, MIN_IO, MAX_IO),
        );
        if (b.inputCount === desiredInputs && b.outputCount === desiredOutputs) return b;
        return {
          ...b,
          inputCount: desiredInputs,
          outputCount: desiredOutputs,
          inputRequired: resizeRequired(b.inputRequired, desiredInputs),
          outputRequired: resizeRequired(b.outputRequired, desiredOutputs),
          inputNames: clampNames(b.inputNames, desiredInputs),
          outputNames: clampNames(b.outputNames, desiredOutputs),
          presetId: "custom",
        };
      });
    },
    [clampNames, resizeRequired],
  );

  const applyBlockIO = useCallback(
    (
      blockId: string,
      nextInputCount: number,
      nextOutputCount: number,
      extra?: Partial<Pick<AgentBlock, "name" | "description" | "presetId">>,
    ) => {
      const targetBlock = blocks.find((b) => b.id === blockId);
      if (!targetBlock) return;
      const newInputs = clamp(nextInputCount, MIN_IO, MAX_IO);
      const newOutputs = clamp(nextOutputCount, MIN_IO, MAX_IO);

      setBlocks((prev) =>
        prev.map((b) =>
          b.id === blockId
            ? {
                ...b,
                inputCount: newInputs,
                outputCount: newOutputs,
                inputRequired: resizeRequired(b.inputRequired, newInputs),
                outputRequired: resizeRequired(b.outputRequired, newOutputs),
                inputNames: clampNames(b.inputNames, newInputs),
                outputNames: clampNames(b.outputNames, newOutputs),
                ...extra,
              }
            : b,
        ),
      );

      setConnections((prev) => {
        let next = prev.filter(
          (conn) => !(conn.from.type === "block" && conn.from.id === blockId && conn.from.port >= newOutputs),
        );

        next = next.filter((conn) => {
          if (conn.to.type === "block" && conn.to.id === blockId) {
            const idx = conn.to.inputIndex ?? 0;
            if (idx >= TOOL_PORT_OFFSET) return true;
            return idx < newInputs;
          }
          return true;
        });

        return next;
      });
    },
    [blocks, clampNames, resizeRequired, setBlocks, setConnections],
  );

  const changeBlockInputs = useCallback(
    (blockId: string, delta: number) => {
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;
      const newInputs = clamp(block.inputCount + delta, MIN_IO, MAX_IO);
      applyBlockIO(blockId, newInputs, block.outputCount, { presetId: "custom" });
    },
    [applyBlockIO, blocks],
  );

  const changeBlockOutputs = useCallback(
    (blockId: string, delta: number) => {
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;
      const newOutputs = clamp(block.outputCount + delta, MIN_IO, MAX_IO);
      applyBlockIO(blockId, block.inputCount, newOutputs, { presetId: "custom" });
    },
    [applyBlockIO, blocks],
  );

  const toggleInputRequired = useCallback((blockId: string, index: number) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        if (index < 0 || index >= b.inputCount) return b;
        const mandatoryCount = b.mandatoryInputCount ?? 0;
        if (index < mandatoryCount) return b;
        const next = [...b.inputRequired];
        next[index] = !next[index];
        return { ...b, inputRequired: next };
      }),
    );
  }, [setBlocks]);

  const toggleOutputRequired = useCallback((blockId: string, index: number) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        if (index < 0 || index >= b.outputCount) return b;
        const mandatoryCount = b.mandatoryOutputCount ?? 0;
        if (index < mandatoryCount) return b;
        const next = [...b.outputRequired];
        next[index] = !next[index];
        return { ...b, outputRequired: next };
      }),
    );
  }, [setBlocks]);

  const toggleToolInputRequired = useCallback((toolId: string, index: number) => {
    setTools((prev) =>
      prev.map((t) => {
        if (t.id !== toolId) return t;
        if (index < 0 || index >= t.inputCount) return t;
        const mandatoryCount = t.mandatoryInputCount ?? 0;
        if (index < mandatoryCount) return t;
        const next = [...t.inputRequired];
        next[index] = !next[index];
        return { ...t, inputRequired: next };
      }),
    );
  }, [setTools]);

  const toggleToolOutputRequired = useCallback((toolId: string, index: number) => {
    setTools((prev) =>
      prev.map((t) => {
        if (t.id !== toolId) return t;
        if (index < 0 || index >= t.outputCount) return t;
        const mandatoryCount = t.mandatoryOutputCount ?? 0;
        if (index < mandatoryCount) return t;
        const next = [...t.outputRequired];
        next[index] = !next[index];
        return { ...t, outputRequired: next };
      }),
    );
  }, [setTools]);

  return {
    applyBlockIO,
    changeBlockInputs,
    changeBlockOutputs,
    clampNames,
    recalcBlockPorts,
    resizeRequired,
    toggleInputRequired,
    toggleOutputRequired,
    toggleToolInputRequired,
    toggleToolOutputRequired,
  };
}

import { useCallback } from "react";
import type { Dispatch, MutableRefObject, PointerEvent as ReactPointerEvent, SetStateAction } from "react";
import type { AgentBlock, AnchorPoint, Connection, LinkSource, LinkTarget } from "../types/workflow";
import { MAX_IO, TOOL_PORT_OFFSET } from "./constants";
import type { HoveredInput } from "./useLinkingState";

type Params = {
  blocks: AgentBlock[];
  connections: Connection[];
  setBlocks: Dispatch<SetStateAction<AgentBlock[]>>;
  setConnections: Dispatch<SetStateAction<Connection[]>>;
  getInputAnchor: (target: LinkTarget) => AnchorPoint | null;
  getOutputAnchor: (source: LinkSource) => AnchorPoint | null;
  toWorldPoint: (clientX: number, clientY: number) => { x: number; y: number } | null;
  applyBlockIO: (blockId: string, nextInputCount: number, nextOutputCount: number, extra?: { presetId?: string }) => void;
  recalcBlockPorts: (conns: Connection[], blocksState: AgentBlock[]) => AgentBlock[];
  nextConnectionIdRef: MutableRefObject<number>;
  hoveredBlockId: string | null;
  linking: { origin: "output"; from: LinkSource; current: { x: number; y: number } } | { origin: "input"; target: LinkTarget; current: { x: number; y: number } } | null;
  setLinking: Dispatch<SetStateAction<Params["linking"]>>;
  hoveredInput: HoveredInput;
  setHoveredInput: Dispatch<SetStateAction<HoveredInput>>;
  hoveredOutput: LinkSource | null;
  setHoveredOutput: Dispatch<SetStateAction<LinkSource | null>>;
  linkingRef: MutableRefObject<boolean>;
};

export function useLinkingHandlers({
  blocks,
  connections,
  setBlocks,
  setConnections,
  getInputAnchor,
  getOutputAnchor,
  toWorldPoint,
  applyBlockIO,
  recalcBlockPorts,
  nextConnectionIdRef,
  hoveredBlockId,
  linking,
  setLinking,
  hoveredInput,
  setHoveredInput,
  hoveredOutput,
  setHoveredOutput,
  linkingRef,
}: Params) {
  const handleInputEnter = useCallback(
    (target: { type: "block" | "tool" | "output"; id: string; inputIndex?: number }) => () => {
      if (linking?.origin === "output" && linking.from.type === "tool" && (target.inputIndex ?? 0) < TOOL_PORT_OFFSET) {
        return;
      }
      if (linking) setHoveredInput(target);
    },
    [linking, setHoveredInput],
  );

  const handleInputLeave = useCallback(
    (target: { type: "block" | "tool" | "output"; id: string; inputIndex?: number }) => () => {
      if (
        hoveredInput &&
        hoveredInput.type === target.type &&
        hoveredInput.id === target.id &&
        (hoveredInput.inputIndex ?? null) === (target.inputIndex ?? null)
      ) {
        setHoveredInput(null);
      }
    },
    [hoveredInput, setHoveredInput],
  );

  const handleOutputEnter = useCallback(
    (source: LinkSource) => () => {
      if (linking) setHoveredOutput(source);
    },
    [linking, setHoveredOutput],
  );

  const handleOutputLeave = useCallback(
    (source: LinkSource) => () => {
      if (
        hoveredOutput &&
        hoveredOutput.type === source.type &&
        hoveredOutput.id === source.id &&
        hoveredOutput.port === source.port
      ) {
        setHoveredOutput(null);
      }
    },
    [hoveredOutput, setHoveredOutput],
  );

  const handleConnectionPointerDown = useCallback(
    (conn: Connection) => (event: ReactPointerEvent<SVGPathElement>) => {
      event.stopPropagation();
      event.preventDefault();
      const removeAndMaybeLink = (shouldLink: boolean) => {
        setConnections((prev) => {
          const next = prev.filter((c) => c.id !== conn.id);
          setBlocks((blocksState) => recalcBlockPorts(next, blocksState));
          return next;
        });
        if (!shouldLink) return;
        const startAnchor = getOutputAnchor(conn.from);
        const world = toWorldPoint(event.clientX, event.clientY);
        const currentPoint = world ?? startAnchor ?? { x: 0, y: 0 };
        linkingRef.current = true;
        setLinking({ origin: "output", from: conn.from, current: currentPoint });
        setHoveredInput(null);
        setHoveredOutput(null);
      };

      if (event.detail >= 2) {
        removeAndMaybeLink(true);
        return;
      }

      removeAndMaybeLink(false);
    },
    [
      getOutputAnchor,
      linkingRef,
      recalcBlockPorts,
      setBlocks,
      setConnections,
      setHoveredInput,
      setHoveredOutput,
      setLinking,
      toWorldPoint,
    ],
  );

  const startLinkingFromInput = useCallback(
    (target: LinkTarget) => (event: ReactPointerEvent<HTMLDivElement | HTMLButtonElement>) => {
      event.stopPropagation();
      event.preventDefault();
      if (event.detail >= 2) return;
      const anchor = getInputAnchor(target);
      if (!anchor) return;
      linkingRef.current = true;
      setLinking({ origin: "input", target, current: anchor });
    },
    [getInputAnchor, linkingRef, setLinking],
  );

  const startLinkingFromOutput = useCallback(
    (from: LinkSource) => (event: ReactPointerEvent<HTMLButtonElement | HTMLDivElement>) => {
      event.stopPropagation();
      event.preventDefault();
      if (event.detail >= 2) return;
      setHoveredInput(null);
      setHoveredOutput(null);
      let effectiveFrom = from;
      if (from.type === "block") {
        const ports = connections
          .filter((conn) => conn.from.type === "block" && conn.from.id === from.id)
          .map((conn) => conn.from.port);
        const hasPort = ports.includes(from.port);
        const maxPort = ports.reduce((max, p) => Math.max(max, p), -1);
        const nextPort = Math.min(MAX_IO - 1, Math.max(maxPort + 1, from.port));
        if (hasPort) {
          effectiveFrom = { ...from, port: nextPort };
        }
      }
      const computeOutputAnchorWithPreview = (block: AgentBlock, port: number): AnchorPoint => {
        const width = 220;
        const baseHeight = 120;
        const baseInputs = Math.max(1, block.inputCount);
        const baseOutputs = Math.max(1, block.outputCount);
        const maxConnectedInput = connections
          .filter(
            (conn) =>
              conn.to.type === "block" && conn.to.id === block.id && (conn.to.inputIndex ?? -1) < TOOL_PORT_OFFSET,
          )
          .reduce((max, conn) => Math.max(max, conn.to.inputIndex ?? 0), -1);
        const inputSlots = Math.min(MAX_IO, Math.max(baseInputs, maxConnectedInput + 1));
        const maxConnectedOutput = connections
          .filter((conn) => conn.from.type === "block" && conn.from.id === block.id)
          .reduce((max, conn) => Math.max(max, conn.from.port), -1);
        const hasOutputConnections = maxConnectedOutput >= 0;
        const desiredOutputs = Math.max(baseOutputs, maxConnectedOutput + 1);
        const effectiveOutputs = Math.max(1, desiredOutputs);
        const outputSlots = Math.min(MAX_IO, hasOutputConnections ? effectiveOutputs + 1 : effectiveOutputs);
        const maxSlots = Math.max(inputSlots, outputSlots);
        const topPadding = 18;
        const slotGap = 28;
        const height =
          maxSlots > 1 ? Math.max(baseHeight, topPadding * 2 + slotGap * (maxSlots - 1)) : baseHeight;
        const count = outputSlots;
        if (count <= 1) {
          return { x: block.x + width, y: block.y + height / 2, dir: "right" };
        }
        const gap = (height - topPadding * 2) / (count - 1);
        const idx = Math.min(count - 1, Math.max(0, port));
        return { x: block.x + width, y: block.y + topPadding + idx * gap, dir: "right" };
      };

      let anchor = getOutputAnchor(effectiveFrom);
      if (!anchor && effectiveFrom.type === "block") {
        const block = blocks.find((b) => b.id === effectiveFrom.id);
        if (block) {
          anchor = computeOutputAnchorWithPreview(block, effectiveFrom.port);
        }
      }
      if (!anchor) return;
      linkingRef.current = true;
      setLinking({ origin: "output", from: effectiveFrom, current: anchor });
    },
    [blocks, connections, getOutputAnchor, linkingRef, setHoveredInput, setHoveredOutput, setLinking],
  );

  const moveLinking = useCallback(
    (event: ReactPointerEvent<HTMLDivElement | HTMLButtonElement>) => {
      if (!linking) return;
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!world) return;
      setLinking((prev) => (prev ? { ...prev, current: world } : prev));
    },
    [linking, setLinking, toWorldPoint],
  );

  const finalizeLinking = useCallback(
    (overrideTarget?: LinkTarget) => {
      if (!linking) return;
      const autoToolTarget =
        linking.origin === "output" && linking.from.type === "tool" && hoveredBlockId
          ? { type: "block" as const, id: hoveredBlockId, inputIndex: TOOL_PORT_OFFSET }
          : null;
      const target =
        overrideTarget ??
        (linking.origin === "output"
          ? linking.from.type === "tool"
            ? autoToolTarget || hoveredInput
            : hoveredInput
          : linking.target);
      const from = linking.origin === "output" ? linking.from : hoveredOutput;

      if (target && from && !(target.type === from.type && target.id === from.id)) {
        const isToolPortTarget = target.type === "block" && (target.inputIndex ?? 0) >= TOOL_PORT_OFFSET;
        if (isToolPortTarget && from.type !== "tool") {
          setLinking(null);
          linkingRef.current = false;
          setHoveredInput(null);
          setHoveredOutput(null);
          return;
        }
        if (from.type === "tool" && target.type === "block" && (target.inputIndex ?? 0) < TOOL_PORT_OFFSET) {
          setLinking(null);
          linkingRef.current = false;
          setHoveredInput(null);
          setHoveredOutput(null);
          return;
        }

        const isDuplicate = connections.some((conn) => {
          const sameSource =
            conn.from.type === from.type && conn.from.id === from.id && conn.from.port === from.port;
          const sameTarget =
            conn.to.type === target.type &&
            conn.to.id === target.id &&
            (conn.to.inputIndex ?? 0) === (target.inputIndex ?? 0);
          return sameSource && sameTarget;
        });

        if (isDuplicate) {
          setLinking(null);
          linkingRef.current = false;
          setHoveredInput(null);
          setHoveredOutput(null);
          return;
        }

        const id = nextConnectionIdRef.current++;
        const targetBlock = target.type === "block" ? blocks.find((b) => b.id === target.id) : null;
        const isBlockToolTarget = target.type === "block" && (target.inputIndex ?? -1) >= TOOL_PORT_OFFSET;
        const sourceBlock = from.type === "block" ? blocks.find((b) => b.id === from.id) : null;
        if (sourceBlock && from.type === "block" && from.port >= sourceBlock.outputCount && sourceBlock.outputCount < MAX_IO) {
          applyBlockIO(sourceBlock.id, sourceBlock.inputCount, sourceBlock.outputCount + 1, { presetId: "custom" });
        }
        if (
          target.type === "block" &&
          targetBlock &&
          !isBlockToolTarget &&
          (target.inputIndex ?? 0) >= targetBlock.inputCount &&
          targetBlock.inputCount < MAX_IO
        ) {
          applyBlockIO(targetBlock.id, targetBlock.inputCount + 1, targetBlock.outputCount, { presetId: "custom" });
        }
        setConnections((prev) => {
          if (isBlockToolTarget) {
            const desiredSlot =
              TOOL_PORT_OFFSET + Math.max(0, (target.inputIndex ?? TOOL_PORT_OFFSET) - TOOL_PORT_OFFSET);
            const slot = Math.min(TOOL_PORT_OFFSET + MAX_IO - 1, desiredSlot);

            const wouldBeDuplicate = prev.some(
              (conn) =>
                conn.from.type === from.type &&
                conn.from.id === from.id &&
                conn.from.port === from.port &&
                conn.to.type === target.type &&
                conn.to.id === target.id &&
                (conn.to.inputIndex ?? 0) === slot,
            );

            if (wouldBeDuplicate) {
              return prev;
            }

            const withoutTool = prev.filter((conn) => !(conn.from.type === "tool" && conn.from.id === from.id));
            const withoutDuplicate = withoutTool.filter(
              (conn) =>
                !(
                  conn.from.type === from.type &&
                  conn.from.id === from.id &&
                  conn.to.type === target.type &&
                  conn.to.id === target.id &&
                  (conn.to.inputIndex ?? 0) === slot
                ),
            );
            return [...withoutDuplicate, { id: `conn-${id}`, from, to: { ...target, inputIndex: slot } }];
          }
          const targetSlot = target.inputIndex ?? 0;

          const wouldBeDuplicate = prev.some(
            (conn) =>
              conn.from.type === from.type &&
              conn.from.id === from.id &&
              conn.from.port === from.port &&
              conn.to.type === target.type &&
              conn.to.id === target.id &&
              (conn.to.inputIndex ?? 0) === targetSlot,
          );

          if (wouldBeDuplicate) {
            return prev;
          }

          const next = [
            ...prev.filter(
              (conn) =>
                !(
                  conn.to.type === target.type &&
                  conn.to.id === target.id &&
                  (conn.to.inputIndex ?? 0) === targetSlot
                ),
            ),
            { id: `conn-${id}`, from, to: target },
          ];
          setBlocks((blocksState) => recalcBlockPorts(next, blocksState));
          return next;
        });
      }
      setLinking(null);
      linkingRef.current = false;
      setHoveredInput(null);
      setHoveredOutput(null);
    },
    [
      applyBlockIO,
      blocks,
      connections,
      hoveredBlockId,
      hoveredInput,
      hoveredOutput,
      linking,
      linkingRef,
      nextConnectionIdRef,
      recalcBlockPorts,
      setBlocks,
      setConnections,
      setHoveredInput,
      setHoveredOutput,
      setLinking,
    ],
  );

  return {
    linking,
    hoveredInput,
    hoveredOutput,
    handleInputEnter,
    handleInputLeave,
    handleOutputEnter,
    handleOutputLeave,
    handleConnectionPointerDown,
    startLinkingFromInput,
    startLinkingFromOutput,
    moveLinking,
    finalizeLinking,
    setHoveredInput,
    setHoveredOutput,
  };
}

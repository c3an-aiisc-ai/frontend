import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { AgentBlock, Selection, ToolNode } from "../shared/types";

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

type DraggableItem = { id: string; x: number; y: number };
type PendingDrag = { id: string; x: number; y: number };

export function useCanvasDragHandlers(args: {
  blocks: AgentBlock[];
  tools: ToolNode[];
  setBlocks: SetState<AgentBlock[]>;
  setTools: SetState<ToolNode[]>;
  setSelected: SetState<Selection>;
  draggingBlockId: string | null;
  draggingToolId: string | null;
  setDraggingBlockId: SetState<string | null>;
  setDraggingToolId: SetState<string | null>;
  blockDragOffsetRef: React.MutableRefObject<{ x: number; y: number }>;
  toolDragOffsetRef: React.MutableRefObject<{ x: number; y: number }>;
  linkingRef: React.MutableRefObject<boolean>;
  toWorldPoint: (clientX: number, clientY: number) => { x: number; y: number } | null;
  toWorldPointDuringDrag?: (clientX: number, clientY: number) => { x: number; y: number } | null;
}) {
  const {
    blocks,
    tools,
    setBlocks,
    setTools,
    setSelected,
    draggingBlockId,
    draggingToolId,
    setDraggingBlockId,
    setDraggingToolId,
    blockDragOffsetRef,
    toolDragOffsetRef,
    linkingRef,
    toWorldPoint,
    toWorldPointDuringDrag,
  } = args;

  const toWorldPointDuringDragRef = useRef<typeof toWorldPointDuringDrag | null>(null);
  const blockDragPendingRef = useRef<PendingDrag | null>(null);
  const toolDragPendingRef = useRef<PendingDrag | null>(null);
  const blockDragRafRef = useRef<number | null>(null);
  const toolDragRafRef = useRef<number | null>(null);

  useEffect(() => {
    toWorldPointDuringDragRef.current = toWorldPointDuringDrag ?? null;
  }, [toWorldPointDuringDrag]);

  useEffect(() => {
    const blockRaf = blockDragRafRef;
    const toolRaf = toolDragRafRef;
    return () => {
      if (blockRaf.current !== null) cancelAnimationFrame(blockRaf.current);
      if (toolRaf.current !== null) cancelAnimationFrame(toolRaf.current);
    };
  }, []);

  const queueDragUpdate = useCallback(
    <T extends DraggableItem>(
      id: string,
      x: number,
      y: number,
      setItem: SetState<T[]>,
      pendingRef: React.MutableRefObject<PendingDrag | null>,
      rafRef: React.MutableRefObject<number | null>
    ) => {
      const pending = pendingRef.current;
      if (pending && pending.id === id && pending.x === x && pending.y === y) return;
      pendingRef.current = { id, x, y };
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const next = pendingRef.current;
        if (!next) return;
        setItem((prev) =>
          prev.map((item) =>
            item.id === next.id
              ? item.x === next.x && item.y === next.y
                ? item
                : { ...item, x: next.x, y: next.y }
              : item
          )
        );
      });
    },
    []
  );

  const flushDragUpdate = useCallback(
    <T extends DraggableItem>(
      setItem: SetState<T[]>,
      pendingRef: React.MutableRefObject<PendingDrag | null>,
      rafRef: React.MutableRefObject<number | null>
    ) => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const next = pendingRef.current;
      if (!next) return;
      pendingRef.current = null;
      setItem((prev) =>
        prev.map((item) =>
          item.id === next.id
            ? item.x === next.x && item.y === next.y
              ? item
              : { ...item, x: next.x, y: next.y }
            : item
        )
      );
    },
    []
  );

  const blockDrag = {
    onPointerDown:
      (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement | null;
        if (linkingRef.current || target?.closest("[data-connector]")) return;
        e.stopPropagation();
        e.preventDefault();
        setSelected({ type: "block", id } as Selection);
        const item = blocks.find((block) => block.id === id);
        const world = toWorldPoint(e.clientX, e.clientY);
        if (!item || !world) return;
        blockDragOffsetRef.current = { x: world.x - item.x, y: world.y - item.y };
        blockDragPendingRef.current = null;
        if (blockDragRafRef.current !== null) {
          cancelAnimationFrame(blockDragRafRef.current);
          blockDragRafRef.current = null;
        }
        setDraggingBlockId(id);
        e.currentTarget.setPointerCapture?.(e.pointerId);
      },
    onPointerMove:
      (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => {
        if (draggingBlockId !== id || linkingRef.current) return;
        if (e.buttons === 0) {
          flushDragUpdate(setBlocks, blockDragPendingRef, blockDragRafRef);
          setDraggingBlockId((current) => (current === id ? null : current));
          blockDragOffsetRef.current = { x: 0, y: 0 };
          e.currentTarget.releasePointerCapture?.(e.pointerId);
          return;
        }
        const world = (toWorldPointDuringDragRef.current ?? toWorldPoint)(e.clientX, e.clientY);
        if (!world) return;
        e.preventDefault();
        queueDragUpdate(
          id,
          world.x - blockDragOffsetRef.current.x,
          world.y - blockDragOffsetRef.current.y,
          setBlocks,
          blockDragPendingRef,
          blockDragRafRef
        );
      },
    onPointerUp:
      (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => {
        flushDragUpdate(setBlocks, blockDragPendingRef, blockDragRafRef);
        setDraggingBlockId((current) => (current === id ? null : current));
        blockDragOffsetRef.current = { x: 0, y: 0 };
        e.currentTarget.releasePointerCapture?.(e.pointerId);
      },
  };

  const toolDrag = {
    onPointerDown:
      (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement | null;
        if (linkingRef.current || target?.closest("[data-connector]")) return;
        e.stopPropagation();
        e.preventDefault();
        setSelected({ type: "tool", id } as Selection);
        const item = tools.find((tool) => tool.id === id);
        const world = toWorldPoint(e.clientX, e.clientY);
        if (!item || !world) return;
        toolDragOffsetRef.current = { x: world.x - item.x, y: world.y - item.y };
        toolDragPendingRef.current = null;
        if (toolDragRafRef.current !== null) {
          cancelAnimationFrame(toolDragRafRef.current);
          toolDragRafRef.current = null;
        }
        setDraggingToolId(id);
        e.currentTarget.setPointerCapture?.(e.pointerId);
      },
    onPointerMove:
      (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => {
        if (draggingToolId !== id || linkingRef.current) return;
        if (e.buttons === 0) {
          flushDragUpdate(setTools, toolDragPendingRef, toolDragRafRef);
          setDraggingToolId((current) => (current === id ? null : current));
          toolDragOffsetRef.current = { x: 0, y: 0 };
          e.currentTarget.releasePointerCapture?.(e.pointerId);
          return;
        }
        const world = (toWorldPointDuringDragRef.current ?? toWorldPoint)(e.clientX, e.clientY);
        if (!world) return;
        e.preventDefault();
        queueDragUpdate(
          id,
          world.x - toolDragOffsetRef.current.x,
          world.y - toolDragOffsetRef.current.y,
          setTools,
          toolDragPendingRef,
          toolDragRafRef
        );
      },
    onPointerUp:
      (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => {
        flushDragUpdate(setTools, toolDragPendingRef, toolDragRafRef);
        setDraggingToolId((current) => (current === id ? null : current));
        toolDragOffsetRef.current = { x: 0, y: 0 };
        e.currentTarget.releasePointerCapture?.(e.pointerId);
      },
  };

  return { blockDrag, toolDrag };
}

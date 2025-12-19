import { useCallback } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { AgentBlock, Selection, ToolNode } from "../../../shared/types";

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

type DraggableItem = { id: string; x: number; y: number };

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
  } = args;

  const makeDragHandlers = useCallback(
    <T extends DraggableItem>(
      type: NonNullable<Selection>["type"],
      getItem: (id: string) => DraggableItem | undefined,
      setItem: SetState<T[]>,
      setDragging: SetState<string | null>,
      offsetRef: React.MutableRefObject<{ x: number; y: number }>,
      getDraggingId: () => string | null
    ) => ({
      onPointerDown:
        (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => {
          const target = e.target as HTMLElement | null;
          if (linkingRef.current || target?.closest("[data-connector]")) return;
          e.stopPropagation();
          e.preventDefault();
          setSelected({ type, id } as Selection);
          const item = getItem(id);
          const world = toWorldPoint(e.clientX, e.clientY);
          if (!item || !world) return;
          offsetRef.current = { x: world.x - item.x, y: world.y - item.y };
          setDragging(id);
          e.currentTarget.setPointerCapture?.(e.pointerId);
        },
      onPointerMove:
        (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => {
          if (getDraggingId() !== id) return;
          if (linkingRef.current) return;
          const world = toWorldPoint(e.clientX, e.clientY);
          if (!world) return;
          setItem((prev) =>
            prev.map((item) =>
              item.id === id
                ? { ...item, x: world.x - offsetRef.current.x, y: world.y - offsetRef.current.y }
                : item
            )
          );
        },
      onPointerUp:
        (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => {
          setDragging((current) => (current === id ? null : current));
          offsetRef.current = { x: 0, y: 0 };
          e.currentTarget.releasePointerCapture?.(e.pointerId);
        },
    }),
    [linkingRef, setSelected, toWorldPoint]
  );

  const blockDrag = makeDragHandlers(
    "block",
    (id) => blocks.find((b) => b.id === id),
    setBlocks,
    setDraggingBlockId,
    blockDragOffsetRef,
    () => draggingBlockId
  );

  const toolDrag = makeDragHandlers(
    "tool",
    (id) => tools.find((t) => t.id === id),
    setTools,
    setDraggingToolId,
    toolDragOffsetRef,
    () => draggingToolId
  );

  return { blockDrag, toolDrag };
}

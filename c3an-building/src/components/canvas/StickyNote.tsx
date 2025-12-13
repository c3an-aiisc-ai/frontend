// =============================================================================
// Sticky Note Component - Simple note block on canvas
// =============================================================================

import type { PointerEvent as ReactPointerEvent } from "react";
import type { Note } from "../../types";

type Props = {
  note: Note;
  isActive: boolean;
  isDragging: boolean;
  onPointerDown: (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => void;
  onRemove: (id: string) => void;
};

export default function StickyNote({
  note,
  isActive,
  isDragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onRemove,
}: Props) {
  return (
    <div className="absolute" style={{ left: note.x, top: note.y }}>
      <div
        className={`relative w-48 rounded border border-yellow-200 bg-yellow-100/90 p-3 shadow ${
          isDragging || isActive ? "ring-2 ring-yellow-300" : ""
        } cursor-grab active:cursor-grabbing select-none`}
        data-note
        onPointerDown={onPointerDown(note.id)}
        onPointerMove={onPointerMove(note.id)}
        onPointerUp={onPointerUp(note.id)}
      >
        {/* Remove button */}
        <button
          className={`absolute -right-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white text-xs shadow-md transition-all duration-150 ${
            isActive
              ? "scale-100 opacity-100"
              : "scale-75 opacity-0 pointer-events-none"
          }`}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onClick={() => onRemove(note.id)}
          aria-label="Remove note"
        >
          ×
        </button>

        <div className="text-sm font-semibold text-slate-800">{note.text}</div>
        <p className="mt-1 text-xs text-slate-700">
          Add your quick reminder here.
        </p>
      </div>
    </div>
  );
}

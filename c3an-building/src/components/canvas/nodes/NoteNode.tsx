import type { PointerEventHandler } from "react";
import type { Note } from "../../../types/workflow";
import FloatingRemoveButton from "../../ui/FloatingRemoveButton";

type Props = {
  note: Note;
  isSelected: boolean;
  isDragging: boolean;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerUp: PointerEventHandler<HTMLDivElement>;
  onRemove: () => void;
};

export default function NoteNode({
  note,
  isSelected,
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
          isSelected || isDragging ? "ring-2 ring-yellow-300" : ""
        } cursor-grab active:cursor-grabbing select-none`}
        data-note
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <FloatingRemoveButton
          visible={isSelected}
          ariaLabel="Remove note"
          size="sm"
          onClick={onRemove}
        />
        <div className="text-sm font-semibold text-slate-800">{note.text}</div>
        <p className="mt-1 text-xs text-slate-700">Add your quick reminder here.</p>
      </div>
    </div>
  );
}

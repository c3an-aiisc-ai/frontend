import type { PointerEventHandler } from "react";
import type { AgentBlock, BlockHandles, LinkSource, LinkTarget } from "../../../types/workflow";
import FloatingRemoveButton from "../../ui/FloatingRemoveButton";
import HandleDot from "../HandleDot";

type Props = {
  block: AgentBlock;
  handles: BlockHandles;
  isActive: boolean;
  showConnections: boolean;
  toolCount: number;
  mode: string | null;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onRemove: () => void;
  onOpenDetails: () => void;
  onClearSelection: () => void;
  onBlockPointerDown: PointerEventHandler<HTMLDivElement>;
  onBlockPointerMove: PointerEventHandler<HTMLDivElement>;
  onBlockPointerUp: PointerEventHandler<HTMLDivElement>;
  startLinkingFromInput: (target: LinkTarget) => PointerEventHandler<HTMLDivElement>;
  startLinkingFromOutput: (source: LinkSource) => PointerEventHandler<HTMLDivElement>;
  handleInputEnter: (target: LinkTarget) => PointerEventHandler<HTMLDivElement>;
  handleInputLeave: (target: LinkTarget) => PointerEventHandler<HTMLDivElement>;
  handleOutputEnter: (source: LinkSource) => PointerEventHandler<HTMLDivElement>;
  handleOutputLeave: (source: LinkSource) => PointerEventHandler<HTMLDivElement>;
  onMoveLinking: PointerEventHandler<HTMLDivElement>;
  finalizeLinking: (overrideTarget?: LinkTarget) => void;
  changeBlockInputs: (blockId: string, delta: number) => void;
  changeBlockOutputs: (blockId: string, delta: number) => void;
};

export default function BlockNode({
  block,
  handles,
  isActive,
  showConnections,
  toolCount,
  mode,
  onPointerEnter,
  onPointerLeave,
  onRemove,
  onOpenDetails,
  onClearSelection,
  onBlockPointerDown,
  onBlockPointerMove,
  onBlockPointerUp,
  startLinkingFromInput,
  startLinkingFromOutput,
  handleInputEnter,
  handleInputLeave,
  handleOutputEnter,
  handleOutputLeave,
  onMoveLinking,
  finalizeLinking,
  changeBlockInputs,
  changeBlockOutputs,
}: Props) {
  return (
    <div
      className="absolute"
      style={{ left: block.x, top: block.y }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <div
        className={`relative rounded-lg border border-slate-200 bg-white/90 shadow-md backdrop-blur-sm transition-all duration-150 w-[220px] px-3 pt-2 pb-3 scale-[0.97] min-h-[120px] ${
          showConnections ? "ring-2 ring-emerald-300" : ""
        } cursor-grab active:cursor-grabbing select-none`}
        data-block
        style={{ width: 220, height: handles.height }}
        onPointerDown={onBlockPointerDown}
        onPointerMove={onBlockPointerMove}
        onPointerUp={onBlockPointerUp}
        onDoubleClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          onClearSelection();
        }}
      >
        <FloatingRemoveButton
          visible={isActive}
          ariaLabel="Remove block"
          onClick={onRemove}
        />
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold text-slate-900">{block.name}</p>
            {mode && <p className="text-[11px] text-slate-600 leading-snug">Mode: {mode}</p>}
          </div>
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
            Agent
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-700">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 ring-1 ring-emerald-100">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            {handles.inputAnchors.length} inputs
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-1 ring-1 ring-sky-100">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
            {handles.outputAnchors.length} outputs
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 ring-1 ring-indigo-100">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
            {toolCount} tools
          </span>
          <button
            className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm"
            onPointerDown={(event) => {
              event.stopPropagation();
              event.preventDefault();
            }}
            onClick={(event) => {
              event.stopPropagation();
              onOpenDetails();
            }}
          >
            Details
          </button>
        </div>
      </div>

      {handles.toolAnchors.map((toolAnchor, idx) => (
        <div
          key={toolAnchor.slot}
          className={`absolute -translate-x-1/2 flex h-8 w-8 items-center justify-center transition-all duration-150 z-10 ${
            showConnections ? "opacity-100 scale-100" : "opacity-0 scale-75"
          }`}
          style={{
            top: toolAnchor.anchor.y - block.y - 12,
            left: toolAnchor.anchor.x - block.x - 12,
            width: 24,
            height: 24,
            pointerEvents: "auto",
          }}
          data-input
          data-connector
          onPointerEnter={handleInputEnter({
            type: "block",
            id: block.id,
            inputIndex: toolAnchor.slot,
          })}
          onPointerLeave={handleInputLeave({
            type: "block",
            id: block.id,
            inputIndex: toolAnchor.slot,
          })}
          onPointerDownCapture={startLinkingFromInput({
            type: "block",
            id: block.id,
            inputIndex: toolAnchor.slot,
          })}
          onPointerDown={startLinkingFromInput({
            type: "block",
            id: block.id,
            inputIndex: toolAnchor.slot,
          })}
          onPointerUp={() =>
            finalizeLinking({
              type: "block",
              id: block.id,
              inputIndex: toolAnchor.slot,
            })
          }
          aria-label={`Attach tool ${idx + 1}`}
        >
          <HandleDot />
        </div>
      ))}
      {handles.inputAnchors.map((anchor, idx) => (
        <div
          key={idx}
          className={`absolute flex items-center justify-center transition-all duration-150 z-10 ${
            showConnections ? "opacity-100 scale-100" : "opacity-0 scale-75"
          }`}
          style={{
            top: anchor.y - block.y - 12,
            left: anchor.x - block.x - 12,
            width: 24,
            height: 24,
            pointerEvents: "auto",
          }}
          data-input
          data-connector
          onPointerDownCapture={startLinkingFromInput({ type: "block", id: block.id, inputIndex: idx })}
          onPointerEnter={handleInputEnter({ type: "block", id: block.id, inputIndex: idx })}
          onPointerLeave={handleInputLeave({ type: "block", id: block.id, inputIndex: idx })}
          onPointerDown={startLinkingFromInput({ type: "block", id: block.id, inputIndex: idx })}
          onPointerUp={() =>
            finalizeLinking({
              type: "block",
              id: block.id,
              inputIndex: idx,
            })
          }
          onDoubleClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
            changeBlockInputs(block.id, event.altKey ? -1 : 1);
          }}
        >
          <HandleDot />
        </div>
      ))}
      {handles.outputAnchors.map((anchor, idx) => (
        <div
          key={idx}
          className={`absolute flex items-center justify-center transition-all duration-150 z-10 ${
            showConnections ? "opacity-100 scale-100" : "opacity-0 scale-75"
          }`}
          style={{
            top: anchor.y - block.y - 12,
            left: anchor.x - block.x - 12,
            width: 24,
            height: 24,
            pointerEvents: "auto",
          }}
          data-output
          data-connector
          data-port={idx}
          onPointerDownCapture={startLinkingFromOutput({ type: "block", id: block.id, port: idx })}
          onPointerDown={startLinkingFromOutput({ type: "block", id: block.id, port: idx })}
          onPointerEnter={handleOutputEnter({ type: "block", id: block.id, port: idx })}
          onPointerLeave={handleOutputLeave({ type: "block", id: block.id, port: idx })}
          onPointerMove={onMoveLinking}
          onPointerUp={() => finalizeLinking()}
          onDoubleClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
            changeBlockOutputs(block.id, event.altKey ? -1 : 1);
          }}
        >
          <HandleDot />
        </div>
      ))}
    </div>
  );
}

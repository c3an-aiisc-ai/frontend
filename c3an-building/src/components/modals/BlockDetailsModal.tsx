import type { AgentBlock, Connection, ToolPreset } from "../../types/workflow";

type Props = {
  block: AgentBlock;
  connections: Connection[];
  toolPalette: ToolPreset[];
  modalToolChoice: string;
  onChangeToolChoice: (value: string) => void;
  onAddTool: (blockId: string, toolName: string) => void;
  onClose: () => void;
  getBlockMode: (block: AgentBlock) => string | null;
  toggleInputRequired: (blockId: string, index: number) => void;
  toggleOutputRequired: (blockId: string, index: number) => void;
};

export default function BlockDetailsModal({
  block,
  connections,
  toolPalette,
  modalToolChoice,
  onChangeToolChoice,
  onAddTool,
  onClose,
  getBlockMode,
  toggleInputRequired,
  toggleOutputRequired,
}: Props) {
  const inbound = connections.filter((c) => c.to.type === "block" && c.to.id === block.id);
  const outbound = connections.filter((c) => c.from.type === "block" && c.from.id === block.id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-[520px] max-h-[80vh] overflow-visible rounded-xl bg-white shadow-2xl border border-slate-200 p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute -right-5 -top-5 z-[9999]">
          <button
            className="h-9 w-9 rounded-full bg-slate-900 text-white text-sm font-semibold shadow-lg"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-slate-900">{block.name}</p>
            {getBlockMode(block) && (
              <p className="text-sm text-slate-600">Mode: {getBlockMode(block)}</p>
            )}
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Agent
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Inputs</p>
            <div className="mt-2 space-y-1.5">
              {Array.from({ length: block.inputCount }, (_, idx) => {
                const isMandatory = idx < (block.mandatoryInputCount ?? 0);
                const isRequired = block.inputRequired[idx];
                return (
                  <div key={idx} className="flex items-center justify-between gap-2 text-sm text-black">
                    <div className="flex items-center gap-2 text-black flex-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      <span className="text-black truncate">
                        {block.inputNames?.[idx] ?? `Input ${idx + 1}`}
                      </span>
                      {isMandatory && (
                        <span className="text-[10px] font-semibold text-rose-600 uppercase tracking-wide">
                          Required
                        </span>
                      )}
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isRequired}
                        disabled={isMandatory}
                        onChange={() => toggleInputRequired(block.id, idx)}
                        className={`h-4 w-4 rounded border-2 ${
                          isMandatory
                            ? "border-rose-300 bg-rose-100 cursor-not-allowed opacity-60"
                            : "border-slate-300 cursor-pointer"
                        }`}
                      />
                      <span
                        className={`text-[11px] font-semibold ${
                          isMandatory ? "text-rose-600" : "text-slate-600"
                        }`}
                      >
                        {isMandatory ? "Mandatory" : "Optional"}
                      </span>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Outputs</p>
            <div className="mt-2 space-y-1.5">
              {Array.from({ length: block.outputCount }, (_, idx) => {
                const isMandatory = idx < (block.mandatoryOutputCount ?? 0);
                const isRequired = block.outputRequired[idx];
                return (
                  <div key={idx} className="flex items-center justify-between gap-2 text-sm text-black">
                    <div className="flex items-center gap-2 text-black flex-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                      <span className="text-black truncate">
                        {block.outputNames?.[idx] ?? `Output ${idx + 1}`}
                      </span>
                      {isMandatory && (
                        <span className="text-[10px] font-semibold text-rose-600 uppercase tracking-wide">
                          Required
                        </span>
                      )}
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isRequired}
                        disabled={isMandatory}
                        onChange={() => toggleOutputRequired(block.id, idx)}
                        className={`h-4 w-4 rounded border-2 ${
                          isMandatory
                            ? "border-rose-300 bg-rose-100 cursor-not-allowed opacity-60"
                            : "border-slate-300 cursor-pointer"
                        }`}
                      />
                      <span
                        className={`text-[11px] font-semibold ${
                          isMandatory ? "text-rose-600" : "text-slate-600"
                        }`}
                      >
                        {isMandatory ? "Mandatory" : "Optional"}
                      </span>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Inbound</p>
            <div className="space-y-1 text-sm text-slate-700">
              {inbound.length === 0 && <p className="text-xs text-slate-500">No incoming links.</p>}
              {inbound.map((c) => (
                <p key={c.id}>
                  {c.from.type} → input {c.to.inputIndex ?? 0}
                </p>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Outbound</p>
            <div className="space-y-1 text-sm text-slate-700">
              {outbound.length === 0 && <p className="text-xs text-slate-500">No outgoing links.</p>}
              {outbound.map((c) => (
                <p key={c.id}>
                  port {c.from.port} → {c.to.type}
                </p>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Attach tool</p>
          <div className="flex items-center gap-2">
            <select
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
              value={modalToolChoice}
              onChange={(event) => onChangeToolChoice(event.target.value)}
            >
              {toolPalette.map((tool) => (
                <option key={tool.name} value={tool.name}>
                  {tool.name}
                </option>
              ))}
            </select>
            <button
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm"
              onClick={() => {
                if (modalToolChoice) onAddTool(block.id, modalToolChoice);
              }}
            >
              Add tool
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            Tool will be placed below this agent and linked to its bottom port.
          </p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Block Details Modal Component
// =============================================================================

import type { AgentBlock, ToolPreset } from "../../types";
import { iconPaths } from "../../assets";
import { getRegistryAgentForBlock } from "../../constants";

type Props = {
  block: AgentBlock;
  toolPalette: ToolPreset[];
  modalToolChoice: string;
  onClose: () => void;
  onToolChoiceChange: (choice: string) => void;
  onAddTool: (blockId: string, toolName: string) => void;
  onToggleInputRequired: (blockId: string, index: number) => void;
  onToggleOutputRequired: (blockId: string, index: number) => void;
  getBlockMode: (block: AgentBlock) => string | null;
};

export default function BlockDetailsModal({
  block,
  toolPalette,
  modalToolChoice,
  onClose,
  onToolChoiceChange,
  onAddTool,
  onToggleInputRequired,
  onToggleOutputRequired,
  getBlockMode,
}: Props) {
  const registryAgent = getRegistryAgentForBlock(block);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-[680px] max-h-[80vh] overflow-visible rounded-xl bg-white shadow-2xl border border-slate-200 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <div className="absolute -right-5 -top-5 z-[9999]">
          <button
            className="h-9 w-9 rounded-full bg-slate-900 text-white text-sm font-semibold shadow-lg"
            onClick={onClose}
            aria-label="Close"
          >
            <img
              src={iconPaths.close}
              alt=""
              className="h-4 w-4 invert"
              draggable={false}
            />
          </button>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-slate-900">{block.name}</p>
            {getBlockMode(block) && (
              <p className="text-sm text-slate-600">
                Mode: {getBlockMode(block)}
              </p>
            )}
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Agent
          </span>
        </div>

        {/* Agent Registry Details */}
        <div className="mt-4 rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Details</p>
          <div className="space-y-2 text-sm text-slate-800">
            <div className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">id</p>
              <p className="text-sm text-slate-900 break-words">{registryAgent?.id ?? block.agentId ?? ""}</p>

              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">name</p>
              <p className="text-sm text-slate-900 break-words">{registryAgent?.name ?? block.name}</p>

              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">description</p>
              <p className="text-sm text-slate-900 break-words">{registryAgent?.description ?? block.description}</p>

              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">capabilities</p>
              <p className="text-sm text-slate-900 break-words">
                {registryAgent?.capabilities?.length ? registryAgent.capabilities.join(", ") : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Inputs/Outputs Grid */}
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          {/* Inputs */}
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">
              Inputs
            </p>
            <div className="mt-2 space-y-1.5">
              {Array.from({ length: block.inputCount }, (_, idx) => {
                const isMandatory = idx < (block.mandatoryInputCount ?? 0);
                const isRequired = block.inputRequired[idx];
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 text-sm text-black"
                  >
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
                    <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={isRequired}
                        disabled={isMandatory}
                        onChange={() => onToggleInputRequired(block.id, idx)}
                        className={`h-4 w-4 rounded border-2 ${
                          isMandatory
                            ? "border-rose-300 bg-rose-100 cursor-not-allowed opacity-60"
                            : "border-slate-300 cursor-pointer"
                        }`}
                      />
                      <span
                        className={`text-[11px] font-semibold whitespace-nowrap ${
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

          {/* Outputs */}
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">
              Outputs
            </p>
            <div className="mt-2 space-y-1.5">
              {Array.from({ length: block.outputCount }, (_, idx) => {
                const isMandatory = idx < (block.mandatoryOutputCount ?? 0);
                const isRequired = block.outputRequired[idx];
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 text-sm text-black"
                  >
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
                    <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={isRequired}
                        disabled={isMandatory}
                        onChange={() => onToggleOutputRequired(block.id, idx)}
                        className={`h-4 w-4 rounded border-2 ${
                          isMandatory
                            ? "border-rose-300 bg-rose-100 cursor-not-allowed opacity-60"
                            : "border-slate-300 cursor-pointer"
                        }`}
                      />
                      <span
                        className={`text-[11px] font-semibold whitespace-nowrap ${
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

        {/* Add Tool Section */}
        <div className="mt-4 rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase text-slate-500 mb-2">
            Attach tool
          </p>
          <div className="flex items-center gap-2">
            <select
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
              value={modalToolChoice}
              onChange={(e) => onToolChoiceChange(e.target.value)}
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

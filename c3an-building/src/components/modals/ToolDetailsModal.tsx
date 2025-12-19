// =============================================================================
// Tool Details Modal Component
// =============================================================================

import type { ToolNode, Connection } from "../../types";
import { iconPaths } from "../../assets";

type Props = {
  tool: ToolNode;
  connections: Connection[];
  onClose: () => void;
  onToggleInputRequired: (toolId: string, index: number) => void;
  onToggleOutputRequired: (toolId: string, index: number) => void;
};

export default function ToolDetailsModal({
  tool,
  connections,
  onClose,
  onToggleInputRequired,
  onToggleOutputRequired,
}: Props) {
  const inbound = connections.filter(
    (c) => c.to.type === "tool" && c.to.id === tool.id
  );
  const outbound = connections.filter(
    (c) => c.from.type === "tool" && c.from.id === tool.id
  );

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
    >
      <div
        className="modal-card w-[520px] max-h-[80vh] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <div className="modal-close-wrap">
          <button
            className="modal-close-btn"
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
            <p className="text-lg font-semibold text-slate-900">{tool.name}</p>
            <p className="text-sm text-slate-600">{tool.tagline}</p>
          </div>
          <span className="pill-tag text-xs bg-indigo-50 text-indigo-700">
            Tool
          </span>
        </div>

        {/* Inputs/Outputs Grid */}
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          {/* Inputs */}
          <div className="panel-sm">
            <p className="label-xs">
              Inputs
            </p>
            <div className="mt-2 space-y-1.5">
              {Array.from({ length: tool.inputCount }, (_, idx) => {
                const isMandatory = idx < (tool.mandatoryInputCount ?? 0);
                const isRequired = tool.inputRequired[idx];
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 text-sm text-black"
                  >
                    <div className="flex items-center gap-2 text-black flex-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                      <span className="text-black truncate">
                        {tool.inputNames?.[idx] ?? `Input ${idx + 1}`}
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
                        onChange={() => onToggleInputRequired(tool.id, idx)}
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

          {/* Outputs */}
          <div className="panel-sm">
            <p className="label-xs">
              Outputs
            </p>
            <div className="mt-2 space-y-1.5">
              {Array.from({ length: tool.outputCount }, (_, idx) => {
                const isMandatory = idx < (tool.mandatoryOutputCount ?? 0);
                const isRequired = tool.outputRequired[idx];
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 text-sm text-black"
                  >
                    <div className="flex items-center gap-2 text-black flex-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                      <span className="text-black truncate">
                        {tool.outputNames?.[idx] ?? `Output ${idx + 1}`}
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
                        onChange={() => onToggleOutputRequired(tool.id, idx)}
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

        {/* Connections Grid */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="panel-sm">
            <p className="label-xs mb-2">
              Inbound
            </p>
            <div className="space-y-1 text-sm text-slate-700">
              {inbound.length === 0 && (
                <p className="text-xs text-slate-500">No incoming links.</p>
              )}
              {inbound.map((c) => (
                <p key={c.id}>
                  {c.from.type} → input {c.to.inputIndex ?? 0}
                </p>
              ))}
            </div>
          </div>
          <div className="panel-sm">
            <p className="label-xs mb-2">
              Outbound
            </p>
            <div className="space-y-1 text-sm text-slate-700">
              {outbound.length === 0 && (
                <p className="text-xs text-slate-500">No outgoing links.</p>
              )}
              {outbound.map((c) => (
                <p key={c.id}>
                  port {c.from.port} → {c.to.type}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

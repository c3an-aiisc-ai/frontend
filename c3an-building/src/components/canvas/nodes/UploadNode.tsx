import type { ChangeEvent, PointerEventHandler } from "react";
import type { LinkSource, UploadHandles, UploadNode } from "../../../types/workflow";
import FloatingRemoveButton from "../../ui/FloatingRemoveButton";
import HandleDot from "../HandleDot";

type Props = {
  upload: UploadNode;
  handles: UploadHandles;
  isActive: boolean;
  isDragging: boolean;
  showHandles: boolean;
  fileLabel: string;
  fileMeta: string;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onRemove: () => void;
  onUploadPointerDown: PointerEventHandler<HTMLDivElement>;
  onUploadPointerMove: PointerEventHandler<HTMLDivElement>;
  onUploadPointerUp: PointerEventHandler<HTMLDivElement>;
  onUploadFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClearFile: () => void;
  startLinkingFromOutput: (source: LinkSource) => PointerEventHandler<HTMLDivElement>;
  handleOutputEnter: (source: LinkSource) => PointerEventHandler<HTMLDivElement>;
  handleOutputLeave: (source: LinkSource) => PointerEventHandler<HTMLDivElement>;
  onMoveLinking: PointerEventHandler<HTMLDivElement>;
  finalizeLinking: () => void;
};

export default function UploadNode({
  upload,
  handles,
  isActive,
  isDragging,
  showHandles,
  fileLabel,
  fileMeta,
  onPointerEnter,
  onPointerLeave,
  onRemove,
  onUploadPointerDown,
  onUploadPointerMove,
  onUploadPointerUp,
  onUploadFileChange,
  onClearFile,
  startLinkingFromOutput,
  handleOutputEnter,
  handleOutputLeave,
  onMoveLinking,
  finalizeLinking,
}: Props) {
  return (
    <div
      className="absolute"
      style={{ left: upload.x, top: upload.y }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <div
        className={`relative rounded-xl border border-slate-200 bg-white/90 p-4 shadow-md backdrop-blur-sm transition-all duration-150 ${
          isActive ? "ring-2 ring-indigo-300" : ""
        } ${isDragging ? "scale-[1.01]" : "scale-[0.98]"} cursor-grab active:cursor-grabbing select-none`}
        data-upload
        style={{ width: handles.width, height: handles.height }}
        onPointerDown={onUploadPointerDown}
        onPointerMove={onUploadPointerMove}
        onPointerUp={onUploadPointerUp}
      >
        <FloatingRemoveButton
          visible={isActive}
          ariaLabel="Remove upload block"
          onClick={onRemove}
        />
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">{upload.name}</p>
            <p className="text-xs text-slate-600">Attach data to feed the flow</p>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ring-1 ${
              upload.status === "ready"
                ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                : "bg-amber-50 text-amber-700 ring-amber-100"
            }`}
          >
            {upload.status === "ready" ? "Ready" : "No file"}
          </span>
        </div>

        <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-3 text-left">
          <p className="text-xs font-semibold text-slate-800 break-words">{fileLabel}</p>
          <p className="text-[11px] text-slate-600">{fileMeta}</p>
          <div className="mt-3 flex items-center gap-2">
            <input
              id={`upload-input-${upload.id}`}
              type="file"
              className="hidden"
              onChange={onUploadFileChange}
              accept=".pdf,.csv,.xlsx,.xls,.json,.txt,.doc,.docx,.xml,.zip"
              data-upload-control
            />
            <label
              htmlFor={`upload-input-${upload.id}`}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 cursor-pointer"
              data-upload-control
            >
              Choose file
            </label>
            {upload.fileName && (
              <button
                className="text-[11px] font-semibold text-slate-600 underline decoration-dotted underline-offset-2"
                onClick={(event) => {
                  event.stopPropagation();
                  onClearFile();
                }}
                data-upload-control
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
      <div
        className={`absolute flex h-8 w-8 items-center justify-center transition-all duration-150 z-10 ${
          showHandles ? "opacity-100 scale-100" : "opacity-0 scale-75"
        }`}
        style={{
          top: handles.output.y - upload.y - 12,
          left: handles.output.x - upload.x - 12,
          width: 24,
          height: 24,
          pointerEvents: "auto",
        }}
        data-output
        data-connector
        onPointerDownCapture={startLinkingFromOutput({ type: "upload", id: upload.id, port: 0 })}
        onPointerDown={startLinkingFromOutput({ type: "upload", id: upload.id, port: 0 })}
        onPointerEnter={handleOutputEnter({ type: "upload", id: upload.id, port: 0 })}
        onPointerLeave={handleOutputLeave({ type: "upload", id: upload.id, port: 0 })}
        onPointerMove={onMoveLinking}
        onPointerUp={() => finalizeLinking()}
      >
        <HandleDot />
      </div>
    </div>
  );
}

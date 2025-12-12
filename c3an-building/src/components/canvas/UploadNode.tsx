// =============================================================================
// Upload Node Component - File upload block on canvas
// =============================================================================

import type { ChangeEvent, PointerEvent as ReactPointerEvent } from "react";
import type {
  UploadNode as UploadNodeType,
  UploadHandles,
  LinkSource,
} from "../../types";
import { formatBytes } from "../../utils";
import { ACCEPTED_FILE_TYPES } from "../../constants";
import HandleDot from "./HandleDot";

type Props = {
  upload: UploadNodeType;
  handles: UploadHandles;
  isActive: boolean;
  isDragging: boolean;
  showHandles: boolean;
  onPointerDown: (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => void;
  onRemove: (id: string) => void;
  onHoverEnter: (id: string) => void;
  onHoverLeave: (id: string) => void;
  onFileChange: (id: string) => (e: ChangeEvent<HTMLInputElement>) => void;
  onClearFile: (id: string) => void;
  onOutputEnter: (source: LinkSource) => () => void;
  onOutputLeave: (source: LinkSource) => () => void;
  onStartLinkingFromOutput: (source: LinkSource) => (e: ReactPointerEvent<HTMLDivElement>) => void;
  onFinalizeLinking: () => void;
  onMoveLinking: (e: ReactPointerEvent<HTMLDivElement>) => void;
};

export default function UploadNode({
  upload,
  handles,
  isActive,
  isDragging,
  showHandles,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onRemove,
  onHoverEnter,
  onHoverLeave,
  onFileChange,
  onClearFile,
  onOutputEnter,
  onOutputLeave,
  onStartLinkingFromOutput,
  onFinalizeLinking,
  onMoveLinking,
}: Props) {
  const fileLabel = upload.fileName ?? "No file attached";
  const fileMeta =
    upload.status === "ready"
      ? `${upload.fileType ?? "File"}${
          upload.fileSize ? ` • ${formatBytes(upload.fileSize)}` : ""
        }`
      : "Accepted: PDF, CSV, Excel, JSON, TXT";

  return (
    <div
      className="absolute"
      style={{ left: upload.x, top: upload.y }}
      onPointerEnter={() => onHoverEnter(upload.id)}
      onPointerLeave={() => onHoverLeave(upload.id)}
    >
      <div
        className={`relative rounded-xl border border-slate-200 bg-white/90 p-4 shadow-md backdrop-blur-sm transition-all duration-150 ${
          isActive ? "ring-2 ring-indigo-300" : ""
        } ${isDragging ? "scale-[1.01]" : "scale-[0.98]"} cursor-grab active:cursor-grabbing select-none`}
        data-upload
        style={{ width: handles.width, height: handles.height }}
        onPointerDown={onPointerDown(upload.id)}
        onPointerMove={onPointerMove(upload.id)}
        onPointerUp={onPointerUp(upload.id)}
      >
        {/* Remove button */}
        <button
          className={`absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white text-xs shadow-md transition-all duration-150 ${
            isActive
              ? "scale-100 opacity-100"
              : "scale-75 opacity-0 pointer-events-none"
          }`}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onClick={() => onRemove(upload.id)}
          aria-label="Remove upload block"
        >
          ×
        </button>

        {/* Header */}
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

        {/* File upload area */}
        <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-3 text-left">
          <p className="text-xs font-semibold text-slate-800 break-words">
            {fileLabel}
          </p>
          <p className="text-[11px] text-slate-600">{fileMeta}</p>
          <div className="mt-3 flex items-center gap-2">
            <input
              id={`upload-input-${upload.id}`}
              type="file"
              className="hidden"
              onChange={onFileChange(upload.id)}
              accept={ACCEPTED_FILE_TYPES}
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
                onClick={(e) => {
                  e.stopPropagation();
                  onClearFile(upload.id);
                }}
                data-upload-control
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Output handle (right side) */}
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
        onPointerDownCapture={onStartLinkingFromOutput({
          type: "upload",
          id: upload.id,
          port: 0,
        })}
        onPointerDown={onStartLinkingFromOutput({
          type: "upload",
          id: upload.id,
          port: 0,
        })}
        onPointerEnter={onOutputEnter({ type: "upload", id: upload.id, port: 0 })}
        onPointerLeave={onOutputLeave({ type: "upload", id: upload.id, port: 0 })}
        onPointerMove={onMoveLinking}
        onPointerUp={onFinalizeLinking}
      >
        <HandleDot />
      </div>
    </div>
  );
}

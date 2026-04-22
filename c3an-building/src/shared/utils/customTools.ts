import type { ToolPreset } from "../types";
import { CUSTOM_TOOL_STORAGE_KEY } from "../constants";
import { clamp, clampNames, isRecord, resizeRequired } from "./index";

function normalizeCount(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return 1;
  return clamp(parsed, 1, 5);
}

function normalizeStoredTool(value: unknown, index: number): ToolPreset | null {
  if (!isRecord(value)) return null;

  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!name) return null;

  const inputCount = normalizeCount(value.inputCount);
  const outputCount = normalizeCount(value.outputCount);
  const mandatoryInputCount =
    typeof value.mandatoryInputCount === "number"
      ? clamp(value.mandatoryInputCount, 0, inputCount)
      : undefined;
  const mandatoryOutputCount =
    typeof value.mandatoryOutputCount === "number"
      ? clamp(value.mandatoryOutputCount, 0, outputCount)
      : undefined;

  return {
    name,
    tagline:
      typeof value.tagline === "string" && value.tagline.trim()
        ? value.tagline.trim()
        : `Generated tool ${index + 1}`,
    gradient:
      typeof value.gradient === "string" && value.gradient.trim()
        ? value.gradient.trim()
        : "from-amber-100 via-white to-rose-100",
    ring:
      typeof value.ring === "string" && value.ring.trim()
        ? value.ring.trim()
        : "ring-amber-200",
    accent:
      typeof value.accent === "string" && value.accent.trim()
        ? value.accent.trim()
        : "bg-amber-600",
    inputCount,
    outputCount,
    inputRequired: resizeRequired(
      Array.isArray(value.inputRequired) ? (value.inputRequired as boolean[]) : undefined,
      inputCount,
    ),
    outputRequired: resizeRequired(
      Array.isArray(value.outputRequired) ? (value.outputRequired as boolean[]) : undefined,
      outputCount,
    ),
    inputNames: clampNames(
      Array.isArray(value.inputNames) ? value.inputNames.map((item) => String(item)) : undefined,
      inputCount,
    ),
    outputNames: clampNames(
      Array.isArray(value.outputNames) ? value.outputNames.map((item) => String(item)) : undefined,
      outputCount,
    ),
    ...(mandatoryInputCount !== undefined ? { mandatoryInputCount } : {}),
    ...(mandatoryOutputCount !== undefined ? { mandatoryOutputCount } : {}),
  };
}

export function readCustomTools(): ToolPreset[] {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return [];
  const raw = localStorage.getItem(CUSTOM_TOOL_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    const list = Array.isArray(parsed)
      ? parsed
      : isRecord(parsed) && Array.isArray(parsed.tools)
        ? parsed.tools
        : [];
    return list
      .map((entry, index) => normalizeStoredTool(entry, index))
      .filter((entry): entry is ToolPreset => Boolean(entry));
  } catch {
    return [];
  }
}

export function writeCustomTools(tools: ToolPreset[]): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CUSTOM_TOOL_STORAGE_KEY, JSON.stringify(tools));
  } catch {
    // Ignore storage failures (e.g., quota or private mode).
  }
}

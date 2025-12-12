// =============================================================================
// Utility Functions for C3AN Workflow Builder
// =============================================================================

import type { Connection } from "../types";

// -----------------------------------------------------------------------------
// File Size Formatting
// -----------------------------------------------------------------------------

export function formatBytes(size?: number): string {
  if (size === undefined || size === null) return "";
  if (size < 1024) return `${size} B`;
  
  const units = ["KB", "MB", "GB"];
  let value = size / 1024;
  let unitIndex = 0;
  
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  
  const formatted = value >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${formatted} ${units[unitIndex]}`;
}

// -----------------------------------------------------------------------------
// Math Utilities
// -----------------------------------------------------------------------------

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// -----------------------------------------------------------------------------
// Array Utilities
// -----------------------------------------------------------------------------

export function resizeRequired(arr: boolean[], count: number): boolean[] {
  const next = arr.slice(0, count);
  while (next.length < count) next.push(false);
  return next;
}

export function clampNames(arr: string[] | undefined, count: number): string[] {
  return (arr ?? []).slice(0, count);
}

// -----------------------------------------------------------------------------
// Connection Analysis
// -----------------------------------------------------------------------------

export function countOperators(conns: Connection[]): {
  seq: number;
  brn: number;
  agg: number;
} {
  const counts = { seq: 0, brn: 0, agg: 0 };

  // Find unique nodes that branch (have >1 outgoing connections)
  const outgoingCounts: Record<string, number> = {};
  conns.forEach((c) => {
    const fromKey = `${c.from.type}:${c.from.id}`;
    outgoingCounts[fromKey] = (outgoingCounts[fromKey] || 0) + 1;
  });

  Object.values(outgoingCounts).forEach((count) => {
    if (count > 1) counts.brn++;
  });

  // Find unique nodes that aggregate (have >1 incoming connections)
  const incomingCounts: Record<string, number> = {};
  conns.forEach((c) => {
    const toKey = `${c.to.type}:${c.to.id}`;
    incomingCounts[toKey] = (incomingCounts[toKey] || 0) + 1;
  });

  Object.values(incomingCounts).forEach((count) => {
    if (count > 1) counts.agg++;
  });

  // Sequential = connections that are neither branching nor aggregating
  let sequentialCount = 0;
  conns.forEach((c) => {
    const fromKey = `${c.from.type}:${c.from.id}`;
    const toKey = `${c.to.type}:${c.to.id}`;
    if (outgoingCounts[fromKey] === 1 && incomingCounts[toKey] === 1) {
      sequentialCount++;
    }
  });

  counts.seq = sequentialCount;
  return counts;
}

// -----------------------------------------------------------------------------
// File Download Utility
// -----------------------------------------------------------------------------

export function downloadWorkflow(
  snapshot: unknown,
  filename = "c3an-workflow.json"
): void {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// -----------------------------------------------------------------------------
// Connection Path Builder
// -----------------------------------------------------------------------------

export function buildConnectionPath(
  start: { x: number; y: number },
  end: { x: number; y: number }
): string {
  const dx = end.x - start.x;
  const offset = Math.max(Math.abs(dx) * 0.5, 40);
  const c1x = start.x + offset;
  const c2x = end.x - offset;
  return `M ${start.x} ${start.y} C ${c1x} ${start.y} ${c2x} ${end.y} ${end.x} ${end.y}`;
}

// -----------------------------------------------------------------------------
// ID Generation
// -----------------------------------------------------------------------------

export function generateId(prefix: string, counter: number): string {
  return `${prefix}-${counter}`;
}

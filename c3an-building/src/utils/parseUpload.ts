// src/utils/parseUpload.ts

import type { PlanningBlock } from "../types/planning";

export type ParsedUpload =
  | { kind: "planning"; plan: PlanningBlock }
  | { kind: "agent"; snapshot: any }
  | { kind: "unknown" };

/**
 * Parse uploaded JSON and normalize to either a planning plan or an agent snapshot.
 */
export function parseUploadedWorkflow(src: any): ParsedUpload {
  if (!src || typeof src !== "object") return { kind: "unknown" };

  // Agent workflow signature
  if (Array.isArray(src.blocks) && Array.isArray(src.connections)) {
    return { kind: "agent", snapshot: src };
  }

  // Planning signature: triples array (and optional plan_id/query)
  if (Array.isArray(src.triples)) {
    const plan: PlanningBlock = {
      id: src.plan_id ?? src.id ?? `plan-upload-${Date.now()}`,
      x: src.x ?? 200,
      y: src.y ?? 200,
      name: src.name ?? src.intent ?? (src.plan_id ?? "Uploaded Plan"),
      query: src.query ?? "",
      triples: src.triples ?? [],
    };
    return { kind: "planning", plan };
  }

  return { kind: "unknown" };
}

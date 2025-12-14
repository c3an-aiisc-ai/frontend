// src/utils/detectWorkflowType.ts

export type WorkflowKind = "planning" | "agent" | "unknown";

/**
 * Detects whether an uploaded JSON represents:
 * - a planning workflow (high-level triples)
 * - an agent workflow (canvas blocks + connections)
 */
export function detectWorkflowType(src: any): WorkflowKind {
  if (!src || typeof src !== "object") return "unknown";

  // Planning workflow signature
  // ────────────────────────────
  // {
  //   plans / blocks with `triples`
  // }
  if (
    Array.isArray(src.triples) &&
    src.triples.every(
      (t: any) =>
        typeof t?.from === "string" &&
        typeof t?.to === "string"
    )
  ) {
    return "planning";
  }

  // Agent workflow signature
  // ────────────────────────
  // {
  //   blocks, connections, tools, uploads, outputs
  // }
  if (
    Array.isArray(src.blocks) &&
    Array.isArray(src.connections)
  ) {
    return "agent";
  }

  return "unknown";
}

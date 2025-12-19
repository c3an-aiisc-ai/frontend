import type { WorkspaceSnapshot } from "./index";

// src/types/planning.ts

export type PlanOp = "seq" | "brn" | "agg";

export type PlanningWorkflowSnapshot = Pick<
  WorkspaceSnapshot,
  "blocks" | "tools" | "connections" | "evals" | "notes" | "uploads" | "outputs"
>;

export type PlanningBlock = {
  id: string;
  x: number;
  y: number;
  name: string;
  query: string;
  triples: { from: string; op: PlanOp; to: string }[];
  workflow?: PlanningWorkflowSnapshot;
};

export type PlanTemplate = {
  id: string;
  name: string;
  query: string;
  triples: { from: string; op: PlanOp; to: string }[];
};

export type PlanTriple = {
  from: string;
  op: PlanOp;
  label?: string;
  to: string;
};

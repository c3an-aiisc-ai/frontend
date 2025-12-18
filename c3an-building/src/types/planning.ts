// src/types/planning.ts

export type PlanOp = "seq" | "brn" | "agg";
import type { WorkspaceSnapshot } from "./index";

export type PlanningWorkflowSnapshot = Pick<
  WorkspaceSnapshot,
  "blocks" | "tools" | "connections" | "evals"
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

export type PlanTriple = {
  from: string;
  op: PlanOp;
  to: string;
};
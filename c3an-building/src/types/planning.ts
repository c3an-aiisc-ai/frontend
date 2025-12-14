// src/types/planning.ts

import type { PlanOp } from "../planning/planOps";
import type { WorkspaceSnapshot } from "./index";

export type PlanningWorkflowSnapshot = Pick<
  WorkspaceSnapshot,
  "notes" | "blocks" | "tools" | "uploads" | "outputs" | "connections" | "evals"
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
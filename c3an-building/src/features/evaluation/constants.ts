import type { MappingRow } from "./types";
import { categoryStyles } from "../../config";

export const DEFAULT_INPUTS = ["User prompt", "Agent output", "Tool response", "Knowledge base snippet"];
export const DEFAULT_OUTPUTS = ["Evaluation dashboard", "Scored response report", "Alert log"];

export const DEFAULT_MAPPINGS: MappingRow[] = [
  {
    id: "map-1",
    input: "User prompt",
    output: "Scored response report",
    metrics: ["relevance", "coherence", "fluency"],
    owner: "Quality Analyst",
    threshold: ">= 0.85",
    cadence: "Per release",
  },
  {
    id: "map-2",
    input: "Agent output",
    output: "Evaluation dashboard",
    metrics: ["accuracy", "hallucination", "cost"],
    owner: "Performance Lead",
    threshold: "P95 latency < 1200ms",
    cadence: "Weekly",
  },
  {
    id: "map-3",
    input: "Tool response",
    output: "Alert log",
    metrics: ["toxicity", "bias"],
    owner: "Safety Reviewer",
    threshold: "Zero critical flags",
    cadence: "Daily",
  },
];

// Re-export category styles from config
export const CATEGORY_STYLES = categoryStyles;

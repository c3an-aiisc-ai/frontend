import type { EvalOption, PanelKey, PanelTab, ToolPreset } from "../types/workflow";

type AgentPreset = {
  id: string;
  name: string;
  description: string;
  inputCount: number;
  outputCount: number;
};

export const MIN_IO = 1;
export const MAX_IO = 5;
export const TOOL_PORT_OFFSET = 1000;

export const panelTitles: Record<PanelKey, string> = {
  blocks: "Blocks",
  tools: "Tools",
  settings: "Settings",
};

export const panelTabs: PanelTab[] = [
  { id: "blocks", label: "Blocks", symbol: "[]" },
  { id: "tools", label: "Tools", symbol: "TL" },
  { id: "settings", label: "Settings", symbol: ":" },
];

export const agentPresets: AgentPreset[] = [
  { id: "solo", name: "Solo", description: "Single in / out", inputCount: 1, outputCount: 1 },
  { id: "fanout", name: "Fan-out", description: "Broadcast to three", inputCount: 1, outputCount: 3 },
  { id: "collector", name: "Collector", description: "Merge two inputs", inputCount: 2, outputCount: 1 },
  { id: "triage", name: "Triage", description: "Route with fallback", inputCount: 1, outputCount: 4 },
  { id: "analysis", name: "Analysis", description: "Ingest two, emit two", inputCount: 2, outputCount: 2 },
  { id: "expander", name: "Expander", description: "Multi-branch", inputCount: 1, outputCount: 5 },
];

export const toolPalette: ToolPreset[] = [
  { name: "Lumen Trace", tagline: "Quick spotlight", gradient: "from-sky-50 via-white to-indigo-100", ring: "ring-sky-200", accent: "bg-sky-600", inputCount: 1, outputCount: 1, inputRequired: [false], outputRequired: [false] },
  { name: "Drift Beacon", tagline: "Signal check", gradient: "from-emerald-50 via-white to-teal-100", ring: "ring-emerald-200", accent: "bg-emerald-600", inputCount: 1, outputCount: 1, inputRequired: [false], outputRequired: [false] },
  { name: "Quartz Forge", tagline: "Shape drafts", gradient: "from-amber-50 via-white to-orange-100", ring: "ring-amber-200", accent: "bg-amber-600", inputCount: 1, outputCount: 2, inputRequired: [false], outputRequired: [false, false] },
  { name: "Echo Loom", tagline: "Thread replies", gradient: "from-slate-50 via-white to-cyan-100", ring: "ring-cyan-200", accent: "bg-cyan-600", inputCount: 2, outputCount: 1, inputRequired: [true, false], outputRequired: [false] },
  { name: "Prism Warden", tagline: "Guard rails", gradient: "from-fuchsia-50 via-white to-purple-100", ring: "ring-fuchsia-200", accent: "bg-fuchsia-600", inputCount: 1, outputCount: 2, inputRequired: [true], outputRequired: [true, false] },
  { name: "Static Tuner", tagline: "Noise filter", gradient: "from-gray-50 via-white to-slate-100", ring: "ring-slate-200", accent: "bg-slate-700", inputCount: 1, outputCount: 1, inputRequired: [false], outputRequired: [false] },
  { name: "Nova Draft", tagline: "Fresh canvas", gradient: "from-rose-50 via-white to-amber-100", ring: "ring-rose-200", accent: "bg-rose-600", inputCount: 1, outputCount: 1, inputRequired: [false], outputRequired: [false] },
  { name: "Polar Kite", tagline: "Flow navigator", gradient: "from-blue-50 via-white to-sky-100", ring: "ring-blue-200", accent: "bg-blue-600", inputCount: 2, outputCount: 2, inputRequired: [true, false], outputRequired: [false, false] },
  { name: "Ember Chisel", tagline: "Quick trim", gradient: "from-orange-50 via-white to-amber-100", ring: "ring-orange-200", accent: "bg-orange-600", inputCount: 1, outputCount: 1, inputRequired: [false], outputRequired: [false] },
  { name: "Cipher Lens", tagline: "Inspect payloads", gradient: "from-violet-50 via-white to-indigo-100", ring: "ring-violet-200", accent: "bg-indigo-600", inputCount: 1, outputCount: 3, inputRequired: [true], outputRequired: [true, false, false] },
  { name: "Vapor Prism", tagline: "Soft preview", gradient: "from-lime-50 via-white to-emerald-100", ring: "ring-lime-200", accent: "bg-lime-600", inputCount: 1, outputCount: 1, inputRequired: [false], outputRequired: [false] },
];

export const evalOptions: EvalOption[] = [
  { id: "accuracy", name: "Accuracy", description: "Measure prediction correctness", category: "Performance" },
  { id: "latency", name: "Latency", description: "Response time metrics", category: "Performance" },
  { id: "throughput", name: "Throughput", description: "Requests per second", category: "Performance" },
  { id: "coherence", name: "Coherence", description: "Logical consistency of outputs", category: "Quality" },
  { id: "relevance", name: "Relevance", description: "Output relevance to input", category: "Quality" },
  { id: "fluency", name: "Fluency", description: "Natural language quality", category: "Quality" },
  { id: "toxicity", name: "Toxicity", description: "Harmful content detection", category: "Safety" },
  { id: "bias", name: "Bias", description: "Fairness and bias detection", category: "Safety" },
  { id: "hallucination", name: "Hallucination", description: "Factual accuracy check", category: "Safety" },
  { id: "cost", name: "Cost", description: "Token usage and cost tracking", category: "Efficiency" },
  { id: "reliability", name: "Reliability", description: "Success rate and uptime", category: "Efficiency" },
];

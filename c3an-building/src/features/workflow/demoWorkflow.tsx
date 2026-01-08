import JSZip from "jszip";
import {
	findAgentRegistryEntryByIdOrName,
	getAgentRegistryEntryById,
	listMandatoryOptional,
	TOOL_PALETTE,
	TOOL_PORT_OFFSET,
} from "../../shared/constants";
import type {
	AgentBlock,
	AgentRegistryEntry,
	Connection,
	PlanSubTask,
	PlanningWorkflowSnapshot,
	ToolNode,
	ToolPreset,
} from "../../shared/types";

export const KIMO_DEMO_TASK_DESCRIPTION =
	"Develop a conversational chatbot that alerts an engineer when an anomaly occurs in the manufacturing pipeline, suggests relevant mitigation strategies from existing manuals, and can answer any engineer’s questions related to the pipeline or the anomaly. The chatbot should also predict future anomalies using historical data.";

export type DemoDataAssetKind = "timeseries" | "manual" | "images" | "zip" | "unknown";

export type DemoDataAsset = {
	kind: DemoDataAssetKind;
	label: string;
	fileName?: string;
	fileSize?: number;
	fileType?: string;
};

export type DemoPlanPayload = {
	task_id: string;
	main_task: string;
	sub_tasks: PlanSubTask[];
	triples: Array<{ from: string; op: "seq" | "brn" | "agg"; to: string }>;
};

export function buildKimoDemoPlanPayload(taskDescription: string): DemoPlanPayload {
	const main = taskDescription.trim() || KIMO_DEMO_TASK_DESCRIPTION;
	const sub_tasks: PlanSubTask[] = [
		{
			sub_task_id: "ST-1",
			name: "Anomaly Prediction",
			description:
				"Build an agent that uses multimodal sensor data to detect and classify anomalies in real time.",
			Tools: ["LSTM Model", "CNN Model"],
		},
		{
			sub_task_id: "ST-2",
			name: "Manuals Guide",
			description:
				"Build an agent that retrieves relevant mitigation steps from manufacturing manuals.",
			Tools: ["PDF Parser"],
		},
		{
			sub_task_id: "ST-3",
			name: "Conversational Chatbot",
			description:
				"Integrate ST-1 and ST-2 within an interactive conversational interface.",
			Tools: ["LLM"],
		},
	];

	return {
		task_id: "kimo-demo-task",
		main_task: main,
		sub_tasks,
		// Two inbound dependencies into ST-3
		triples: [
			{ from: "ST-1", op: "seq", to: "ST-3" },
			{ from: "ST-2", op: "seq", to: "ST-3" },
		],
	};
}

export function isKimoDemoTaskDescription(text: string): boolean {
	const normalized = (text || "").toLowerCase();
	return (
		normalized.includes("conversational chatbot") &&
		normalized.includes("anomaly") &&
		normalized.includes("manufacturing")
	);
}

function ensureToolPreset(name: string, palette: ToolPreset[] = TOOL_PALETTE): ToolPreset {
	const preset = palette.find((t) => t.name === name);
	if (preset) return preset;
	// Fallback: use the generic Data Asset preset if present, else the first palette entry.
	return (
		palette.find((t) => t.name === "Data Asset") ??
		palette[0] ?? {
			name,
			tagline: "",
			gradient: "from-slate-50 via-white to-cyan-100",
			ring: "ring-cyan-200",
			accent: "bg-cyan-600",
			inputCount: 1,
			outputCount: 1,
			inputRequired: [false],
			outputRequired: [false],
		}
	);
}

function blockFromRegistry(agentIdOrName: string, x: number, y: number): AgentBlock {
	const registry: AgentRegistryEntry | null =
		getAgentRegistryEntryById(agentIdOrName) ?? findAgentRegistryEntryByIdOrName(agentIdOrName);
	const input = registry ? listMandatoryOptional(registry.input_data_streams) : { mandatory: [], optional: [] };
	const output = registry ? listMandatoryOptional(registry.output_data_streams) : { mandatory: [], optional: [] };

	const inputNames = [...input.mandatory, ...input.optional];
	const outputNames = [...output.mandatory, ...output.optional];

	const inputCount = Math.max(1, Math.min(5, inputNames.length || 1));
	const outputCount = Math.max(1, Math.min(5, outputNames.length || 1));
	const mandatoryInputCount = Math.min(input.mandatory.length, inputCount);
	const mandatoryOutputCount = Math.min(output.mandatory.length, outputCount);

	const name = registry?.name ?? agentIdOrName;
	const description = registry?.description ?? "";

	return {
		id: "",
		x,
		y,
		name,
		description,
		agentId: registry?.id,
		inputCount,
		outputCount,
		inputRequired: Array.from({ length: inputCount }, (_, idx) => idx < mandatoryInputCount),
		outputRequired: Array.from({ length: outputCount }, (_, idx) => idx < mandatoryOutputCount),
		inputNames: inputNames.length ? inputNames.slice(0, inputCount) : undefined,
		outputNames: outputNames.length ? outputNames.slice(0, outputCount) : undefined,
		presetId: registry?.id ?? "custom",
		mandatoryInputCount,
		mandatoryOutputCount,
	};
}

function toolNodeFromPreset(
	presetName: string,
	x: number,
	y: number,
	overrides?: Partial<Pick<ToolNode, "name" | "tagline">>
): ToolNode {
	const preset = ensureToolPreset(presetName);
	return {
		...preset,
		id: "",
		x,
		y,
		...(overrides?.name ? { name: overrides.name } : {}),
		...(overrides?.tagline ? { tagline: overrides.tagline } : {}),
	};
}

export async function extractDemoDataAssetsFromFiles(files: File[]): Promise<DemoDataAsset[]> {
	const list = Array.from(files ?? []);
	if (list.length === 0) return [];

	const assets: DemoDataAsset[] = [];

	// If a zip is present, prefer expanding it into logical assets.
	const zip = list.find((f) => f.name.toLowerCase().endsWith(".zip"));
	if (zip) {
		assets.push({
			kind: "zip",
			label: zip.name,
			fileName: zip.name,
			fileSize: zip.size,
			fileType: zip.type,
		});

		try {
			const buf = await zip.arrayBuffer();
			const zipObj = await JSZip.loadAsync(buf);
			const entryNames = Object.keys(zipObj.files);

			const hasImages = entryNames.some((name) => name.toLowerCase().includes("/images/") || name.toLowerCase().startsWith("images/"));
			const csv = entryNames.find((name) => name.toLowerCase().endsWith(".csv"));
			const pdf = entryNames.find((name) => name.toLowerCase().endsWith(".pdf"));

			if (hasImages) assets.push({ kind: "images", label: "images/" });
			if (csv) assets.push({ kind: "timeseries", label: csv.split("/").pop() ?? csv, fileName: csv });
			if (pdf) assets.push({ kind: "manual", label: pdf.split("/").pop() ?? pdf, fileName: pdf });
		} catch {
			// Keep the zip asset only.
		}

		return assets;
	}

	// Non-zip uploads (csv/pdf directly).
	for (const file of list) {
		const lower = file.name.toLowerCase();
		if (lower.endsWith(".csv")) {
			assets.push({ kind: "timeseries", label: file.name, fileName: file.name, fileSize: file.size, fileType: file.type });
		} else if (lower.endsWith(".pdf")) {
			assets.push({ kind: "manual", label: file.name, fileName: file.name, fileSize: file.size, fileType: file.type });
		} else {
			assets.push({ kind: "unknown", label: file.name, fileName: file.name, fileSize: file.size, fileType: file.type });
		}
	}
	return assets;
}

export function buildDemoWorkflowSnapshotForSubTask(args: {
	subTaskId: string;
	dataAssets?: DemoDataAsset[];
}): PlanningWorkflowSnapshot {
	const { subTaskId } = args;
	const dataAssets = Array.isArray(args.dataAssets) ? args.dataAssets : [];

	const blocks: AgentBlock[] = [];
	const tools: ToolNode[] = [];
	const connections: Connection[] = [];

	let nextBlock = 1;
	let nextTool = 1;
	let nextConn = 1;

	const pushBlock = (block: AgentBlock) => {
		const id = `block-${nextBlock++}`;
		blocks.push({ ...block, id });
		return id;
	};

	const pushTool = (tool: ToolNode) => {
		const id = `tool-${nextTool++}`;
		tools.push({ ...tool, id });
		return id;
	};

	const pushConn = (conn: Omit<Connection, "id">) => {
		connections.push({ ...conn, id: `conn-${nextConn++}` });
	};

	const leftX = 140;
	const midX = 460;
	const rightX = 760;
	const topY = 160;
	const dataToolStartY = topY - 20;
	const dataToolGapY = 150;
	const toolStackX = midX + 20;
	const toolStartY = topY + 190;
	const toolGapY = 170;

	const placeDataTools = (kinds: DemoDataAssetKind[], startY = dataToolStartY) => {
		const matching = dataAssets.filter((a) => kinds.includes(a.kind));
		return matching.map((asset, index) => {
			const toolId = pushTool(
				toolNodeFromPreset("Data Asset", leftX, startY + index * dataToolGapY, {
					name: asset.label,
					tagline: asset.kind,
				})
			);
			return toolId;
		});
	};

	if (subTaskId === "ST-1") {
		const blockId = pushBlock(blockFromRegistry("anomaly-prediction-agent", midX, topY));

		// Data inputs
		const dataToolIds = placeDataTools(["timeseries", "images"]);
		dataToolIds.forEach((toolId) => {
			pushConn({
				from: { type: "tool", id: toolId, port: 0 },
				to: { type: "block", id: blockId, inputIndex: TOOL_PORT_OFFSET },
			});
		});

		// Model tools (directly to block tool slot)
		const cnnId = pushTool(toolNodeFromPreset("CNN Model", toolStackX, toolStartY));
		const lstmId = pushTool(toolNodeFromPreset("LSTM Model", toolStackX, toolStartY + toolGapY));
		pushConn({
			from: { type: "tool", id: lstmId, port: 0 },
			to: { type: "block", id: blockId, inputIndex: TOOL_PORT_OFFSET },
		});
		pushConn({
			from: { type: "tool", id: cnnId, port: 0 },
			to: { type: "block", id: blockId, inputIndex: TOOL_PORT_OFFSET },
		});
	} else if (subTaskId === "ST-2") {
		const blockId = pushBlock(blockFromRegistry("manuals-guide-agent", midX, topY));

		// Data (manual PDF)
		const [manualToolId] = placeDataTools(["manual"]);
		if (manualToolId) {
			pushConn({
				from: { type: "tool", id: manualToolId, port: 0 },
				to: { type: "block", id: blockId, inputIndex: TOOL_PORT_OFFSET },
			});
		}

		// Retrieval tools (directly to block tool slot)
		const pdfId = pushTool(toolNodeFromPreset("PDF Parser", toolStackX, toolStartY));
		const embedId = pushTool(toolNodeFromPreset("Embedding Model", toolStackX, toolStartY + toolGapY));
		const storeId = pushTool(toolNodeFromPreset("Vector Store", toolStackX, toolStartY + toolGapY * 2));
		pushConn({
			from: { type: "tool", id: embedId, port: 0 },
			to: { type: "block", id: blockId, inputIndex: TOOL_PORT_OFFSET },
		});
		pushConn({
			from: { type: "tool", id: storeId, port: 0 },
			to: { type: "block", id: blockId, inputIndex: TOOL_PORT_OFFSET },
		});
		pushConn({
			from: { type: "tool", id: pdfId, port: 0 },
			to: { type: "block", id: blockId, inputIndex: TOOL_PORT_OFFSET },
		});
	} else if (subTaskId === "ST-3") {
		const blockId = pushBlock(blockFromRegistry("conversational-chatbot-agent", midX, topY));

		// Optional: include the anomaly forecast if present
		const forecastAsset = dataAssets.find((a) => a.kind === "timeseries");
		if (forecastAsset) {
			const forecastId = pushTool(
				toolNodeFromPreset("Data Asset", leftX, dataToolStartY + 30, { name: forecastAsset.label, tagline: "context" })
			);
			pushConn({
				from: { type: "tool", id: forecastId, port: 0 },
				to: { type: "block", id: blockId, inputIndex: TOOL_PORT_OFFSET },
			});
		}

		const chatToolId = pushTool(toolNodeFromPreset("Chat Orchestrator", rightX, toolStartY));
		pushConn({
			from: { type: "tool", id: chatToolId, port: 0 },
			to: { type: "block", id: blockId, inputIndex: TOOL_PORT_OFFSET },
		});
	}

	return {
		blocks,
		tools,
		connections,
		evals: [],
		notes: [],
		uploads: [],
		outputs: [],
	};
}

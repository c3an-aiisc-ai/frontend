from ..core.stage import Stage
from ...Resources.Schemas.artifacts import PredictionsBatch, EvalReport, TrainedModel, ExportPaths
from ..io.runfs import RunFS
from pathlib import Path
import csv
import json
import torch


class ExportRunArtifacts(Stage[TrainedModel, ExportPaths]):
	def __init__(self):
		super().__init__("export", TrainedModel, ExportPaths)

	def run(self, inp: TrainedModel, **kwargs) -> ExportPaths:
		fs: RunFS = kwargs.get("fs")
		preds: PredictionsBatch = kwargs.get("preds")
		metrics: EvalReport = kwargs.get("metrics")
		if fs is None:
			raise ValueError("RunFS (fs) is required")

		output_dir = kwargs.get("output_dir")
		prefix = str(kwargs.get("filename_prefix") or "").strip()
		prefix = f"{prefix}_" if prefix else ""
		base_dir = Path(output_dir) if output_dir else fs.tertiary
		base_dir.mkdir(parents=True, exist_ok=True)

		weights_pth = str((base_dir / f"{prefix}lstm_model.pth").resolve())
		model = getattr(inp, "_torch_model", None)
		if model is not None:
			torch.save(model.state_dict(), weights_pth)

		preds_csv = str((base_dir / f"{prefix}lstm_predictions.csv").resolve())
		with open(preds_csv, "w", newline="") as f:
			writer = csv.writer(f)
			if preds.y_true:
				dim = len(preds.y_true[0])
			else:
				dim = 0
			header = [f"y_true_{i}" for i in range(dim)] + [f"y_pred_{i}" for i in range(dim)]
			writer.writerow(header)
			for t, p in zip(preds.y_true or [], preds.y_pred or []):
				writer.writerow([*t, *p])

		if output_dir:
			metrics_json = str((base_dir / f"{prefix}lstm_metrics.{fs._ts()}.json").resolve())
			Path(metrics_json).write_text(json.dumps(metrics.to_dict(), indent=2))
		else:
			metrics_json = fs.write_json("tertiary", "lstm_metrics", metrics.to_dict())
		return ExportPaths(preds_csv=preds_csv, weights_pth=weights_pth, metrics_json=metrics_json)
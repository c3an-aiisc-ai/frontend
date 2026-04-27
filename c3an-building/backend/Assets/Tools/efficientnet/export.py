import csv
import json
import torch
from pathlib import Path

from ..core.stage import Stage
from ..io.runfs import RunFS
from ...Resources.Schemas.artifacts import EvalReport, ExportPaths, PredictionsBatch, TrainedModel


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

        weights_pth = str((base_dir / f"{prefix}efficientnet_model.pth").resolve())
        model = getattr(inp, "_torch_model", None)
        if model is not None:
            torch.save(model.state_dict(), weights_pth)

        preds_csv = str((base_dir / f"{prefix}efficientnet_predictions.csv").resolve())
        with open(preds_csv, "w", newline="") as f:
            writer = csv.writer(f)
            max_prob_dim = len(preds.y_pred[0]) if (preds and preds.y_pred) else 0
            header = ["y_true"] + [f"y_pred_prob_{i}" for i in range(max_prob_dim)] + ["y_pred_class"]
            writer.writerow(header)
            for t, p, c in zip(preds.y_true or [], preds.y_pred or [], preds.y_pred_state_int or []):
                writer.writerow([t[0], *p, c])

        if output_dir:
            metrics_json = str((base_dir / f"{prefix}efficientnet_metrics.{fs._ts()}.json").resolve())
            Path(metrics_json).write_text(json.dumps(metrics.to_dict(), indent=2))
        else:
            metrics_json = fs.write_json("tertiary", "efficientnet_metrics", metrics.to_dict())
        return ExportPaths(preds_csv=preds_csv, weights_pth=weights_pth, metrics_json=metrics_json)
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

        weights_pth = str((base_dir / f"{prefix}lstm_autoencoder_model.pth").resolve())
        model = getattr(inp, "_torch_model", None)
        if model is not None:
            torch.save(model.state_dict(), weights_pth)

        preds_csv = str((base_dir / f"{prefix}lstm_autoencoder_predictions.csv").resolve())
        with open(preds_csv, "w", newline="") as f:
            w = csv.writer(f)
            w.writerow([
                "y_true_load1",
                "y_true_load2",
                "y_true_state",
                "y_pred_load1",
                "y_pred_load2",
                "y_pred_state_float",
                "y_pred_state_int",
            ])
            for t, p, s in zip(preds.y_true or [], preds.y_pred or [], preds.y_pred_state_int or []):
                w.writerow([t[0], t[1], int(round(t[2])), p[0], p[1], p[2], s])

        if output_dir:
            metrics_json = str((base_dir / f"{prefix}lstm_autoencoder_metrics.{fs._ts()}.json").resolve())
            Path(metrics_json).write_text(json.dumps(metrics.to_dict(), indent=2))
        else:
            metrics_json = fs.write_json("tertiary", "lstm_autoencoder_metrics", metrics.to_dict())
        return ExportPaths(preds_csv=preds_csv, weights_pth=weights_pth, metrics_json=metrics_json)
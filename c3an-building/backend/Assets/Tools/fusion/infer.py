import torch

from ..core.stage import Stage
from ...Resources.Schemas.artifacts import FrameWithTargets, PredictionsBatch, TrainSplit, TrainedModel


class PredictOnValid(Stage[FrameWithTargets, PredictionsBatch]):
    def __init__(self):
        super().__init__("infer_on_valid", FrameWithTargets, PredictionsBatch)

    def run(self, inp: FrameWithTargets, **kwargs) -> PredictionsBatch:
        split: TrainSplit = kwargs.get("split")
        trained: TrainedModel = kwargs.get("trained")
        if not split or not trained:
            raise ValueError("split and trained required")

        model = getattr(trained, "_torch_model", None)
        if model is None:
            raise ValueError("No in-memory torch model")

        X = torch.tensor(inp.X, dtype=torch.float32)
        y_pred = []
        y_true = []
        y_pred_state_int = []

        for i in split.valid_idx or []:
            with torch.no_grad():
                yhat = model(X[i : i + 1]).cpu().numpy().tolist()[0]
            y_pred.append([float(v) for v in yhat])
            y_true.append(inp.y_next[i])
            y_pred_state_int.append(int(round(float(yhat[2]))))

        return PredictionsBatch(y_true=y_true, y_pred=y_pred, y_pred_state_int=y_pred_state_int)
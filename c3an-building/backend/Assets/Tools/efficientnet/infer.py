import torch

from ..core.stage import Stage
from ...Resources.Schemas.artifacts import ImageFrameWithTargets, PredictionsBatch, TrainSplit, TrainedModel


class PredictOnValid(Stage[ImageFrameWithTargets, PredictionsBatch]):
    def __init__(self):
        super().__init__("infer_on_valid", ImageFrameWithTargets, PredictionsBatch)

    def run(self, inp: ImageFrameWithTargets, **kwargs) -> PredictionsBatch:
        split: TrainSplit = kwargs.get("split")
        trained: TrainedModel = kwargs.get("trained")
        if not split or not trained:
            raise ValueError("split and trained required")

        model = getattr(trained, "_torch_model", None)
        if model is None:
            raise ValueError("No in-memory torch model")

        X = torch.tensor(inp.X_images, dtype=torch.float32)
        if X.dim() == 4:
            X = X.permute(0, 3, 1, 2)

        y_pred = []
        y_true = []
        y_pred_state_int = []
        for i in split.valid_idx or []:
            with torch.no_grad():
                logits = model(X[i : i + 1])
                probs = torch.softmax(logits, dim=1).cpu().numpy().tolist()[0]
                pred_cls = int(torch.argmax(logits, dim=1).item())
            y_pred.append([float(v) for v in probs])
            y_true.append([int(inp.y_next[i])])
            y_pred_state_int.append(pred_cls)

        return PredictionsBatch(y_true=y_true, y_pred=y_pred, y_pred_state_int=y_pred_state_int)
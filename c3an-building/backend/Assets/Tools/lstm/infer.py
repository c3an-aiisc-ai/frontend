from ..core.stage import Stage
from ...Resources.Schemas.artifacts import SequenceBatch, TrainSplit, TrainedModel, PredictionsBatch
import torch


class PredictOnValid(Stage[SequenceBatch, PredictionsBatch]):
	def __init__(self):
		super().__init__("infer_on_valid", SequenceBatch, PredictionsBatch)

	def run(self, inp: SequenceBatch, **kwargs) -> PredictionsBatch:
		split: TrainSplit = kwargs.get("split")
		trained: TrainedModel = kwargs.get("trained")
		if not split or not trained:
			raise ValueError("split and trained required")
		model = getattr(trained, "_torch_model", None)
		if model is None:
			raise ValueError("No in-memory torch model")

		X = torch.tensor(inp.X_seq, dtype=torch.float32)
		X_exog = torch.tensor(inp.X_exog, dtype=torch.float32) if inp.X_exog is not None else None
		y_pred = []
		y_true = []
		y_pred_state_int = []

		for i in split.valid_idx:
			with torch.no_grad():
				pred = model(X[i : i + 1], X_exog[i : i + 1] if X_exog is not None else None)
				pred_list = pred.cpu().numpy().tolist()[0]
			y_pred.append([float(v) for v in pred_list])
			y_true.append([float(v) for v in inp.y_next[i]])
			y_pred_state_int.append(int(round(pred_list[-1])))

		return PredictionsBatch(y_true=y_true, y_pred=y_pred, y_pred_state_int=y_pred_state_int)
from ..core.stage import Stage
from ...Resources.Schemas.artifacts import PredictionsBatch, EvalReport
from typing import Dict


def _mse_mae(y_true, y_pred) -> (Dict[str, float], Dict[str, float]):
	if not y_true:
		return {}, {}
	dim = len(y_true[0])
	mse = [0.0] * dim
	mae = [0.0] * dim
	n = len(y_true)
	for t, p in zip(y_true, y_pred):
		for i in range(dim):
			d = p[i] - t[i]
			mse[i] += d * d
			mae[i] += abs(d)
	mse = [v / n for v in mse]
	mae = [v / n for v in mae]
	mse_map = {f"y{i}": mse[i] for i in range(dim)}
	mae_map = {f"y{i}": mae[i] for i in range(dim)}
	return mse_map, mae_map


class EvaluatePredictions(Stage[PredictionsBatch, EvalReport]):
	def __init__(self):
		super().__init__("evaluate", PredictionsBatch, EvalReport)

	def run(self, inp: PredictionsBatch, **kwargs) -> EvalReport:
		mse, mae = _mse_mae(inp.y_true, inp.y_pred)
		return EvalReport(mse=mse, mae=mae, cls_report=None)
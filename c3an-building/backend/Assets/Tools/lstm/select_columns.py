from ..core.stage import Stage
from ...Resources.Schemas.artifacts import RawFrame, FrameSelectedSeq
from typing import List, Optional


def _to_float(value):
	if value is None:
		return None
	try:
		return float(value)
	except (TypeError, ValueError):
		return None


class SelectColumns(Stage[RawFrame, FrameSelectedSeq]):
	def __init__(self):
		super().__init__("select_columns", RawFrame, FrameSelectedSeq)

	def run(self, inp: RawFrame, **kwargs) -> FrameSelectedSeq:
		seq_feature_cols: List[str] = kwargs.get("seq_feature_cols") or []
		exog_feature_cols: Optional[List[str]] = kwargs.get("exog_feature_cols")
		label_cols = kwargs.get("label_cols") or []
		label_col = kwargs.get("label_col")
		if label_col and not label_cols:
			label_cols = [label_col]
		if not seq_feature_cols or not label_cols:
			raise ValueError("seq_feature_cols and label_cols are required")

		X_seq = []
		X_exog = [] if exog_feature_cols else None
		y_raw = []

		for row in inp.rows or []:
			X_seq.append([_to_float(row.get(c)) for c in seq_feature_cols])
			if exog_feature_cols:
				X_exog.append([_to_float(row.get(c)) for c in exog_feature_cols])
			y_raw.append([row.get(c) for c in label_cols])

		return FrameSelectedSeq(X_seq=X_seq, X_exog=X_exog, y_raw=y_raw)
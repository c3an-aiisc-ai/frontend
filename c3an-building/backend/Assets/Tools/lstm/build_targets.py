from ..core.stage import Stage
from ...Resources.Schemas.artifacts import FrameEncodedSeq, SequenceBatch


class BuildTargets(Stage[FrameEncodedSeq, SequenceBatch]):
	def __init__(self):
		super().__init__("build_targets", FrameEncodedSeq, SequenceBatch)

	def run(self, inp: FrameEncodedSeq, **kwargs) -> SequenceBatch:
		look_back = int(kwargs.get("look_back", 30))
		X_seq = inp.X_seq or []
		X_exog = inp.X_exog
		y_num = inp.y_num or []

		X_out = []
		y_out = []
		exog_out = [] if X_exog is not None else None

		n = len(X_seq)
		for i in range(n - look_back):
			X_out.append(X_seq[i : i + look_back])
			y_val = y_num[i + look_back]
			if isinstance(y_val, list):
				y_out.append([float(v) for v in y_val])
			else:
				y_out.append([float(y_val)])
			if X_exog is not None:
				exog_out.append([float(v) for v in X_exog[i + look_back]])

		return SequenceBatch(X_seq=X_out, y_next=y_out, X_exog=exog_out)
from ..core.stage import Stage
from ...Resources.Schemas.artifacts import FrameSelectedSeq, FrameEncodedSeq, LabelMap


def _is_nan(value) -> bool:
	return isinstance(value, float) and value != value


class ImputeAndEncode(Stage[FrameSelectedSeq, FrameEncodedSeq]):
	def __init__(self):
		super().__init__("impute_encode", FrameSelectedSeq, FrameEncodedSeq)

	def run(self, inp: FrameSelectedSeq, **kwargs) -> FrameEncodedSeq:
		fill_value = float(kwargs.get("fill_value", 0.0))
		X_seq = []
		X_exog = [] if inp.X_exog is not None else None
		for row in inp.X_seq or []:
			X_seq.append([fill_value if v is None or _is_nan(v) else float(v) for v in row])
		if inp.X_exog is not None:
			for row in inp.X_exog:
				X_exog.append([fill_value if v is None or _is_nan(v) else float(v) for v in row])

		y_num = []
		to_int = {}
		to_str = {}
		next_id = 0
		for y in inp.y_raw or []:
			if isinstance(y, list):
				cleaned = []
				for v in y:
					if v is None or _is_nan(v):
						cleaned.append(fill_value)
					elif isinstance(v, str):
						if v not in to_int:
							to_int[v] = next_id
							to_str[next_id] = v
							next_id += 1
						cleaned.append(float(to_int[v]))
					else:
						cleaned.append(float(v))
				y_num.append(cleaned)
			else:
				if y is None or _is_nan(y):
					y_num.append(fill_value)
				elif isinstance(y, str):
					if y not in to_int:
						to_int[y] = next_id
						to_str[next_id] = y
						next_id += 1
					y_num.append(float(to_int[y]))
				else:
					y_num.append(float(y))

		label_map = LabelMap(to_int=to_int, to_str=to_str) if to_int else None
		return FrameEncodedSeq(X_seq=X_seq, X_exog=X_exog, y_num=y_num, label_map=label_map)
from ..core.stage import Stage
from ...Resources.Schemas.artifacts import SequenceBatch, TrainSplit


class TrainValidSplit(Stage[SequenceBatch, TrainSplit]):
	def __init__(self):
		super().__init__("split", SequenceBatch, TrainSplit)

	def run(self, inp: SequenceBatch, **kwargs) -> TrainSplit:
		train_ratio = float(kwargs.get("train_ratio", 0.8))
		shuffle = bool(kwargs.get("shuffle", False))
		seed = int(kwargs.get("seed", 42))
		n = len(inp.X_seq or [])
		idx = list(range(n))
		if shuffle:
			import random

			random.seed(seed)
			random.shuffle(idx)
		k = int(n * train_ratio)
		return TrainSplit(train_idx=idx[:k], valid_idx=idx[k:])
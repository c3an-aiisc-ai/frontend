from ..core.stage import Stage
from ...Resources.Schemas.artifacts import SequenceBatch, TrainSplit, UntrainedModel, TrainConfig, TrainedModel
from typing import List, Optional
import torch
import torch.nn as nn
import torch.optim as optim


class _LSTMModel(nn.Module):
	def __init__(self, input_dim: int, hidden_dim: int, num_layers: int, out_dim: int, dropout: float, exog_dim: int):
		super().__init__()
		self.lstm = nn.LSTM(
			input_size=input_dim,
			hidden_size=hidden_dim,
			num_layers=num_layers,
			batch_first=True,
			dropout=dropout if num_layers > 1 else 0.0,
		)
		self.fc = nn.Linear(hidden_dim + exog_dim, out_dim)

	def forward(self, x_seq: torch.Tensor, x_exog: Optional[torch.Tensor] = None) -> torch.Tensor:
		out, _ = self.lstm(x_seq)
		last = out[:, -1, :]
		if x_exog is not None:
			last = torch.cat([last, x_exog], dim=1)
		return self.fc(last)


class TrainModel(Stage[SequenceBatch, TrainedModel]):
	def __init__(self):
		super().__init__("train_model", SequenceBatch, TrainedModel)

	def run(self, inp: SequenceBatch, **kwargs) -> TrainedModel:
		split: TrainSplit = kwargs.get("split")
		untrained: UntrainedModel = kwargs.get("untrained")
		tcfg: TrainConfig = kwargs.get("train_config", TrainConfig())
		if not split or not untrained:
			raise ValueError("split and untrained required")

		params = untrained.params or {}
		device = torch.device("cpu")
		X = torch.tensor(inp.X_seq, dtype=torch.float32, device=device)
		y = torch.tensor(inp.y_next, dtype=torch.float32, device=device)
		X_exog = None
		if inp.X_exog is not None:
			X_exog = torch.tensor(inp.X_exog, dtype=torch.float32, device=device)

		model = _LSTMModel(
			input_dim=int(params.get("input_dim", X.shape[2])),
			hidden_dim=int(params.get("hidden_dim", 64)),
			num_layers=int(params.get("num_layers", 2)),
			out_dim=int(params.get("out_dim", y.shape[1])),
			dropout=float(params.get("dropout", 0.0)),
			exog_dim=int(params.get("exog_dim", X_exog.shape[1] if X_exog is not None else 0)),
		).to(device)

		crit = nn.MSELoss()
		opt = optim.Adam(model.parameters(), lr=float(tcfg.lr))

		def batch_iter(indices: List[int], batch_size: int):
			for i in range(0, len(indices), batch_size):
				yield indices[i : i + batch_size]

		best = float("inf")
		curve = []
		for _ in range(int(tcfg.epochs)):
			if tcfg.shuffle:
				import random

				random.seed(int(tcfg.seed))
				random.shuffle(split.train_idx)
			model.train()
			for batch_idx in batch_iter(split.train_idx, int(tcfg.batch_size)):
				xb = X[batch_idx]
				yb = y[batch_idx]
				exb = X_exog[batch_idx] if X_exog is not None else None
				opt.zero_grad()
				pred = model(xb, exb)
				loss = crit(pred, yb)
				loss.backward()
				opt.step()

			model.eval()
			with torch.no_grad():
				vb = split.valid_idx
				if vb:
					xv = X[vb]
					yv = y[vb]
					exv = X_exog[vb] if X_exog is not None else None
					vloss = float(crit(model(xv, exv), yv).item())
				else:
					vloss = 0.0
			curve.append(vloss)
			best = min(best, vloss)

		tm = TrainedModel(arch="lstm", params=params)
		tm._torch_model = model
		tm._loss_curve = curve
		tm._best_val = best
		return tm
from typing import List

import torch
import torch.nn as nn
import torch.optim as optim

from ..core.stage import Stage
from ...Resources.Schemas.artifacts import FrameWithTargets, TrainConfig, TrainSplit, TrainedModel, UntrainedModel


class _FusionMLP(nn.Module):
    def __init__(self, in_dim: int, hidden_dim: int, out_dim: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, out_dim),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


class TrainModel(Stage[FrameWithTargets, TrainedModel]):
    def __init__(self):
        super().__init__("train_model", FrameWithTargets, TrainedModel)

    def run(self, inp: FrameWithTargets, **kwargs) -> TrainedModel:
        split: TrainSplit = kwargs.get("split")
        untrained: UntrainedModel = kwargs.get("untrained")
        tcfg: TrainConfig = kwargs.get("train_config", TrainConfig())
        if not split or not untrained:
            raise ValueError("split and untrained required")

        params = untrained.params or {}
        in_dim = int(params.get("in_dim", len(inp.X[0]) if inp.X else 1))
        hidden_dim = int(params.get("hidden_dim", 64))
        out_dim = int(params.get("out_dim", 3))

        device = torch.device("cpu")
        X = torch.tensor(inp.X, dtype=torch.float32, device=device)
        Y = torch.tensor(inp.y_next, dtype=torch.float32, device=device)

        model = _FusionMLP(in_dim=in_dim, hidden_dim=hidden_dim, out_dim=out_dim).to(device)
        crit = nn.MSELoss()
        opt = optim.Adam(model.parameters(), lr=float(tcfg.lr))

        def loop(indices: List[int], train: bool) -> float:
            total = 0.0
            cnt = 0
            for i in indices:
                x = X[i : i + 1]
                y = Y[i : i + 1]
                if train:
                    opt.zero_grad()
                yhat = model(x)
                loss = crit(yhat, y)
                if train:
                    loss.backward()
                    opt.step()
                total += float(loss.item())
                cnt += 1
            return total / max(cnt, 1)

        curve = []
        best = float("inf")
        for _ in range(int(tcfg.epochs)):
            _ = loop(split.train_idx or [], True)
            v = loop(split.valid_idx or [], False)
            curve.append(v)
            best = min(best, v)

        tm = TrainedModel(arch="fusion_mlp", params=params)
        tm._torch_model = model
        tm._loss_curve = curve
        tm._best_val = best
        return tm
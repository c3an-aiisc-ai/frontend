from typing import List

import torch
import torch.nn as nn
import torch.optim as optim

from ..core.stage import Stage
from ...Resources.Schemas.artifacts import ImageFrameWithTargets, TrainConfig, TrainSplit, TrainedModel, UntrainedModel


class _SmallCNN(nn.Module):
    def __init__(self, in_channels: int, num_classes: int, image_size: int, hidden_dim: int):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(in_channels, 16, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(16, 32, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
        )

        with torch.no_grad():
            dummy = torch.zeros(1, in_channels, image_size, image_size)
            flat_dim = int(self.features(dummy).view(1, -1).shape[1])

        self.classifier = nn.Sequential(
            nn.Linear(flat_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        feats = self.features(x)
        flat = feats.reshape(feats.size(0), -1)
        return self.classifier(flat)


def _build_backbone(params: dict, y: torch.Tensor) -> nn.Module:
    in_channels = int(params.get("in_channels", 3))
    num_classes = int(params.get("num_classes", int(y.max().item()) + 1 if y.numel() else 1))
    image_size = int(params.get("image_size", 224))
    hidden_dim = int(params.get("hidden_dim", 128))
    pretrained = bool(params.get("pretrained", True))
    backbone = str(params.get("backbone", "efficientnet-b0"))

    if backbone == "efficientnet-b0":
        try:
            from efficientnet_pytorch import EfficientNet

            if pretrained:
                return EfficientNet.from_pretrained("efficientnet-b0", num_classes=num_classes)
            return EfficientNet.from_name("efficientnet-b0", override_params={"num_classes": num_classes})
        except Exception:
            pass

    return _SmallCNN(in_channels=in_channels, num_classes=num_classes, image_size=image_size, hidden_dim=hidden_dim)


class TrainModel(Stage[ImageFrameWithTargets, TrainedModel]):
    def __init__(self):
        super().__init__("train_model", ImageFrameWithTargets, TrainedModel)

    def run(self, inp: ImageFrameWithTargets, **kwargs) -> TrainedModel:
        split: TrainSplit = kwargs.get("split")
        untrained: UntrainedModel = kwargs.get("untrained")
        tcfg: TrainConfig = kwargs.get("train_config", TrainConfig())
        if not split or not untrained:
            raise ValueError("split and untrained required")

        params = untrained.params or {}
        device = torch.device("cpu")
        X = torch.tensor(inp.X_images, dtype=torch.float32, device=device)
        if X.dim() == 4:
            X = X.permute(0, 3, 1, 2)
        y = torch.tensor(inp.y_next, dtype=torch.long, device=device)

        model = _build_backbone(params=params, y=y).to(device)

        class_counts = torch.bincount(y) if y.numel() else torch.tensor([1], dtype=torch.long, device=device)
        inv = torch.where(class_counts > 0, 1.0 / class_counts.float(), torch.zeros_like(class_counts, dtype=torch.float32))
        if float(inv.sum()) > 0:
            inv = inv / inv.sum()
            crit = nn.CrossEntropyLoss(weight=inv)
        else:
            crit = nn.CrossEntropyLoss()

        opt = optim.Adam(model.parameters(), lr=float(tcfg.lr))

        def batch_iter(indices: List[int], batch_size: int):
            for i in range(0, len(indices), batch_size):
                yield indices[i : i + batch_size]

        curve = []
        best = float("inf")

        for _ in range(int(tcfg.epochs)):
            train_idx = list(split.train_idx or [])
            if tcfg.shuffle:
                import random

                random.seed(int(tcfg.seed))
                random.shuffle(train_idx)

            model.train()
            for batch_idx in batch_iter(train_idx, int(max(1, tcfg.batch_size))):
                xb = X[batch_idx]
                yb = y[batch_idx]
                opt.zero_grad()
                pred = model(xb)
                loss = crit(pred, yb)
                loss.backward()
                opt.step()

            model.eval()
            with torch.no_grad():
                vb = split.valid_idx or []
                if vb:
                    xv = X[vb]
                    yv = y[vb]
                    vloss = float(crit(model(xv), yv).item())
                else:
                    vloss = 0.0
            curve.append(vloss)
            best = min(best, vloss)

        tm = TrainedModel(arch="efficientnet", params=params)
        tm._torch_model = model
        tm._loss_curve = curve
        tm._best_val = best
        return tm
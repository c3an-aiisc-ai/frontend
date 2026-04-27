from ..core.stage import Stage
from ...Resources.Schemas.artifacts import CNNConfig, ModelConfig, UntrainedModel


class BuildEfficientNet(Stage[CNNConfig, UntrainedModel]):
    def __init__(self):
        super().__init__("build_model", CNNConfig, UntrainedModel)

    def run(self, inp: CNNConfig, **kwargs) -> UntrainedModel:
        params = {
            "in_channels": int(inp.in_channels),
            "num_classes": int(inp.num_classes),
            "image_size": int(inp.image_size),
            "hidden_dim": int(inp.hidden_dim),
            "pretrained": bool(inp.pretrained),
            "backbone": str(inp.backbone),
        }
        return UntrainedModel(arch="efficientnet", params=params)


class BuildMLP(Stage[ModelConfig, UntrainedModel]):
    def __init__(self):
        super().__init__("build_model", ModelConfig, UntrainedModel)

    def run(self, inp: ModelConfig, **kwargs) -> UntrainedModel:
        params = {
            "in_channels": 3,
            "num_classes": int(inp.out_dim),
            "image_size": int(inp.in_dim),
            "hidden_dim": int(inp.hidden),
            "pretrained": True,
            "backbone": "efficientnet-b0",
        }
        return UntrainedModel(arch="efficientnet", params=params)
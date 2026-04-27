from ..core.stage import Stage
from ...Resources.Schemas.artifacts import ModelConfig, UntrainedModel


class BuildLSTMAE(Stage[ModelConfig, UntrainedModel]):
    def __init__(self):
        super().__init__("build_model", ModelConfig, UntrainedModel)

    def run(self, inp: ModelConfig, **kwargs) -> UntrainedModel:
        params = {
            "in_dim": int(inp.in_dim),
            "hidden_dim": int(inp.hidden),
            "out_dim": int(inp.out_dim),
            "num_layers": int(kwargs.get("num_layers", 1)),
        }
        return UntrainedModel(arch="lstm_autoencoder", params=params)
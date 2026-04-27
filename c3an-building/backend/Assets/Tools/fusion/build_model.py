from ..core.stage import Stage
from ...Resources.Schemas.artifacts import FusionConfig, ModelConfig, UntrainedModel


class BuildFusionModel(Stage[FusionConfig, UntrainedModel]):
    def __init__(self):
        super().__init__("build_model", FusionConfig, UntrainedModel)

    def run(self, inp: FusionConfig, **kwargs) -> UntrainedModel:
        in_dim = int(inp.ts_dim + inp.img_dim)
        if inp.include_knowledge:
            in_dim += 1
        if inp.include_image_presence:
            in_dim += 1

        params = {
            "in_dim": in_dim,
            "hidden_dim": int(inp.hidden_dim),
            "out_dim": int(inp.out_dim),
            "ts_dim": int(inp.ts_dim),
            "img_dim": int(inp.img_dim),
            "include_knowledge": bool(inp.include_knowledge),
            "include_image_presence": bool(inp.include_image_presence),
        }
        return UntrainedModel(arch="fusion_mlp", params=params)


class BuildMLP(Stage[ModelConfig, UntrainedModel]):
    def __init__(self):
        super().__init__("build_model", ModelConfig, UntrainedModel)

    def run(self, inp: ModelConfig, **kwargs) -> UntrainedModel:
        return UntrainedModel(
            arch="fusion_mlp",
            params={
                "in_dim": int(inp.in_dim),
                "hidden_dim": int(inp.hidden),
                "out_dim": int(inp.out_dim),
                "ts_dim": int(kwargs.get("ts_dim", 3)),
                "img_dim": int(kwargs.get("img_dim", 5)),
                "include_knowledge": bool(kwargs.get("include_knowledge", True)),
                "include_image_presence": bool(kwargs.get("include_image_presence", True)),
            },
        )
from ..core.stage import Stage
from ...Resources.Schemas.artifacts import FusionFrameEncoded, FusionFrameSelected


class ImputeAndEncode(Stage[FusionFrameSelected, FusionFrameEncoded]):
    def __init__(self):
        super().__init__("impute_encode", FusionFrameSelected, FusionFrameEncoded)

    def run(self, inp: FusionFrameSelected, **kwargs) -> FusionFrameEncoded:
        ts_rows = [[float(v) for v in row] for row in (inp.ts_rows or [])]
        img_rows = [[float(v) for v in row] for row in (inp.img_rows or [])]
        y_target = [[float(v) for v in row] for row in (inp.y_target or [])]
        image_available = [int(v) for v in (inp.image_available or [])]
        knowledge_adjustment = [float(v) for v in (inp.knowledge_adjustment or [])]

        return FusionFrameEncoded(
            ts_rows=ts_rows,
            img_rows=img_rows,
            y_target=y_target,
            image_available=image_available,
            knowledge_adjustment=knowledge_adjustment,
        )
from ..core.stage import Stage
from ...Resources.Schemas.artifacts import FrameWithTargets, FusionFrameEncoded


class BuildTargets(Stage[FusionFrameEncoded, FrameWithTargets]):
    def __init__(self):
        super().__init__("build_targets", FusionFrameEncoded, FrameWithTargets)

    def run(self, inp: FusionFrameEncoded, **kwargs) -> FrameWithTargets:
        include_knowledge = bool(kwargs.get("include_knowledge", True))
        include_image_presence = bool(kwargs.get("include_image_presence", True))

        X = []
        y_next = []
        for ts_row, img_row, y_row, has_img, know in zip(
            inp.ts_rows or [],
            inp.img_rows or [],
            inp.y_target or [],
            inp.image_available or [],
            inp.knowledge_adjustment or [],
        ):
            feats = list(ts_row) + list(img_row)
            if include_knowledge:
                feats.append(float(know))
            if include_image_presence:
                feats.append(float(has_img))
            X.append([float(v) for v in feats])
            y_next.append([float(v) for v in y_row])

        return FrameWithTargets(X=X, y_next=y_next)
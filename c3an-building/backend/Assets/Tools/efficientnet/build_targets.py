from ..core.stage import Stage
from ...Resources.Schemas.artifacts import ImageFrameEncoded, ImageFrameWithTargets


class BuildTargets(Stage[ImageFrameEncoded, ImageFrameWithTargets]):
    def __init__(self):
        super().__init__("build_targets", ImageFrameEncoded, ImageFrameWithTargets)

    def run(self, inp: ImageFrameEncoded, **kwargs) -> ImageFrameWithTargets:
        return ImageFrameWithTargets(X_images=inp.X_images, y_next=inp.y_num, image_shape=inp.image_shape)
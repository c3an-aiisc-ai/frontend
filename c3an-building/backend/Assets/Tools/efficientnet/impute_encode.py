from typing import List

import numpy as np
from PIL import Image

from ..core.stage import Stage
from ...Resources.Schemas.artifacts import ImageFrameEncoded, ImageFrameSelected, LabelMap


class ImputeAndEncode(Stage[ImageFrameSelected, ImageFrameEncoded]):
    def __init__(self):
        super().__init__("impute_encode", ImageFrameSelected, ImageFrameEncoded)

    def run(self, inp: ImageFrameSelected, **kwargs) -> ImageFrameEncoded:
        image_size = int(kwargs.get("image_size", 224))

        to_int = {}
        to_str = {}
        next_id = 0

        X_images: List = []
        y_num: List[int] = []

        for path, label in zip(inp.image_paths or [], inp.y_raw or []):
            if label is None:
                label = "unknown"
            if label not in to_int:
                to_int[label] = next_id
                to_str[next_id] = label
                next_id += 1
            y_num.append(int(to_int[label]))

            img = Image.open(path).convert("RGB")
            img = img.resize((image_size, image_size))
            arr = np.asarray(img, dtype=np.float32) / 255.0
            X_images.append(arr.tolist())

        label_map = LabelMap(to_int=to_int, to_str=to_str)
        image_shape = [image_size, image_size, 3]
        return ImageFrameEncoded(X_images=X_images, y_num=y_num, label_map=label_map, image_shape=image_shape)
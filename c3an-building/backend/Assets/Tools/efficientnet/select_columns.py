from typing import List

from ..core.stage import Stage
from ...Resources.Schemas.artifacts import ImageFrameSelected, RawFrame


class SelectColumns(Stage[RawFrame, ImageFrameSelected]):
    def __init__(self):
        super().__init__("select_columns", RawFrame, ImageFrameSelected)

    def run(self, inp: RawFrame, **kwargs) -> ImageFrameSelected:
        feature_cols: List[str] = kwargs.get("feature_cols") or []
        label_col: str = kwargs.get("label_col")
        if not feature_cols or not label_col:
            raise ValueError("feature_cols and label_col are required")

        image_col = feature_cols[0]
        image_paths = []
        y_raw = []
        for row in inp.rows or []:
            image_paths.append(row.get(image_col))
            y_raw.append(row.get(label_col))

        return ImageFrameSelected(image_paths=image_paths, y_raw=y_raw)
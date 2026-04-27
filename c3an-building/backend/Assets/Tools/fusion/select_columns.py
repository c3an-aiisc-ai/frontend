from typing import List

from ..core.stage import Stage
from ...Resources.Schemas.artifacts import FusionFrameSelected, RawFrame


class SelectColumns(Stage[RawFrame, FusionFrameSelected]):
    def __init__(self):
        super().__init__("select_columns", RawFrame, FusionFrameSelected)

    def run(self, inp: RawFrame, **kwargs) -> FusionFrameSelected:
        ts_feature_cols: List[str] = kwargs.get("ts_feature_cols")
        img_feature_cols: List[str] = kwargs.get("img_feature_cols", [])
        target_cols: List[str] = kwargs.get("target_cols")
        image_present_col: str = kwargs.get("image_present_col", "has_image")
        knowledge_col: str = kwargs.get("knowledge_col", "knowledge_adjustment")

        if not ts_feature_cols or not target_cols:
            raise ValueError("ts_feature_cols and target_cols are required")

        ts_rows = []
        img_rows = []
        y_target = []
        image_available = []
        knowledge_adjustment = []

        for row in inp.rows or []:
            ts_rows.append([float(row.get(c, 0.0)) for c in ts_feature_cols])
            img_rows.append([float(row.get(c, 0.0)) for c in img_feature_cols])
            y_target.append([float(row.get(c, 0.0)) for c in target_cols])
            image_available.append(int(bool(row.get(image_present_col, len(img_feature_cols) > 0))))
            knowledge_adjustment.append(float(row.get(knowledge_col, 0.0)))

        return FusionFrameSelected(
            ts_rows=ts_rows,
            img_rows=img_rows,
            y_target=y_target,
            image_available=image_available,
            knowledge_adjustment=knowledge_adjustment,
        )
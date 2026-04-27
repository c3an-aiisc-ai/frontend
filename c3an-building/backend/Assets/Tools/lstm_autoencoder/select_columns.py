from typing import List

from ..core.stage import Stage
from ...Resources.Schemas.artifacts import FrameSelected, RawFrame


class SelectColumns(Stage[RawFrame, FrameSelected]):
    def __init__(self):
        super().__init__("select_columns", RawFrame, FrameSelected)

    def run(self, inp: RawFrame, **kwargs) -> FrameSelected:
        feature_cols: List[str] = kwargs.get("feature_cols")
        label_col: str = kwargs.get("label_col")
        if not feature_cols or not label_col:
            raise ValueError("feature_cols and label_col are required")

        X = []
        y_raw = []
        for row in inp.rows or []:
            X.append([float(row[c]) for c in feature_cols])
            y_raw.append(row[label_col])

        return FrameSelected(X=X, y_raw=y_raw)
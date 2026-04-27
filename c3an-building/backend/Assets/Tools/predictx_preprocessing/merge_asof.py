import pandas as pd

from ..core.stage import Stage
from ...Resources.Schemas.artifacts import RawFrame


class MergeAsof(Stage[RawFrame, RawFrame]):
    """Nearest-time merge of multimodal rows and cycle-management rows."""

    def __init__(self):
        super().__init__("merge_asof", RawFrame, RawFrame)

    def run(self, inp: RawFrame, **kwargs) -> RawFrame:
        cycle_frame: RawFrame = kwargs.get("cycle_frame")
        if cycle_frame is None:
            raise ValueError("cycle_frame is required")

        left_time_col = str(kwargs.get("left_time_col", "time"))
        right_time_col = str(kwargs.get("right_time_col", "_time_new"))
        direction = str(kwargs.get("direction", "nearest"))

        left = pd.DataFrame(inp.rows or [])
        right = pd.DataFrame(cycle_frame.rows or [])

        if left_time_col not in left.columns:
            raise ValueError(f"{left_time_col} missing from left frame")
        if right_time_col not in right.columns:
            raise ValueError(f"{right_time_col} missing from right frame")

        left[left_time_col] = pd.to_datetime(left[left_time_col])
        right[right_time_col] = pd.to_datetime(right[right_time_col])

        left = left.sort_values(left_time_col)
        right = right.sort_values(right_time_col)

        merged = pd.merge_asof(left, right, left_on=left_time_col, right_on=right_time_col, direction=direction)
        return RawFrame(rows=merged.to_dict(orient="records"))
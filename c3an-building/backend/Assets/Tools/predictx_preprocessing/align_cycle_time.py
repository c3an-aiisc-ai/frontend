import pandas as pd

from ..core.stage import Stage
from ...Resources.Schemas.artifacts import RawFrame


class AlignCycleTime(Stage[RawFrame, RawFrame]):
    """Aligns cycle-management timestamps to multimodal stream timestamps."""

    def __init__(self):
        super().__init__("align_cycle_time", RawFrame, RawFrame)

    def run(self, inp: RawFrame, **kwargs) -> RawFrame:
        time_col = str(kwargs.get("time_col", "_time"))
        out_col = str(kwargs.get("out_col", "_time_new"))
        keep_cols = kwargs.get("keep_cols", ["_time", "Description", "CycleState"])

        shift_hours = int(kwargs.get("shift_hours", 4))
        shift_minutes = int(kwargs.get("shift_minutes", 59))
        shift_seconds = int(kwargs.get("shift_seconds", 51))
        shift_millis = int(kwargs.get("shift_millis", 100))

        df = pd.DataFrame(inp.rows or [])
        if time_col not in df.columns:
            raise ValueError(f"{time_col} missing in cycle-management frame")

        if keep_cols:
            use_cols = [c for c in keep_cols if c in df.columns]
            df = df[use_cols]

        df[time_col] = pd.to_datetime(df[time_col]).dt.tz_localize(None)
        df[out_col] = df[time_col] - pd.Timedelta(
            hours=shift_hours,
            minutes=shift_minutes,
            seconds=shift_seconds,
            milliseconds=shift_millis,
        )

        return RawFrame(rows=df.to_dict(orient="records"))
import pandas as pd

from ..core.stage import Stage
from ...Resources.Schemas.artifacts import RawFrame


class FilterCycleState(Stage[RawFrame, RawFrame]):
    """Filters rows by cycle-state values (e.g. image focus stages 4 and 9)."""

    def __init__(self):
        super().__init__("filter_cycle_state", RawFrame, RawFrame)

    def run(self, inp: RawFrame, **kwargs) -> RawFrame:
        cycle_col = str(kwargs.get("cycle_col", "CycleState"))
        allowed = kwargs.get("allowed", [4, 9])
        allowed_set = {float(v) for v in allowed}

        df = pd.DataFrame(inp.rows or [])
        if cycle_col not in df.columns:
            raise ValueError(f"{cycle_col} missing")

        filtered = df[df[cycle_col].astype(float).isin(allowed_set)]
        return RawFrame(rows=filtered.to_dict(orient="records"))
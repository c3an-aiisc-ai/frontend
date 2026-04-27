import pandas as pd

from ..core.stage import Stage
from ...Resources.Schemas.artifacts import RawFrame


class BuildContinuousCycleState(Stage[RawFrame, RawFrame]):
    """Rebuilds continuous cycle count after zero resets (SmartPilot logic)."""

    def __init__(self):
        super().__init__("build_cycle_state", RawFrame, RawFrame)

    def run(self, inp: RawFrame, **kwargs) -> RawFrame:
        cycle_col = str(kwargs.get("cycle_col", "Q_Cell_CycleCount"))
        out_col = str(kwargs.get("out_col", "Cycle_State_New"))
        description_col = str(kwargs.get("description_col", "Description"))
        estop_label = str(kwargs.get("estop_label", "E_STOPPED"))

        df = pd.DataFrame(inp.rows or [])
        if cycle_col not in df.columns:
            raise ValueError(f"{cycle_col} missing")

        df[out_col] = pd.to_numeric(df[cycle_col], errors="coerce").fillna(0).astype(float)

        offset = 0.0
        for i in range(1, len(df)):
            if float(df.loc[i, cycle_col]) == 0.0:
                offset = float(df.loc[i - 1, out_col])
                if description_col in df.columns:
                    df.loc[i, description_col] = estop_label
            df.loc[i, out_col] = float(df.loc[i, out_col]) + offset

        return RawFrame(rows=df.to_dict(orient="records"))
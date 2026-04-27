import pandas as pd

from ..core.stage import Stage
from ...Resources.Schemas.artifacts import RawFrame


class DeriveActualState(Stage[RawFrame, RawFrame]):
    """Derives actual_state labels from Description and CycleState ranges."""

    def __init__(self):
        super().__init__("derive_actual_state", RawFrame, RawFrame)

    def run(self, inp: RawFrame, **kwargs) -> RawFrame:
        cycle_state_col = str(kwargs.get("cycle_state_col", "CycleState"))
        description_col = str(kwargs.get("description_col", "Description"))
        cycle_group_col = str(kwargs.get("cycle_group_col", "Cycle_State_New"))
        out_col = str(kwargs.get("out_col", "actual_state"))
        default_state = str(kwargs.get("default_state", "Normal"))

        df = pd.DataFrame(inp.rows or [])
        required = [cycle_state_col, description_col, cycle_group_col]
        missing = [c for c in required if c not in df.columns]
        if missing:
            raise ValueError(f"Missing columns for actual_state derivation: {missing}")

        df[out_col] = default_state

        def update_actual_state(group: pd.DataFrame) -> pd.DataFrame:
            anomaly = str(group[description_col].iloc[0])

            if anomaly == "E_STOPPED":
                group[out_col] = "E_STOPPED"
            elif anomaly == "NoNose":
                group.loc[group[cycle_state_col].between(8, 21), out_col] = "NoNose"
            elif anomaly == "NoNose,NoBody2":
                group.loc[group[cycle_state_col].between(6, 8), out_col] = "NoBody2"
                group.loc[group[cycle_state_col].between(8, 21), out_col] = "NoNose,NoBody2"
            elif anomaly == "NoNose,NoBody2,NoBody1":
                group.loc[group[cycle_state_col].between(4, 6), out_col] = "NoBody1"
                group.loc[group[cycle_state_col].between(6, 8), out_col] = "NoBody2,NoBody1"
                group.loc[group[cycle_state_col].between(8, 21), out_col] = "NoNose,NoBody2,NoBody1"

            return group

        df = df.groupby(cycle_group_col, group_keys=False).apply(update_actual_state)
        return RawFrame(rows=df.to_dict(orient="records"))
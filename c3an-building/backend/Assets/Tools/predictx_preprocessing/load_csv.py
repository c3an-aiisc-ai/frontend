import pandas as pd

from ..core.stage import Stage
from ...Resources.Schemas.artifacts import RawFrame


class LoadCSV(Stage[RawFrame, RawFrame]):
    def __init__(self):
        super().__init__("load_csv", RawFrame, RawFrame)

    def run(self, inp: RawFrame, **kwargs) -> RawFrame:
        csv_path = kwargs.get("csv_path")
        if not csv_path:
            raise ValueError("csv_path is required")
        df = pd.read_csv(csv_path, low_memory=False)
        return RawFrame(rows=df.to_dict(orient="records"))
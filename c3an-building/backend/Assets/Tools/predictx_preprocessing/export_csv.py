import pandas as pd

from ..core.stage import Stage
from ...Resources.Schemas.artifacts import RawFrame


class ExportCSV(Stage[RawFrame, RawFrame]):
    def __init__(self):
        super().__init__("export_csv", RawFrame, RawFrame)

    def run(self, inp: RawFrame, **kwargs) -> RawFrame:
        csv_path = kwargs.get("csv_path")
        if not csv_path:
            raise ValueError("csv_path is required")

        df = pd.DataFrame(inp.rows or [])
        df.to_csv(csv_path, index=bool(kwargs.get("index", False)))
        return inp
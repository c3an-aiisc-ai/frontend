from pathlib import Path

import pandas as pd

from ..core.stage import Stage
from ...Resources.Schemas.artifacts import RawFrame


class LoadImages(Stage[RawFrame, RawFrame]):
    def __init__(self):
        super().__init__("load_images", RawFrame, RawFrame)

    def run(self, inp: RawFrame, **kwargs) -> RawFrame:
        file_path = kwargs.get("file_path")
        if not file_path:
            raise ValueError("file_path is required")

        path = Path(file_path)
        if path.suffix.lower() == ".csv":
            df = pd.read_csv(path)
            return RawFrame(rows=df.to_dict(orient="records"))

        if not path.exists() or not path.is_dir():
            raise ValueError("file_path must be a CSV file or a directory")

        rows = []
        for img_path in path.rglob("*"):
            if img_path.suffix.lower() not in {".png", ".jpg", ".jpeg", ".bmp"}:
                continue
            label = img_path.parent.name
            rows.append({"image_path": str(img_path), "label": label})

        return RawFrame(rows=rows)
from pathlib import Path
from typing import Dict, Iterable, List, Optional

import pandas as pd

from ..core.stage import Stage
from ...Resources.Schemas.artifacts import RawFrame


def _iter_json_paths(json_paths: Optional[Iterable[str]], json_glob: Optional[str], data_dir: Optional[str]) -> List[Path]:
    paths: List[Path] = []
    if json_paths:
        paths.extend(Path(p) for p in json_paths)
    if json_glob:
        paths.extend(sorted(Path().glob(json_glob)))
    if data_dir:
        paths.extend(sorted(Path(data_dir).glob("data_*.json")))

    uniq = []
    seen = set()
    for p in paths:
        rp = p.resolve()
        if rp not in seen:
            seen.add(rp)
            uniq.append(rp)
    return uniq


class CombineMultimodalJSON(Stage[RawFrame, RawFrame]):
    """Replicates SmartPilot Combine_MM_Data notebook flattening logic."""

    def __init__(self):
        super().__init__("combine_multimodal_json", RawFrame, RawFrame)

    def run(self, inp: RawFrame, **kwargs) -> RawFrame:
        json_paths = kwargs.get("json_paths")
        json_glob = kwargs.get("json_glob")
        data_dir = kwargs.get("data_dir")
        time_col = str(kwargs.get("time_col", "time"))

        paths = _iter_json_paths(json_paths=json_paths, json_glob=json_glob, data_dir=data_dir)
        if not paths:
            raise ValueError("Provide json_paths, json_glob, or data_dir for multimodal JSON ingestion.")

        rows: List[Dict] = []
        for path in paths:
            tempd = pd.read_json(path)
            for idx in tempd:
                payload = tempd[idx]
                sensor_values = dict(payload.get("Sensor_values", {}))
                images = payload.get("Images", [])
                if isinstance(images, list):
                    sensor_values["Cam1"] = images[0] if len(images) > 0 else None
                    sensor_values["Cam2"] = images[1] if len(images) > 1 else None
                sensor_values[time_col] = idx
                rows.append(sensor_values)

        return RawFrame(rows=rows)
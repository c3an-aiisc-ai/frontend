from pathlib import Path
import json
from datetime import datetime
from typing import Any
from ..core.artifacts import Artifact
class RunFS:
    def __init__(self, repo_root: str):
        self.root = Path(repo_root).resolve()
        self.data = self.root / "Data"
        self.primary = self.data / "Primary"
        self.secondary = self.data / "Secondary"
        self.tertiary = self.data / "Tertiary"
        self.logs = self.data / "Logs"
        self.eds = self.data / "EDS"
        for p in [self.primary, self.secondary, self.tertiary, self.logs, self.eds]:
            p.mkdir(parents=True, exist_ok=True)
    def _ts(self) -> str:
        return datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    def write_json(self, bucket: str, name: str, obj: Any) -> str:
        bdir = getattr(self, bucket); path = bdir / f"{name}.{self._ts()}.json"
        path.write_text(json.dumps(obj, indent=2)); return str(path)
    def artifact_to(self, bucket: str, name: str, art: Artifact) -> str:
        return self.write_json(bucket, name, art.to_dict())

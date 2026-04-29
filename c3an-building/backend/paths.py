from __future__ import annotations

from pathlib import Path
from typing import Union

PathLike = Union[str, Path]

BACKEND_ROOT = Path(__file__).resolve().parent
REPO_ROOT = BACKEND_ROOT.parent


def resolve_backend_path(path_value: PathLike, *, must_exist: bool = False) -> Path:
    """Resolve repo-local paths against the migrated backend root."""
    path = Path(path_value)
    if path.is_absolute():
        resolved = path
    elif path.parts and path.parts[0].lower() == "backend":
        resolved = REPO_ROOT / path
    else:
        candidates = (
            Path.cwd() / path,
            BACKEND_ROOT / path,
            REPO_ROOT / path,
        )
        resolved = next((candidate for candidate in candidates if candidate.exists()), BACKEND_ROOT / path)

    resolved = resolved.resolve()
    if must_exist and not resolved.exists():
        raise FileNotFoundError(f"Path not found: {resolved}")
    return resolved

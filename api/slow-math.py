from __future__ import annotations

from vercel_backend import create_endpoint_app
from backend.app import slow_math

app = create_endpoint_app(slow_math, ["POST"], "/api/slow-math")

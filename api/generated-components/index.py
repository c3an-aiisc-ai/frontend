from __future__ import annotations

from vercel_backend import create_endpoint_app
from backend.app import generate_components

app = create_endpoint_app(generate_components, ["POST"], "/api/generated-components")

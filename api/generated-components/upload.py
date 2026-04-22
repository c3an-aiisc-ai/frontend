from __future__ import annotations

from vercel_backend import create_endpoint_app
from backend.app import upload_generated_components_script

app = create_endpoint_app(
    upload_generated_components_script,
    ["POST"],
    "/api/generated-components/upload",
)

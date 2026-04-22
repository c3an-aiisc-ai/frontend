from __future__ import annotations

from vercel_backend import create_endpoint_app, sample_script_from_query

app = create_endpoint_app(sample_script_from_query, ["GET"])

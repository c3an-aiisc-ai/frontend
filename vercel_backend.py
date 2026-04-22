from __future__ import annotations

import os
import sys
from pathlib import Path

from flask import Flask, request

PROJECT_DIR = Path(__file__).resolve().parent / "c3an-building"
if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

from backend.app import get_sample_generated_components_script  # noqa: E402


def create_endpoint_app(view_func, methods: list[str], route_path: str) -> Flask:
    app = Flask(__name__)
    app.secret_key = os.environ.get("FLASK_SECRET_KEY", "c3an-demo-secret")
    app.add_url_rule("/", view_func=view_func, methods=methods)
    app.add_url_rule(route_path, view_func=view_func, methods=methods)
    if route_path != "/" and not route_path.endswith("/"):
        app.add_url_rule(f"{route_path}/", view_func=view_func, methods=methods)
    return app


def sample_script_from_query():
    script_name = request.args.get("name", "").strip()
    return get_sample_generated_components_script(script_name)

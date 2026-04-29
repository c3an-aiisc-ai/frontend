from __future__ import annotations

import os

from flask import Flask

from backend.app import (
    auth_session,
    create_item,
    delete_item,
    generate_components,
    get_agent_manifest,
    get_agent_registry,
    get_sample_generated_components_script,
    get_item,
    list_agent_tools,
    list_items,
    list_saved_plans,
    login_user,
    logout_user,
    register_user,
    route_smart_pilot_question_endpoint,
    run_agent_tool_endpoint,
    run_smart_pilot_workflow_endpoint,
    save_generated_plans,
    slow_math,
    slow_number,
    update_item,
    upload_generated_components_script,
)

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "c3an-demo-secret")

app.add_url_rule("/slow-math", view_func=slow_math, methods=["POST"])
app.add_url_rule("/slow-number", view_func=slow_number, methods=["POST"])
app.add_url_rule("/generated-components", view_func=generate_components, methods=["POST"])
app.add_url_rule(
    "/generated-components/upload",
    view_func=upload_generated_components_script,
    methods=["POST"],
)
app.add_url_rule(
    "/generated-components/sample-script/<script_name>",
    view_func=get_sample_generated_components_script,
    methods=["GET"],
)
app.add_url_rule("/agents/registry", view_func=get_agent_registry, methods=["GET"])
app.add_url_rule("/agents/<agent_id>", view_func=get_agent_manifest, methods=["GET"])
app.add_url_rule("/agents/<agent_id>/tools", view_func=list_agent_tools, methods=["GET"])
app.add_url_rule(
    "/agents/<agent_id>/tools/<tool_name>/run",
    view_func=run_agent_tool_endpoint,
    methods=["POST"],
)
app.add_url_rule(
    "/workflows/smart-pilot/run",
    view_func=run_smart_pilot_workflow_endpoint,
    methods=["POST"],
)
app.add_url_rule(
    "/workflows/smart-pilot/route",
    view_func=route_smart_pilot_question_endpoint,
    methods=["POST"],
)
app.add_url_rule("/auth/session", view_func=auth_session, methods=["GET"])
app.add_url_rule("/auth/register", view_func=register_user, methods=["POST"])
app.add_url_rule("/auth/login", view_func=login_user, methods=["POST"])
app.add_url_rule("/auth/logout", view_func=logout_user, methods=["POST"])
app.add_url_rule("/account/plans", view_func=list_saved_plans, methods=["GET"])
app.add_url_rule("/account/plans", view_func=save_generated_plans, methods=["POST"])
app.add_url_rule("/items", view_func=list_items, methods=["GET"])
app.add_url_rule("/items", view_func=create_item, methods=["POST"])
app.add_url_rule("/items/<int:item_id>", view_func=get_item, methods=["GET"])
app.add_url_rule("/items/<int:item_id>", view_func=update_item, methods=["PUT"])
app.add_url_rule("/items/<int:item_id>", view_func=delete_item, methods=["DELETE"])

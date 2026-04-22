import json
import time

print("starting logged bridge sample")
time.sleep(0.2)
print("building payload")

payload = {
    "plans": [
        {
            "id": "sample-plan-logged",
            "task_id": "sample-plan-logged",
            "name": "Sample Logged Plan",
            "query": "This script logs before printing the JSON payload.",
            "sub_tasks": [
                {
                    "sub_task_id": "logged-step-1",
                    "name": "Prepare",
                    "description": "Prepare inputs.",
                },
                {
                    "sub_task_id": "logged-step-2",
                    "name": "Assemble",
                    "description": "Assemble generated pieces.",
                },
                {
                    "sub_task_id": "logged-step-3",
                    "name": "Publish",
                    "description": "Publish the output payload.",
                },
            ],
            "triples": [
                {"from": "logged-step-1", "op": "seq", "to": "logged-step-2"},
                {"from": "logged-step-2", "op": "seq", "to": "logged-step-3"},
            ],
        }
    ],
    "agents": [
        {
            "id": "sample-agent-logged",
            "name": "Sample Logged Agent",
            "description": "An uploaded agent from a script with log output.",
            "capabilities": ["logging", "upload validation"],
            "input_data_streams": {"mandatory": ["logged-step-2-output"], "optional": ["notes"]},
            "output_data_streams": {"mandatory": ["logged-step-3-ready"], "optional": []},
        }
    ],
    "tools": [
        {
            "name": "Sample Logged Tool",
            "tagline": "Generated after printing log lines.",
            "gradient": "from-sky-100 via-white to-emerald-100",
            "ring": "ring-sky-200",
            "accent": "bg-sky-600",
            "inputCount": 2,
            "outputCount": 1,
            "inputRequired": [True, False],
            "outputRequired": [True],
            "inputNames": ["payload", "notes"],
            "outputNames": ["published output"],
        }
    ],
}

print(json.dumps(payload))

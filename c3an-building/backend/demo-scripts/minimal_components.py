import json

payload = {
    "plans": [
        {
            "id": "sample-plan-minimal",
            "task_id": "sample-plan-minimal",
            "name": "Sample Minimal Plan",
            "query": "A minimal uploaded plan for testing the Flask bridge.",
            "sub_tasks": [
                {
                    "sub_task_id": "sample-step-1",
                    "name": "Collect input",
                    "description": "Read the uploaded request.",
                },
                {
                    "sub_task_id": "sample-step-2",
                    "name": "Return output",
                    "description": "Emit generated workflow elements.",
                },
            ],
            "triples": [{"from": "sample-step-1", "op": "seq", "to": "sample-step-2"}],
        }
    ],
    "agents": [
        {
            "id": "sample-agent-minimal",
            "name": "Sample Minimal Agent",
            "description": "A minimal uploaded agent.",
            "capabilities": ["testing", "bridge upload"],
            "input_data_streams": {"mandatory": ["sample-step-1-output"], "optional": []},
            "output_data_streams": {"mandatory": ["sample-step-2-ready"], "optional": []},
        }
    ],
    "tools": [
        {
            "name": "Sample Minimal Tool",
            "tagline": "A minimal uploaded tool.",
            "gradient": "from-amber-100 via-white to-rose-100",
            "ring": "ring-amber-200",
            "accent": "bg-amber-600",
            "inputCount": 1,
            "outputCount": 1,
            "inputRequired": [True],
            "outputRequired": [False],
            "inputNames": ["request"],
            "outputNames": ["result"],
        }
    ],
}

print(json.dumps(payload))

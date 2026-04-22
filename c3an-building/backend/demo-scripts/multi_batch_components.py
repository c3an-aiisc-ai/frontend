import json

payload = {
    "plans": [
        {
            "id": "sample-plan-alpha",
            "task_id": "sample-plan-alpha",
            "name": "Sample Alpha Plan",
            "query": "The first uploaded plan in a multi-component batch.",
            "sub_tasks": [
                {
                    "sub_task_id": "alpha-step-1",
                    "name": "Alpha intake",
                    "description": "Read alpha inputs.",
                },
                {
                    "sub_task_id": "alpha-step-2",
                    "name": "Alpha output",
                    "description": "Emit alpha outputs.",
                },
            ],
            "triples": [{"from": "alpha-step-1", "op": "seq", "to": "alpha-step-2"}],
        },
        {
            "id": "sample-plan-beta",
            "task_id": "sample-plan-beta",
            "name": "Sample Beta Plan",
            "query": "The second uploaded plan in a multi-component batch.",
            "sub_tasks": [
                {
                    "sub_task_id": "beta-step-1",
                    "name": "Beta intake",
                    "description": "Read beta inputs.",
                },
                {
                    "sub_task_id": "beta-step-2",
                    "name": "Beta output",
                    "description": "Emit beta outputs.",
                },
            ],
            "triples": [{"from": "beta-step-1", "op": "seq", "to": "beta-step-2"}],
        },
    ],
    "agents": [
        {
            "id": "sample-agent-alpha",
            "name": "Sample Alpha Agent",
            "description": "First uploaded sample agent.",
            "capabilities": ["alpha processing"],
            "input_data_streams": {"mandatory": ["alpha-step-1-output"], "optional": []},
            "output_data_streams": {"mandatory": ["alpha-step-2-ready"], "optional": []},
        },
        {
            "id": "sample-agent-beta",
            "name": "Sample Beta Agent",
            "description": "Second uploaded sample agent.",
            "capabilities": ["beta processing"],
            "input_data_streams": {"mandatory": ["beta-step-1-output"], "optional": ["notes"]},
            "output_data_streams": {"mandatory": ["beta-step-2-ready"], "optional": []},
        },
    ],
    "tools": [
        {
            "name": "Sample Alpha Tool",
            "tagline": "First uploaded sample tool.",
            "gradient": "from-amber-100 via-white to-rose-100",
            "ring": "ring-amber-200",
            "accent": "bg-amber-600",
            "inputCount": 1,
            "outputCount": 1,
            "inputRequired": [True],
            "outputRequired": [True],
            "inputNames": ["alpha input"],
            "outputNames": ["alpha output"],
        },
        {
            "name": "Sample Beta Tool",
            "tagline": "Second uploaded sample tool.",
            "gradient": "from-emerald-100 via-white to-sky-100",
            "ring": "ring-emerald-200",
            "accent": "bg-emerald-600",
            "inputCount": 2,
            "outputCount": 2,
            "inputRequired": [True, False],
            "outputRequired": [True, False],
            "inputNames": ["beta input", "context"],
            "outputNames": ["beta output", "status"],
        },
    ],
}

print(json.dumps(payload))

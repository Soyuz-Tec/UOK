from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command


def test_planning_core_schedule_authority_and_security(client: TestClient) -> None:
    suffix = str(uuid4())[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    viewer = auth(client, "viewer", "viewer123")

    install = client.post("/api/modules/planning.core/install", headers=admin)
    assert install.status_code == 200, install.text
    assert install.json()["status"] == "installed"

    denied = command(
        client,
        viewer,
        "CreatePlanningProject",
        {"name": f"Denied Plan {suffix}", "start": "2026-08-01", "end": "2026-08-10"},
        f"planning-denied-{suffix}",
    )
    assert denied.status_code == 403, denied.text

    project = command(
        client,
        ops,
        "CreatePlanningProject",
        {"name": f"Launch Plan {suffix}", "start": "2026-08-01", "end": "2026-08-15"},
        f"planning-project-{suffix}",
    )
    assert project.status_code == 200, project.text
    project_id = project.json()["result"]["id"]

    first = command(
        client,
        ops,
        "CreatePlanningTask",
        {"project_id": project_id, "title": "Foundation", "start": "2026-08-01", "end": "2026-08-03", "progress": 25},
        f"planning-task-a-{suffix}",
    )
    second = command(
        client,
        ops,
        "CreatePlanningTask",
        {"project_id": project_id, "title": "Build", "start": "2026-08-04", "end": "2026-08-08"},
        f"planning-task-b-{suffix}",
    )
    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text

    linked = command(
        client,
        ops,
        "LinkPlanningTasks",
        {
            "project_id": project_id,
            "predecessor_task_id": first.json()["result"]["id"],
            "successor_task_id": second.json()["result"]["id"],
        },
        f"planning-link-{suffix}",
    )
    assert linked.status_code == 200, linked.text
    assert linked.json()["result"]["validation"]["ok"] is True

    rescheduled = command(
        client,
        ops,
        "UpdatePlanningTask",
        {"task_id": second.json()["result"]["id"], "start": "2026-08-05", "end": "2026-08-10"},
        f"planning-reschedule-{suffix}",
    )
    assert rescheduled.status_code == 200, rescheduled.text
    assert rescheduled.json()["result"]["validation"]["ok"] is True

    cycle = command(
        client,
        ops,
        "LinkPlanningTasks",
        {
            "project_id": project_id,
            "predecessor_task_id": second.json()["result"]["id"],
            "successor_task_id": first.json()["result"]["id"],
        },
        f"planning-cycle-{suffix}",
    )
    assert cycle.status_code == 400, cycle.text
    assert "cycle" in cycle.text

    schedule = client.get(f"/api/planning/projects/{project_id}/schedule", headers=viewer)
    assert schedule.status_code == 200, schedule.text
    body = schedule.json()
    assert body["validation"]["ok"] is True
    assert len(body["tasks"]) == 2
    assert len(body["dependencies"]) == 1
    assert any(task["critical"] for task in body["tasks"])

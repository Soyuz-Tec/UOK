from __future__ import annotations

from uuid import UUID, uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.db import SessionLocal
from uok.models import CommandLog
from uok.util import loads


def test_task_status_registry_and_transitions_are_server_controlled(client: TestClient) -> None:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    assert client.post("/api/modules/planning.core/install", headers=admin).status_code == 200
    project = command(
        client,
        ops,
        "CreatePlanningProject",
        {"name": f"Status policy {suffix}", "start": "2026-08-03", "end": "2026-08-28"},
        f"status-project-{suffix}",
    )
    project_id = project.json()["result"]["id"]

    invalid_rest = client.post(
        f"/api/planning/projects/{project_id}/tasks",
        headers={
            **ops,
            "If-Match": project.headers["ETag"],
            "Idempotency-Key": f"status-invalid-rest-{suffix}",
        },
        json={"title": "Invalid status", "start": "2026-08-03", "end": "2026-08-04", "status": "mystery"},
    )
    assert invalid_rest.status_code == 422, invalid_rest.text
    request_error = invalid_rest.json()["error"]
    assert request_error["code"] == "planning_request_invalid"
    assert request_error["field"] == "status"
    assert request_error["object_ids"] == [project_id]
    assert request_error["current_revision"] is None
    assert str(UUID(request_error["correlation_id"])) == request_error["correlation_id"]

    invalid_generic = command(
        client,
        ops,
        "CreatePlanningTask",
        {"project_id": project_id, "title": "Invalid generic status", "start": "2026-08-03", "end": "2026-08-04", "status": "mystery"},
        f"status-invalid-generic-{suffix}",
    )
    assert invalid_generic.status_code == 400, invalid_generic.text
    assert invalid_generic.json()["error"]["field"] == "status"

    created = command(
        client,
        ops,
        "CreatePlanningTask",
        {"project_id": project_id, "title": "Controlled task", "start": "2026-08-03", "end": "2026-08-04"},
        f"status-task-{suffix}",
    )
    task_id = created.json()["result"]["id"]
    in_progress = command(client, ops, "UpdatePlanningTask", {"task_id": task_id, "status": "in_progress"}, f"status-progress-{suffix}")
    assert in_progress.status_code == 200, in_progress.text
    completed = command(client, ops, "UpdatePlanningTask", {"task_id": task_id, "status": "complete"}, f"status-complete-{suffix}")
    assert completed.status_code == 200, completed.text

    rejected = command(client, ops, "UpdatePlanningTask", {"task_id": task_id, "status": "blocked"}, f"status-invalid-transition-{suffix}")
    assert rejected.status_code == 400, rejected.text
    error = rejected.json()["error"]
    assert error["code"] == "planning_status_transition_invalid"
    assert error["field"] == "status"
    assert error["object_ids"] == [task_id]
    assert error["current_revision"] == completed.json()["result"]["revision"]
    assert "planned" in error["repair"] and "in_progress" in error["repair"]
    with SessionLocal() as db:
        log = db.get(CommandLog, error["correlation_id"])
        assert log is not None
        assert log.status == "validation_error"
        assert loads(log.response_json) == {"error": error}

    schedule = client.get(f"/api/planning/projects/{project_id}/schedule", headers=ops)
    assert schedule.status_code == 200, schedule.text
    assert schedule.json()["tasks"][0]["status"] == "complete"

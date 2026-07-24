from __future__ import annotations

from uuid import UUID, uuid4

from starlette.testclient import TestClient

from tests.helpers import auth
from uok.host.database import SessionLocal
from uok.kernel_models import CommandLog
from uok.util import loads


DOMAIN_KEYS = {
    "code",
    "message",
    "field",
    "object_ids",
    "repair",
    "current_revision",
    "correlation_id",
}


def test_planning_failures_share_structured_auditable_contract(client: TestClient) -> None:
    suffix = str(uuid4())[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    viewer = auth(client, "viewer", "viewer123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    assert client.post("/api/modules/planning.core/install", headers=admin).status_code == 200

    project = client.post(
        "/api/planning/projects",
        headers={**ops, "Idempotency-Key": f"structured-project-{suffix}"},
        json={"name": f"Structured errors {suffix}", "start": "2026-08-03", "end": "2026-08-28"},
    )
    assert project.status_code == 200, project.text
    project_id = project.json()["id"]
    etag = project.headers["ETag"]

    invalid = client.post(
        f"/api/planning/projects/{project_id}/tasks",
        headers={
            **ops,
            "If-Match": etag,
            "Idempotency-Key": f"structured-validation-{suffix}",
        },
        json={"title": "Invalid task", "start": "2026-08-10", "end": "2026-08-05"},
    )
    assert invalid.status_code == 400, invalid.text
    invalid_error = invalid.json()["error"]
    assert set(invalid_error) == DOMAIN_KEYS
    assert invalid_error == {
        "code": "planning_validation_failed",
        "message": "task end must be on or after start",
        "field": "end",
        "object_ids": [project_id],
        "repair": "Correct the identified Planning input against the latest schedule, then retry the same user intent.",
        "current_revision": 1,
        "correlation_id": invalid_error["correlation_id"],
    }
    _assert_uuid(invalid_error["correlation_id"])
    _assert_logged_error(invalid_error, "validation_error")

    missing = client.post(
        f"/api/planning/projects/{project_id}/tasks",
        headers={**ops, "Idempotency-Key": f"structured-precondition-{suffix}"},
        json={"title": "Missing precondition", "start": "2026-08-03", "end": "2026-08-05"},
    )
    assert missing.status_code == 428, missing.text
    missing_error = missing.json()["error"]
    assert missing_error["code"] == "precondition_required"
    assert missing_error["field"] == "If-Match"
    assert missing_error["object_ids"] == [project_id]
    assert missing_error["current_revision"] == 1
    _assert_uuid(missing_error["correlation_id"])
    _assert_logged_error(missing_error, "validation_error")

    denied = client.post(
        f"/api/planning/projects/{project_id}/baselines",
        headers={
            **viewer,
            "If-Match": etag,
            "Idempotency-Key": f"structured-permission-{suffix}",
        },
        json={"name": "Denied baseline"},
    )
    assert denied.status_code == 403, denied.text
    denied_error = denied.json()["error"]
    assert set(denied_error) == DOMAIN_KEYS
    assert denied_error["code"] == "permission_denied"
    assert denied_error["field"] is None
    assert denied_error["object_ids"] == [project_id]
    assert denied_error["current_revision"] is None
    assert "planning.baseline.create" in denied_error["message"]
    _assert_uuid(denied_error["correlation_id"])
    _assert_logged_error(denied_error, "denied")

    generic = client.post(
        "/api/commands",
        headers=ops,
        json={
            "command_type": "CreatePlanningProject",
            "payload": {"name": "Invalid generic project", "start": "2026-08-10", "end": "2026-08-05"},
            "idempotency_key": f"structured-generic-{suffix}",
        },
    )
    assert generic.status_code == 400, generic.text
    generic_error = generic.json()["error"]
    assert set(generic_error) == DOMAIN_KEYS
    assert generic_error["code"] == "planning_validation_failed"
    assert generic_error["field"] == "end"
    assert generic_error["current_revision"] is None
    _assert_uuid(generic_error["correlation_id"])
    _assert_logged_error(generic_error, "validation_error")

    task_key = f"structured-conflict-{suffix}"
    task_headers = {**ops, "If-Match": etag, "Idempotency-Key": task_key}
    accepted = client.post(
        f"/api/planning/projects/{project_id}/tasks",
        headers=task_headers,
        json={"title": "Accepted task", "start": "2026-08-03", "end": "2026-08-05"},
    )
    assert accepted.status_code == 200, accepted.text
    conflict = client.post(
        f"/api/planning/projects/{project_id}/tasks",
        headers=task_headers,
        json={"title": "Changed intent", "start": "2026-08-03", "end": "2026-08-05"},
    )
    assert conflict.status_code == 409, conflict.text
    conflict_error = conflict.json()["error"]
    assert conflict_error["code"] == "idempotency_conflict"
    assert conflict_error["field"] == "idempotency_key"
    assert conflict_error["object_ids"] == [project_id]
    assert conflict_error["correlation_id"] == accepted.json()["correlation_id"]


def _assert_uuid(value: str) -> None:
    assert str(UUID(value)) == value


def _assert_logged_error(error: dict[str, object], status: str) -> None:
    with SessionLocal() as db:
        log = db.get(CommandLog, str(error["correlation_id"]))
        assert log is not None
        assert log.status == status
        assert loads(log.response_json) == {"error": error}

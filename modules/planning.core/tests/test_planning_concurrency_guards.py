from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command


def test_actor_visible_calendar_context_changes_etag_without_planning_revision(client: TestClient) -> None:
    _, ops = _planning_users(client)
    suffix = str(uuid4())[:8]
    project = _command(
        client,
        ops,
        "CreatePlanningProject",
        {"name": f"Context ETag {suffix}", "start": "2026-08-03", "end": "2026-08-28"},
        f"context-project-{suffix}",
    )
    project_id = project.json()["result"]["id"]
    party = command(client, ops, "CreateContact", {
        "display_name": f"ETag resource party {suffix}", "visibility_scope": "organization",
    }, f"context-party-{suffix}")
    party_id = party.json()["result"]["contact_id"]
    task = command(client, ops, "CreatePlanningTask", {
        "project_id": project_id, "title": "Context task", "start": "2026-08-10", "end": "2026-08-10",
    }, f"context-task-{suffix}")
    resource = command(client, ops, "CreatePlanningResource", {
        "project_id": project_id, "name": "Context resource", "canonical_target_kind": "party", "canonical_target_id": party_id,
    }, f"context-resource-{suffix}")
    resource_id = resource.json()["result"]["resources"][0]["id"]
    command(client, ops, "AssignPlanningResource", {
        "task_id": task.json()["result"]["id"], "resource_id": resource_id, "allocation_percent": 100,
    }, f"context-assignment-{suffix}")
    before = _schedule(client, ops, project_id)
    revision = before.json()["project"]["revision"]

    calendar = command(
        client,
        ops,
        "CreateCalendar",
        {"name": f"Context calendar {suffix}", "timezone": "UTC", "visibility_scope": "organization"},
        f"context-calendar-{suffix}",
    )
    assert calendar.status_code == 200, calendar.text
    event = command(
        client,
        ops,
        "CreateCalendarEvent",
        {
            "calendar_id": calendar.json()["result"]["id"],
            "title": "Actor-visible schedule context",
            "starts_at": "2026-08-10T13:00:00+00:00",
            "ends_at": "2026-08-10T14:00:00+00:00",
            "transparency": "busy",
            "participants": [{"participant_type": "party", "participant_id": party_id}],
        },
        f"context-event-{suffix}",
    )
    assert event.status_code == 200, event.text

    after = _schedule(client, ops, project_id)
    assert after.json()["project"]["revision"] == revision
    assert after.headers["ETag"] != before.headers["ETag"]
    assert any(row["title"] == "Actor-visible schedule context" for row in after.json()["availability"]["busy"])


def test_generic_command_rejects_a_conflicting_project_and_target_object(client: TestClient) -> None:
    _, ops = _planning_users(client)
    suffix = str(uuid4())[:8]
    project_a = _command(client, ops, "CreatePlanningProject", {"name": f"Aggregate A {suffix}", "start": "2026-08-03", "end": "2026-08-28"}, f"aggregate-a-{suffix}")
    project_b = _command(client, ops, "CreatePlanningProject", {"name": f"Aggregate B {suffix}", "start": "2026-08-03", "end": "2026-08-28"}, f"aggregate-b-{suffix}")
    project_a_id = project_a.json()["result"]["id"]
    project_b_id = project_b.json()["result"]["id"]
    task = _command(
        client,
        ops,
        "CreatePlanningTask",
        {"project_id": project_b_id, "title": "Protected aggregate task", "start": "2026-08-03", "end": "2026-08-05"},
        f"aggregate-task-{suffix}",
        project_b.headers["ETag"],
    )
    task_id = task.json()["result"]["id"]
    before_a = _schedule(client, ops, project_a_id)
    before_b = _schedule(client, ops, project_b_id)

    rejected = _command(
        client,
        ops,
        "UpdatePlanningTask",
        {"project_id": project_a_id, "task_id": task_id, "progress": 80},
        f"aggregate-conflict-{suffix}",
        before_a.headers["ETag"],
    )
    assert rejected.status_code == 400, rejected.text
    error = rejected.json()["error"]
    assert error["code"] == "planning_validation_failed"
    assert error["field"] == "project_id"
    assert error["object_ids"] == [project_a_id, task_id]
    assert error["current_revision"] is None
    assert error["correlation_id"]
    assert "project_id does not match its target object" in error["message"]
    after_a = _schedule(client, ops, project_a_id)
    after_b = _schedule(client, ops, project_b_id)
    assert after_a.headers["ETag"] == before_a.headers["ETag"]
    assert after_b.headers["ETag"] == before_b.headers["ETag"]
    assert after_b.json()["tasks"][0]["progress"] == 0


def test_concurrency_migration_is_additive_and_scoped() -> None:
    text = (Path(__file__).parents[1] / "migrations" / "002_planning_optimistic_concurrency.sql").read_text(encoding="utf-8")
    assert "ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 1" in text
    assert "ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1" in text
    assert "DROP " not in text.upper()
    assert "TRUNCATE " not in text.upper()


def _planning_users(client: TestClient) -> tuple[dict[str, str], dict[str, str]]:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    assert client.post("/api/modules/contacts.core/install", headers=admin).status_code == 200
    assert client.post("/api/modules/planning.core/install", headers=admin).status_code == 200
    return admin, ops


def _schedule(client: TestClient, headers: dict[str, str], project_id: str):
    response = client.get(f"/api/planning/projects/{project_id}/schedule", headers=headers)
    assert response.status_code == 200, response.text
    return response


def _command(
    client: TestClient,
    headers: dict[str, str],
    command_type: str,
    payload: dict[str, object],
    key: str,
    etag: str | None = None,
):
    request_headers = {**headers, **({"If-Match": etag} if etag else {})}
    return client.post("/api/commands", headers=request_headers, json={
        "command_type": command_type,
        "payload": payload,
        "idempotency_key": key,
    })

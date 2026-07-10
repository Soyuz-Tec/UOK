from __future__ import annotations

from uuid import uuid4

from sqlalchemy import func, select, text
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.db import SessionLocal
from uok.models import (
    CommandLog,
    EventRecord,
    PlanningOutboxEvent,
    PlanningProject,
    PlanningScheduleEvent,
    PlanningScheduleRevision,
    PlanningTask,
)
from uok.util import loads
from uok_planning_core.project_lifecycle import PROJECT_STATUS_TRANSITIONS


def test_project_transition_graph_is_exact_and_purge_is_internal() -> None:
    assert PROJECT_STATUS_TRANSITIONS == {
        "draft": {"active", "archived"},
        "active": {"on_hold", "completed", "archived"},
        "on_hold": {"active", "completed", "archived"},
        "completed": {"active", "archived"},
        "archived": {"active"},
        "purged": set(),
    }


def test_transition_rest_correlation_replay_archived_guards_and_restore(client: TestClient) -> None:
    suffix, ops, project_id = _project(client)
    first = command(client, ops, "CreatePlanningTask", {
        "project_id": project_id, "title": "First", "start": "2026-08-03", "end": "2026-08-04",
    }, f"lifecycle-first-{suffix}")
    second = command(client, ops, "CreatePlanningTask", {
        "project_id": project_id, "title": "Second", "start": "2026-08-05", "end": "2026-08-06",
    }, f"lifecycle-second-{suffix}")
    linked = command(client, ops, "LinkPlanningTasks", {
        "project_id": project_id,
        "predecessor_task_id": first.json()["result"]["id"],
        "successor_task_id": second.json()["result"]["id"],
    }, f"lifecycle-link-{suffix}")
    dependency_id = linked.json()["result"]["dependencies"][0]["id"]
    before = _schedule(client, ops, project_id)

    archived = _transition(client, ops, project_id, before.headers["ETag"], "archived", "Plan retained for audit", f"lifecycle-archive-{suffix}")
    assert archived.status_code == 200, archived.text
    result = archived.json()
    assert result["status"] == "archived"
    assert result["revision"] == before.json()["project"]["revision"] + 1
    correlation_id = result["correlation_id"]

    with SessionLocal() as db:
        module_event = db.scalar(select(EventRecord).where(
            EventRecord.event_type == "PlanningProjectTransitioned", EventRecord.object_id == project_id,
        ))
        schedule_event = db.scalar(select(PlanningScheduleEvent).where(
            PlanningScheduleEvent.project_id == project_id, PlanningScheduleEvent.event_type == "project_transitioned",
        ).order_by(PlanningScheduleEvent.created_at.desc()))
        revision = db.scalar(select(PlanningScheduleRevision).where(PlanningScheduleRevision.correlation_id == correlation_id))
        outbox = db.scalar(select(PlanningOutboxEvent).where(PlanningOutboxEvent.correlation_id == correlation_id))
        expected_event = {
            "project_id": project_id, "from_status": "active", "target_status": "archived",
            "reason": "Plan retained for audit", "correlation_id": correlation_id,
        }
        assert module_event
        module_payload = loads(module_event.payload_json)
        assert {key: module_payload[key] for key in expected_event} == expected_event
        assert schedule_event and loads(schedule_event.payload_json) == expected_event
        assert revision and revision.command_type == "TransitionPlanningProject"
        assert outbox and outbox.schedule_revision_id == revision.id
        evidence_counts = _evidence_counts(db, project_id)
        task_versions = dict(db.execute(select(PlanningTask.id, PlanningTask.version).where(PlanningTask.project_id == project_id)).all())

    replay = _transition(client, ops, project_id, archived.headers["ETag"], "archived", "Plan retained for audit", f"lifecycle-archive-{suffix}")
    assert replay.status_code == 200 and replay.json() == result
    assert replay.headers["ETag"] == archived.headers["ETag"]
    with SessionLocal() as db:
        assert _evidence_counts(db, project_id) == evidence_counts

    blocked_commands = [
        ("CreatePlanningTask", {"project_id": project_id, "title": "Blocked", "start": "2026-08-03", "end": "2026-08-03"}),
        ("UpdatePlanningDependency", {"dependency_id": dependency_id, "lag_days": 1}),
        ("BatchPlanningOperations", {"project_id": project_id, "operations": []}),
        ("CreatePlanningWhatIfSnapshot", {"project_id": project_id, "name": "Blocked", "task_changes": [{"task_id": first.json()["result"]["id"], "progress": 5}]}),
    ]
    for index, (command_type, payload) in enumerate(blocked_commands):
        rejected = command(client, ops, command_type, payload, f"lifecycle-blocked-{index}-{suffix}")
        assert rejected.status_code == 400, rejected.text
        assert rejected.json()["error"]["code"] == "planning_project_archived"
    same_state = _transition(client, ops, project_id, archived.headers["ETag"], "archived", "No duplicate", f"lifecycle-same-{suffix}")
    assert same_state.status_code == 400
    assert same_state.json()["error"]["code"] == "planning_project_transition_invalid"
    assert _schedule(client, ops, project_id).json()["project"]["status"] == "archived"
    assert client.get(f"/api/planning/projects/{project_id}/revisions", headers=ops).status_code == 200
    with SessionLocal() as db:
        assert _evidence_counts(db, project_id) == evidence_counts
        assert dict(db.execute(select(PlanningTask.id, PlanningTask.version).where(PlanningTask.project_id == project_id)).all()) == task_versions

    restored = _transition(client, ops, project_id, archived.headers["ETag"], "active", "Work resumed", f"lifecycle-restore-{suffix}")
    assert restored.status_code == 200 and restored.json()["status"] == "active"
    resumed = command(client, ops, "CreatePlanningTask", {
        "project_id": project_id, "title": "Resumed", "start": "2026-08-07", "end": "2026-08-07",
    }, f"lifecycle-resumed-{suffix}")
    assert resumed.status_code == 200, resumed.text


def test_invalid_and_purged_transitions_fail_without_schedule_evidence(client: TestClient) -> None:
    suffix, ops, project_id = _project(client)
    schedule = _schedule(client, ops, project_id)
    forbidden = _transition(client, ops, project_id, schedule.headers["ETag"], "draft", "Not allowed", f"lifecycle-forbidden-{suffix}")
    assert forbidden.status_code == 400
    assert forbidden.json()["error"]["code"] == "planning_project_transition_invalid"
    missing_reason = client.post(f"/api/planning/projects/{project_id}/transitions", headers={
        **ops, "If-Match": schedule.headers["ETag"], "Idempotency-Key": f"lifecycle-reason-{suffix}",
    }, json={"target_status": "archived"})
    unknown = client.post(f"/api/planning/projects/{project_id}/transitions", headers={
        **ops, "If-Match": schedule.headers["ETag"], "Idempotency-Key": f"lifecycle-unknown-{suffix}",
    }, json={"target_status": "purged", "reason": "Not public"})
    assert missing_reason.status_code == 422 and unknown.status_code == 422
    with SessionLocal() as db:
        counts = _evidence_counts(db, project_id)
        db.execute(text("UPDATE planning_projects SET status = 'purged' WHERE id = :project_id"), {"project_id": project_id})
        db.commit()
    transition = _transition(client, ops, project_id, schedule.headers["ETag"], "active", "Cannot restore", f"lifecycle-purged-{suffix}")
    mutation = _raw_command(client, ops, schedule.headers["ETag"], "CreatePlanningTask", {
        "project_id": project_id, "title": "Hidden", "start": "2026-08-03", "end": "2026-08-03",
    }, f"lifecycle-purged-mutation-{suffix}")
    assert transition.status_code == 400 and transition.json()["error"]["code"] == "planning_object_not_found"
    assert mutation.status_code == 400 and mutation.json()["error"]["code"] == "planning_object_not_found"
    for hidden in (transition, mutation):
        assert hidden.json()["error"]["object_ids"] == []
        assert hidden.json()["error"]["correlation_id"] is None
        assert project_id not in hidden.text
    assert all(row["id"] != project_id for row in client.get("/api/planning/projects", headers=ops).json())
    assert client.get(f"/api/planning/projects/{project_id}/schedule", headers=ops).status_code == 400
    assert client.get(f"/api/planning/projects/{project_id}/revisions", headers=ops).status_code == 404
    with SessionLocal() as db:
        assert _evidence_counts(db, project_id) == counts
        hidden_failures = db.scalars(select(CommandLog).where(
            CommandLog.organization_id == _organization_id(db, project_id),
            CommandLog.status == "validation_error",
            CommandLog.idempotency_key.like(f"lifecycle-purged-{suffix}:validation:%")
            | CommandLog.idempotency_key.like(f"lifecycle-purged-mutation-{suffix}:validation:%"),
        )).all()
        assert len(hidden_failures) == 2
        for failed in hidden_failures:
            persisted = loads(failed.response_json)["error"]
            assert persisted["object_ids"] == []
            assert persisted["correlation_id"] is None


def _project(client: TestClient) -> tuple[str, dict[str, str], str]:
    suffix = uuid4().hex[:8]
    admin, ops = auth(client, "admin", "admin"), auth(client, "ops", "ops123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    assert client.post("/api/modules/planning.core/install", headers=admin).status_code == 200
    created = command(client, ops, "CreatePlanningProject", {
        "name": f"Lifecycle {suffix}", "start": "2026-08-03", "end": "2026-08-28",
    }, f"lifecycle-project-{suffix}")
    assert created.status_code == 200, created.text
    return suffix, ops, created.json()["result"]["id"]


def _schedule(client: TestClient, headers: dict[str, str], project_id: str):
    response = client.get(f"/api/planning/projects/{project_id}/schedule", headers=headers)
    assert response.status_code == 200, response.text
    return response


def _transition(client: TestClient, headers: dict[str, str], project_id: str, etag: str, target: str, reason: str, key: str):
    return client.post(f"/api/planning/projects/{project_id}/transitions", headers={
        **headers, "If-Match": etag, "Idempotency-Key": key,
    }, json={"target_status": target, "reason": reason})


def _raw_command(client: TestClient, headers: dict[str, str], etag: str, command_type: str, payload: dict, key: str):
    return client.post("/api/commands", headers={**headers, "If-Match": etag}, json={
        "command_type": command_type, "payload": payload, "idempotency_key": key,
    })


def _evidence_counts(db, project_id: str) -> tuple[int, int, int]:
    return (
        int(db.scalar(select(func.count()).select_from(PlanningScheduleEvent).where(PlanningScheduleEvent.project_id == project_id)) or 0),
        int(db.scalar(select(func.count()).select_from(PlanningScheduleRevision).where(PlanningScheduleRevision.project_id == project_id)) or 0),
        int(db.scalar(select(func.count()).select_from(PlanningOutboxEvent).where(PlanningOutboxEvent.project_id == project_id)) or 0),
    )


def _organization_id(db, project_id: str) -> str:
    organization_id = db.scalar(select(PlanningProject.organization_id).where(PlanningProject.id == project_id))
    assert organization_id
    return str(organization_id)

from __future__ import annotations

from uuid import uuid4

from sqlalchemy import func, select
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.db import SessionLocal
from uok.models import CommandLog, EventRecord, PlanningScheduleEvent, PlanningScheduleRevision
from uok.util import loads


def test_hundred_operation_batch_commits_one_revision_and_replays_once(client: TestClient) -> None:
    ops = _planning_users(client)
    suffix = uuid4().hex[:8]
    project_id, task_id, source_command_id = _project_and_task(client, ops, suffix)
    before = _schedule(client, ops, project_id)
    before_revision = before.json()["project"]["revision"]
    operations = [
        {
            "operation_id": f"progress-{index}",
            "kind": "update_task",
            "payload": {"task_id": task_id, "progress": index},
        }
        for index in range(100)
    ]
    key = f"planning-batch-success-{suffix}"
    accepted = client.post(
        f"/api/planning/projects/{project_id}/mutations:batch",
        headers={**ops, "Idempotency-Key": key, "If-Match": before.headers["ETag"]},
        json={"expected_revision": before_revision, "source_command_id": source_command_id.upper(), "reason": "100 ordered updates", "operations": operations},
    )

    assert accepted.status_code == 200, accepted.text
    body = accepted.json()
    assert body["previous_revision"] == before_revision
    assert body["revision"] == before_revision + 1
    assert body["schedule"]["project"]["revision"] == before_revision + 1
    assert len(body["operation_results"]) == 100
    task = next(row for row in body["schedule"]["tasks"] if row["id"] == task_id)
    assert task["progress"] == 99
    assert task["version"] == 2
    assert body["correlation_id"]
    assert body["source_command_id"] == source_command_id
    assert accepted.headers["ETag"] != before.headers["ETag"]
    _assert_batch_correlation(body["correlation_id"], source_command_id, project_id, 100)

    replay = client.post(
        f"/api/planning/projects/{project_id}/mutations:batch",
        headers={**ops, "Idempotency-Key": key, "If-Match": before.headers["ETag"]},
        json={"expected_revision": before_revision, "source_command_id": source_command_id.upper(), "reason": "100 ordered updates", "operations": operations},
    )
    assert replay.status_code == 200, replay.text
    assert replay.json() == accepted.json()
    assert replay.headers["ETag"] == accepted.headers["ETag"]
    assert _schedule(client, ops, project_id).json()["project"]["revision"] == before_revision + 1


def test_invalid_operation_rolls_back_every_change_with_structured_error(client: TestClient) -> None:
    ops = _planning_users(client)
    suffix = uuid4().hex[:8]
    project_id, task_id, _ = _project_and_task(client, ops, suffix)
    before = _schedule(client, ops, project_id)
    before_events = _batch_event_count(project_id)
    revision = before.json()["project"]["revision"]

    rejected = client.post(
        f"/api/planning/projects/{project_id}/mutations:batch",
        headers={**ops, "Idempotency-Key": f"planning-batch-failure-{suffix}", "If-Match": before.headers["ETag"]},
        json={
            "expected_revision": revision,
            "operations": [
                {"operation_id": "valid-first", "kind": "update_task", "payload": {"task_id": task_id, "progress": 50}},
                {"operation_id": "invalid-second", "kind": "update_task", "payload": {"task_id": "missing-task", "progress": 75}},
            ],
        },
    )

    assert rejected.status_code == 400, rejected.text
    error = rejected.json()["error"]
    assert error["code"] == "batch_operation_invalid"
    assert error["field"] == "operations[1].payload"
    assert error["object_ids"] == ["missing-task"]
    assert error["current_revision"] == revision
    assert error["correlation_id"]
    assert "retry the complete batch" in error["repair"]
    after = _schedule(client, ops, project_id)
    task = next(row for row in after.json()["tasks"] if row["id"] == task_id)
    assert after.headers["ETag"] == before.headers["ETag"]
    assert after.json()["project"]["revision"] == revision
    assert task["progress"] == 0
    assert task["version"] == 1
    assert _batch_event_count(project_id) == before_events
    with SessionLocal() as db:
        failed = db.get(CommandLog, error["correlation_id"])
        assert failed is not None
        assert failed.command_type == "BatchPlanningOperations"
        assert failed.status == "validation_error"


def test_batch_rejects_unknown_kind_duplicate_ids_and_wrong_source_aggregate(client: TestClient) -> None:
    ops = _planning_users(client)
    suffix = uuid4().hex[:8]
    project_id, _, _ = _project_and_task(client, ops, suffix)
    before = _schedule(client, ops, project_id)

    response = command(
        client,
        ops,
        "BatchPlanningOperations",
        {
            "project_id": project_id,
            "operations": [{"operation_id": "unknown-delete", "kind": "delete_task", "payload": {}}],
        },
        f"planning-batch-unknown-kind-{suffix}",
    )

    assert response.status_code == 400, response.text
    assert response.json()["error"]["code"] == "batch_operation_unsupported"
    assert _schedule(client, ops, project_id).headers["ETag"] == before.headers["ETag"]

    duplicate_ids = command(
        client,
        ops,
        "BatchPlanningOperations",
        {
            "project_id": project_id,
            "operations": [
                {"operation_id": "same", "kind": "update_task", "payload": {"task_id": before.json()["tasks"][0]["id"], "progress": 5}},
                {"operation_id": "same", "kind": "update_task", "payload": {"task_id": before.json()["tasks"][0]["id"], "progress": 10}},
            ],
        },
        f"planning-batch-duplicate-id-{suffix}",
    )
    assert duplicate_ids.status_code == 400, duplicate_ids.text
    assert duplicate_ids.json()["error"]["code"] == "batch_operation_id_invalid"
    assert _schedule(client, ops, project_id).headers["ETag"] == before.headers["ETag"]

    unknown_source = command(
        client,
        ops,
        "BatchPlanningOperations",
        {
            "project_id": project_id,
            "source_command_id": str(uuid4()),
            "operations": [{"operation_id": "unknown-source", "kind": "update_task", "payload": {"task_id": "unused", "progress": 1}}],
        },
        f"planning-batch-unknown-source-{suffix}",
    )
    assert unknown_source.status_code == 400, unknown_source.text
    assert unknown_source.json()["error"]["code"] == "batch_source_command_invalid"
    assert _schedule(client, ops, project_id).headers["ETag"] == before.headers["ETag"]

    _, _, other_source_command_id = _project_and_task(client, ops, f"{suffix}-other")
    wrong_aggregate = command(
        client,
        ops,
        "BatchPlanningOperations",
        {
            "project_id": project_id,
            "source_command_id": other_source_command_id,
            "operations": [{"operation_id": "wrong-source", "kind": "update_task", "payload": {"task_id": before.json()["tasks"][0]["id"], "progress": 1}}],
        },
        f"planning-batch-wrong-aggregate-{suffix}",
    )
    assert wrong_aggregate.status_code == 400, wrong_aggregate.text
    assert wrong_aggregate.json()["error"]["code"] == "batch_source_command_invalid"
    assert "this Planning project" in wrong_aggregate.json()["error"]["message"]
    assert _schedule(client, ops, project_id).headers["ETag"] == before.headers["ETag"]


def _planning_users(client: TestClient) -> dict[str, str]:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    assert client.post("/api/modules/planning.core/install", headers=admin).status_code == 200
    return ops


def _project_and_task(client: TestClient, ops: dict[str, str], suffix: str) -> tuple[str, str, str]:
    project = command(client, ops, "CreatePlanningProject", {"name": f"Batch {suffix}", "start": "2026-08-03", "end": "2026-08-28"}, f"batch-project-{suffix}")
    project_id = project.json()["result"]["id"]
    task = command(client, ops, "CreatePlanningTask", {"project_id": project_id, "title": "Atomic task", "start": "2026-08-03", "end": "2026-08-05"}, f"batch-task-{suffix}")
    assert task.status_code == 200, task.text
    return project_id, task.json()["result"]["id"], task.json()["command_id"]


def _schedule(client: TestClient, headers: dict[str, str], project_id: str):
    response = client.get(f"/api/planning/projects/{project_id}/schedule", headers=headers)
    assert response.status_code == 200, response.text
    return response


def _batch_event_count(project_id: str) -> int:
    with SessionLocal() as db:
        return int(db.scalar(select(func.count()).select_from(PlanningScheduleEvent).where(
            PlanningScheduleEvent.project_id == project_id,
            PlanningScheduleEvent.event_type == "batch_applied",
        )) or 0)


def _assert_batch_correlation(command_id: str, source_command_id: str, project_id: str, operation_count: int) -> None:
    with SessionLocal() as db:
        log = db.get(CommandLog, command_id)
        event = db.scalar(select(EventRecord).where(EventRecord.event_type == "PlanningBatchApplied", EventRecord.object_id == project_id))
        schedule_event = db.scalar(select(PlanningScheduleEvent).where(PlanningScheduleEvent.event_type == "batch_applied", PlanningScheduleEvent.project_id == project_id))
        revision = db.scalar(select(PlanningScheduleRevision).where(
            PlanningScheduleRevision.project_id == project_id,
            PlanningScheduleRevision.correlation_id == command_id,
        ))
        assert log is not None and log.status == "succeeded"
        assert event is not None and loads(event.payload_json)["correlation_id"] == command_id
        assert schedule_event is not None
        payload = loads(schedule_event.payload_json)
        assert payload["correlation_id"] == command_id
        assert payload["source_command_id"] == source_command_id
        assert len(payload["operation_ids"]) == operation_count
        assert revision is not None and revision.source_command_id == source_command_id

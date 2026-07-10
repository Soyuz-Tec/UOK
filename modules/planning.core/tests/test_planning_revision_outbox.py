from __future__ import annotations

from hashlib import sha256
from uuid import uuid4

import pytest
from sqlalchemy import func, select
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.db import SessionLocal
from uok.models import (
    CommandLog,
    EventRecord,
    PlanningOutboxEvent,
    PlanningScheduleEvent,
    PlanningScheduleRevision,
)
from uok.util import loads


def test_revision_ledger_outbox_and_history_are_exact_and_sanitized(client: TestClient) -> None:
    ops = _planning_users(client)
    suffix = uuid4().hex[:8]
    project = command(client, ops, "CreatePlanningProject", {
        "name": f"Revision ledger {suffix}", "start": "2026-08-03", "end": "2026-08-28",
    }, f"revision-project-{suffix}")
    assert project.status_code == 200, project.text
    project_id = project.json()["result"]["id"]
    task = command(client, ops, "CreatePlanningTask", {
        "project_id": project_id, "title": "Ledger task", "start": "2026-08-03", "end": "2026-08-05",
    }, f"revision-task-{suffix}")
    assert task.status_code == 200, task.text
    task_id = task.json()["result"]["id"]
    updated = command(client, ops, "UpdatePlanningTask", {
        "task_id": task_id, "progress": 40,
    }, f"revision-update-{suffix}")
    assert updated.status_code == 200, updated.text
    correlations = [project.json()["command_id"], task.json()["command_id"], updated.json()["command_id"]]

    with SessionLocal() as db:
        revisions = list(db.scalars(select(PlanningScheduleRevision).where(
            PlanningScheduleRevision.project_id == project_id,
        ).order_by(PlanningScheduleRevision.revision)).all())
        outbox = list(db.scalars(select(PlanningOutboxEvent).where(
            PlanningOutboxEvent.project_id == project_id,
        ).order_by(PlanningOutboxEvent.revision)).all())
        assert [(row.revision, row.previous_revision) for row in revisions] == [(1, 0), (2, 1), (3, 2)]
        assert [row.correlation_id for row in revisions] == correlations
        assert [row.command_type for row in revisions] == [
            "CreatePlanningProject", "CreatePlanningTask", "UpdatePlanningTask",
        ]
        assert loads(revisions[0].task_versions_json) == {}
        assert loads(revisions[0].changed_task_ids_json, []) == []
        assert loads(revisions[1].task_versions_json) == {task_id: 1}
        assert loads(revisions[1].changed_task_ids_json, []) == [task_id]
        assert loads(revisions[2].task_versions_json) == {task_id: 2}
        assert loads(revisions[2].changed_task_ids_json, []) == [task_id]
        assert len(outbox) == 3
        for revision, event in zip(revisions, outbox, strict=True):
            payload = loads(event.payload_json)
            assert event.schedule_revision_id == revision.id
            assert event.revision == revision.revision
            assert event.correlation_id == revision.correlation_id
            assert event.event_type == "PlanningScheduleRevisionCommitted"
            assert event.schema_version == 1
            assert payload["revision_checksum"] == revision.revision_checksum
            assert payload["correlation_id"] == revision.correlation_id
            assert payload["aggregate"] == {"type": "PlanningProject", "id": project_id}
            assert event.checksum == sha256(event.payload_json.encode("utf-8")).hexdigest()
            log = db.get(CommandLog, revision.correlation_id)
            assert log is not None and log.status == "succeeded"
            assert loads(log.response_json)["correlation_id"] == revision.correlation_id
            assert db.scalar(select(EventRecord).where(
                EventRecord.organization_id == revision.organization_id,
                EventRecord.payload_json.contains(revision.correlation_id),
            )) is not None
            assert db.scalar(select(PlanningScheduleEvent).where(
                PlanningScheduleEvent.organization_id == revision.organization_id,
                PlanningScheduleEvent.project_id == project_id,
                PlanningScheduleEvent.payload_json.contains(revision.correlation_id),
            )) is not None

    history = client.get(f"/api/planning/projects/{project_id}/revisions?limit=2", headers=ops)
    assert history.status_code == 200, history.text
    assert history.headers["Cache-Control"] == "private, no-store"
    assert [row["revision"] for row in history.json()["items"]] == [3, 2]
    serialized = history.json()["items"][0]
    assert "actor_user_id" not in serialized
    assert "payload_json" not in serialized
    assert "payload_json" not in serialized["outbox"]
    detail = client.get(f"/api/planning/projects/{project_id}/revisions/1", headers=ops)
    assert detail.status_code == 200, detail.text
    assert detail.json()["previous_revision"] == 0


def test_failed_transaction_and_idempotent_replay_do_not_duplicate_history(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    ops = _planning_users(client)
    suffix = uuid4().hex[:8]
    project = command(client, ops, "CreatePlanningProject", {
        "name": f"Revision rollback {suffix}", "start": "2026-08-03", "end": "2026-08-28",
    }, f"revision-rollback-project-{suffix}")
    project_id = project.json()["result"]["id"]
    before = _history_counts(project_id)

    from uok_planning_core import revision_completion

    original = revision_completion.record_schedule_revision

    def fail_after_outbox(*args, **kwargs):
        original(*args, **kwargs)
        raise ValueError("forced failure after transactional outbox insert")

    monkeypatch.setattr(revision_completion, "record_schedule_revision", fail_after_outbox)
    failed = command(client, ops, "CreatePlanningTask", {
        "project_id": project_id, "title": "Must roll back", "start": "2026-08-03", "end": "2026-08-05",
    }, f"revision-forced-failure-{suffix}")
    assert failed.status_code == 400, failed.text
    assert _history_counts(project_id) == before
    monkeypatch.setattr(revision_completion, "record_schedule_revision", original)

    key = f"revision-replay-{suffix}"
    accepted = command(client, ops, "CreatePlanningTask", {
        "project_id": project_id, "title": "Replay once", "start": "2026-08-03", "end": "2026-08-05",
    }, key)
    assert accepted.status_code == 200, accepted.text
    after = _history_counts(project_id)
    replay = command(client, ops, "CreatePlanningTask", {
        "project_id": project_id, "title": "Replay once", "start": "2026-08-03", "end": "2026-08-05",
    }, key)
    assert replay.status_code == 200, replay.text
    assert replay.json()["idempotent"] is True
    assert _history_counts(project_id) == after


def test_source_command_lookup_cannot_be_poisoned_by_schedule_event_payload(client: TestClient) -> None:
    ops = _planning_users(client)
    suffix = uuid4().hex[:8]
    target_project, target_task, _ = _project_and_task(client, ops, f"target-{suffix}")
    _, _, foreign_command_id = _project_and_task(client, ops, f"foreign-{suffix}")
    with SessionLocal() as db:
        target = db.scalar(select(PlanningScheduleRevision).where(
            PlanningScheduleRevision.project_id == target_project,
        ).order_by(PlanningScheduleRevision.revision.desc()))
        assert target is not None
        db.add(PlanningScheduleEvent(
            organization_id=target.organization_id,
            project_id=target_project,
            event_type="poisoned_history",
            payload_json=f'{{"correlation_id":"{foreign_command_id}"}}',
        ))
        db.commit()

    rejected = command(client, ops, "BatchPlanningOperations", {
        "project_id": target_project,
        "source_command_id": foreign_command_id,
        "operations": [{
            "operation_id": "poison-proof", "kind": "update_task",
            "payload": {"task_id": target_task, "progress": 1},
        }],
    }, f"revision-poison-proof-{suffix}")
    assert rejected.status_code == 400, rejected.text
    assert rejected.json()["error"]["code"] == "batch_source_command_invalid"


def _planning_users(client: TestClient) -> dict[str, str]:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    assert client.post("/api/modules/planning.core/install", headers=admin).status_code == 200
    return ops


def _project_and_task(client: TestClient, ops: dict[str, str], suffix: str) -> tuple[str, str, str]:
    project = command(client, ops, "CreatePlanningProject", {
        "name": f"Revision fixture {suffix}", "start": "2026-08-03", "end": "2026-08-28",
    }, f"revision-fixture-project-{suffix}")
    assert project.status_code == 200, project.text
    project_id = project.json()["result"]["id"]
    task = command(client, ops, "CreatePlanningTask", {
        "project_id": project_id, "title": "Revision fixture task", "start": "2026-08-03", "end": "2026-08-05",
    }, f"revision-fixture-task-{suffix}")
    assert task.status_code == 200, task.text
    return project_id, task.json()["result"]["id"], task.json()["command_id"]


def _history_counts(project_id: str) -> tuple[int, int]:
    with SessionLocal() as db:
        revisions = int(db.scalar(select(func.count()).select_from(PlanningScheduleRevision).where(
            PlanningScheduleRevision.project_id == project_id,
        )) or 0)
        outbox = int(db.scalar(select(func.count()).select_from(PlanningOutboxEvent).where(
            PlanningOutboxEvent.project_id == project_id,
        )) or 0)
        return revisions, outbox

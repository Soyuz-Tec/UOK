from __future__ import annotations

from hashlib import sha256
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import select
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok_planning_core._internal.portfolio_audit.revision_history import PlanningRevisionNotFound, list_project_revisions
from uok.host.database import SessionLocal
from uok_planning_core._internal.persistence.models import PlanningOutboxEvent, PlanningScheduleRevision
from uok.kernel.security import Actor


def test_revision_and_outbox_orm_records_are_append_only(client: TestClient) -> None:
    project_id = _project(client)
    with SessionLocal() as db:
        revision = db.scalar(select(PlanningScheduleRevision).where(
            PlanningScheduleRevision.project_id == project_id,
        ).order_by(PlanningScheduleRevision.revision.desc()))
        assert revision is not None
        revision.command_type = "tampered"
        with pytest.raises(ValueError, match="immutable and append-only"):
            db.flush()
        db.rollback()
    with SessionLocal() as db:
        outbox = db.scalar(select(PlanningOutboxEvent).where(PlanningOutboxEvent.project_id == project_id))
        assert outbox is not None
        db.delete(outbox)
        with pytest.raises(ValueError, match="immutable and append-only"):
            db.flush()


def test_postgresql_migration_enforces_exact_append_only_boundary() -> None:
    sql = Path("modules/planning.core/migrations/014_planning_revision_outbox.sql").read_text(encoding="utf-8").lower()
    for fragment in (
        "planning_schedule_revisions",
        "planning_outbox_events",
        "before update or delete on planning_schedule_revisions",
        "before update or delete on planning_outbox_events",
        "new.revision <> project_revision",
        "memberships",
        "source_revision.project_id = new.project_id",
        "source_revision.correlation_id = new.source_command_id",
        "is distinct from new.event_type",
        "planning outbox event must match its schedule revision",
    ):
        assert fragment in sql
    for unimplemented_delivery_claim in (
        "delivery_status", "published_at", "retry_count", "broker_offset", "dispatcher",
    ):
        assert unimplemented_delivery_claim not in sql


def test_orm_rejects_boolean_task_versions_and_false_outbox_envelopes() -> None:
    with SessionLocal() as db:
        db.add(PlanningScheduleRevision(
            organization_id="missing-org",
            project_id="missing-project",
            revision=1,
            previous_revision=0,
            correlation_id="missing-command",
            command_type="CreatePlanningProject",
            actor_user_id="missing-user",
            task_versions_json='{"task": true}',
            changed_task_ids_json="[]",
            revision_checksum="a" * 64,
        ))
        with pytest.raises(ValueError, match="positive-version object"):
            db.flush()
    false_payload = "{}"
    with SessionLocal() as db:
        db.add(PlanningOutboxEvent(
            organization_id="missing-org",
            project_id="missing-project",
            schedule_revision_id="missing-revision",
            revision=1,
            correlation_id="missing-command",
            event_type="PlanningScheduleRevisionCommitted",
            schema_version=1,
            payload_json=false_payload,
            checksum=sha256(false_payload.encode("utf-8")).hexdigest(),
        ))
        with pytest.raises(ValueError, match="relational envelope"):
            db.flush()


def test_revision_history_is_tenant_scoped(client: TestClient) -> None:
    project_id = _project(client)
    outsider = Actor("outsider-user", "outsider", "outsider-org", "ops_manager")
    with SessionLocal() as db, pytest.raises(PlanningRevisionNotFound):
        list_project_revisions(db, outsider, project_id, limit=100, offset=0)


def _project(client: TestClient) -> str:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    assert client.post("/api/modules/planning.core/install", headers=admin).status_code == 200
    suffix = uuid4().hex[:8]
    project = command(client, ops, "CreatePlanningProject", {
        "name": f"Revision guard {suffix}", "start": "2026-08-03", "end": "2026-08-28",
    }, f"revision-guard-project-{suffix}")
    assert project.status_code == 200, project.text
    return project.json()["result"]["id"]

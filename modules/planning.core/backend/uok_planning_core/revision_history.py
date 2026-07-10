from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import PlanningOutboxEvent, PlanningProject, PlanningScheduleRevision, PlanningTask, utcnow
from uok.security import Actor
from uok.util import dumps, loads

OUTBOX_EVENT_TYPE = "PlanningScheduleRevisionCommitted"
OUTBOX_SCHEMA_VERSION = 1


class PlanningRevisionNotFound(ValueError):
    pass


def record_schedule_revision(
    db: Session,
    actor: Actor,
    project: PlanningProject,
    *,
    previous_revision: int,
    command_type: str,
    correlation_id: str,
    source_command_id: str | None,
    changed_task_ids: set[str],
) -> tuple[PlanningScheduleRevision, PlanningOutboxEvent]:
    task_versions = _task_versions(db, actor, project.id)
    ledger_payload = _ledger_payload(
        actor, project, previous_revision, command_type, correlation_id,
        source_command_id, task_versions, sorted(changed_task_ids),
    )
    revision_checksum = _checksum(dumps(ledger_payload))
    created_at = utcnow()
    revision = _new_revision(ledger_payload, revision_checksum, created_at)
    db.add(revision)
    db.flush()
    outbox = _new_outbox(revision, ledger_payload, revision_checksum, created_at)
    db.add(outbox)
    db.flush()
    return revision, outbox


def _task_versions(db: Session, actor: Actor, project_id: str) -> dict[str, int]:
    rows = db.execute(
        select(PlanningTask.id, PlanningTask.version)
        .where(
            PlanningTask.organization_id == actor.organization_id,
            PlanningTask.project_id == project_id,
        )
        .order_by(PlanningTask.id)
    ).all()
    return {str(task_id): int(version) for task_id, version in rows}


def _ledger_payload(
    actor: Actor,
    project: PlanningProject,
    previous_revision: int,
    command_type: str,
    correlation_id: str,
    source_command_id: str | None,
    task_versions: dict[str, int],
    changed_task_ids: list[str],
) -> dict[str, Any]:
    return {
        "organization_id": actor.organization_id,
        "project_id": project.id,
        "revision": int(project.revision),
        "previous_revision": int(previous_revision),
        "correlation_id": correlation_id,
        "command_type": command_type,
        "source_command_id": source_command_id,
        "actor_user_id": actor.user_id,
        "task_versions": task_versions,
        "changed_task_ids": changed_task_ids,
    }


def _new_revision(payload: dict[str, Any], checksum: str, created_at: datetime) -> PlanningScheduleRevision:
    return PlanningScheduleRevision(
        organization_id=payload["organization_id"],
        project_id=payload["project_id"],
        revision=payload["revision"],
        previous_revision=payload["previous_revision"],
        correlation_id=payload["correlation_id"],
        command_type=payload["command_type"],
        source_command_id=payload["source_command_id"],
        actor_user_id=payload["actor_user_id"],
        task_versions_json=dumps(payload["task_versions"]),
        changed_task_ids_json=dumps(payload["changed_task_ids"]),
        revision_checksum=checksum,
        created_at=created_at,
    )


def _new_outbox(
    revision: PlanningScheduleRevision,
    ledger_payload: dict[str, Any],
    revision_checksum: str,
    created_at: datetime,
) -> PlanningOutboxEvent:
    payload = dumps({
        "schema_version": OUTBOX_SCHEMA_VERSION,
        "event_type": OUTBOX_EVENT_TYPE,
        "aggregate": {"type": "PlanningProject", "id": revision.project_id},
        **ledger_payload,
        "revision_checksum": revision_checksum,
        "recorded_at": _timestamp(created_at),
    })
    return PlanningOutboxEvent(
        organization_id=revision.organization_id,
        project_id=revision.project_id,
        schedule_revision_id=revision.id,
        revision=revision.revision,
        correlation_id=revision.correlation_id,
        event_type=OUTBOX_EVENT_TYPE,
        schema_version=OUTBOX_SCHEMA_VERSION,
        payload_json=payload,
        checksum=_checksum(payload),
        created_at=created_at,
    )


def project_revision_for_command(
    db: Session,
    actor: Actor,
    project_id: str,
    correlation_id: str,
) -> PlanningScheduleRevision | None:
    return db.scalar(select(PlanningScheduleRevision).where(
        PlanningScheduleRevision.organization_id == actor.organization_id,
        PlanningScheduleRevision.project_id == project_id,
        PlanningScheduleRevision.correlation_id == correlation_id,
    ))


def list_project_revisions(
    db: Session,
    actor: Actor,
    project_id: str,
    *,
    limit: int,
    offset: int,
) -> dict[str, Any]:
    _project_or_error(db, actor, project_id)
    rows = db.execute(
        select(PlanningScheduleRevision, PlanningOutboxEvent)
        .join(PlanningOutboxEvent, PlanningOutboxEvent.schedule_revision_id == PlanningScheduleRevision.id)
        .where(
            PlanningScheduleRevision.organization_id == actor.organization_id,
            PlanningScheduleRevision.project_id == project_id,
        )
        .order_by(PlanningScheduleRevision.revision.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return {
        "project_id": project_id,
        "items": [_serialize_revision(revision, outbox) for revision, outbox in rows],
        "limit": limit,
        "offset": offset,
    }


def project_revision_detail(
    db: Session,
    actor: Actor,
    project_id: str,
    revision_number: int,
) -> dict[str, Any]:
    _project_or_error(db, actor, project_id)
    row = db.execute(
        select(PlanningScheduleRevision, PlanningOutboxEvent)
        .join(PlanningOutboxEvent, PlanningOutboxEvent.schedule_revision_id == PlanningScheduleRevision.id)
        .where(
            PlanningScheduleRevision.organization_id == actor.organization_id,
            PlanningScheduleRevision.project_id == project_id,
            PlanningScheduleRevision.revision == revision_number,
        )
    ).one_or_none()
    if row is None:
        raise PlanningRevisionNotFound("planning revision not found")
    return _serialize_revision(row[0], row[1])


def _serialize_revision(revision: PlanningScheduleRevision, outbox: PlanningOutboxEvent) -> dict[str, Any]:
    return {
        "id": revision.id,
        "project_id": revision.project_id,
        "revision": int(revision.revision),
        "previous_revision": int(revision.previous_revision),
        "correlation_id": revision.correlation_id,
        "command_type": revision.command_type,
        "source_command_id": revision.source_command_id,
        "task_versions": loads(revision.task_versions_json, {}),
        "changed_task_ids": loads(revision.changed_task_ids_json, []),
        "revision_checksum": revision.revision_checksum,
        "created_at": _timestamp(revision.created_at),
        "outbox": {
            "id": outbox.id,
            "event_type": outbox.event_type,
            "schema_version": int(outbox.schema_version),
            "checksum": outbox.checksum,
            "created_at": _timestamp(outbox.created_at),
        },
    }


def _project_or_error(db: Session, actor: Actor, project_id: str) -> PlanningProject:
    project = db.scalar(select(PlanningProject).where(
        PlanningProject.id == project_id,
        PlanningProject.organization_id == actor.organization_id,
        PlanningProject.status != "purged",
    ))
    if project is None:
        raise PlanningRevisionNotFound("project_id not found")
    return project


def _checksum(value: str) -> str:
    return sha256(value.encode("utf-8")).hexdigest()


def _timestamp(value: datetime) -> str:
    if value.tzinfo is None or value.utcoffset() is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


__all__ = [
    "OUTBOX_EVENT_TYPE",
    "OUTBOX_SCHEMA_VERSION",
    "PlanningRevisionNotFound",
    "list_project_revisions",
    "project_revision_detail",
    "project_revision_for_command",
    "record_schedule_revision",
]

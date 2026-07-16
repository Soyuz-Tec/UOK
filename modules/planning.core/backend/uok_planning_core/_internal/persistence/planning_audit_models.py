from __future__ import annotations

import json
from datetime import datetime
from hashlib import sha256

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, event
from sqlalchemy.orm import Mapped, mapped_column

from uok.db import Base
from uok_planning_core._internal.persistence.planning_models import planning_id, planning_now


class PlanningScheduleRevision(Base):
    __tablename__ = "planning_schedule_revisions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=planning_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("planning_projects.id"), index=True)
    revision: Mapped[int] = mapped_column(BigInteger)
    previous_revision: Mapped[int] = mapped_column(BigInteger)
    correlation_id: Mapped[str] = mapped_column(ForeignKey("command_logs.id"))
    command_type: Mapped[str] = mapped_column(String(120))
    source_command_id: Mapped[str | None] = mapped_column(ForeignKey("command_logs.id"), nullable=True)
    actor_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    task_versions_json: Mapped[str] = mapped_column(Text, default="{}")
    changed_task_ids_json: Mapped[str] = mapped_column(Text, default="[]")
    revision_checksum: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=planning_now)
    __table_args__ = (
        UniqueConstraint("organization_id", "project_id", "revision", name="uq_planning_schedule_revisions_project_revision"),
        UniqueConstraint("organization_id", "correlation_id", name="uq_planning_schedule_revisions_correlation"),
        CheckConstraint("revision >= 1", name="ck_planning_schedule_revisions_revision_positive"),
        CheckConstraint("previous_revision >= 0", name="ck_planning_schedule_revisions_previous_nonnegative"),
        CheckConstraint("revision = previous_revision + 1", name="ck_planning_schedule_revisions_sequence"),
        CheckConstraint("length(revision_checksum) = 64", name="ck_planning_schedule_revisions_checksum"),
        Index("ix_planning_schedule_revisions_org_project_created", "organization_id", "project_id", "created_at"),
    )


class PlanningOutboxEvent(Base):
    __tablename__ = "planning_outbox_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=planning_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("planning_projects.id"), index=True)
    schedule_revision_id: Mapped[str] = mapped_column(ForeignKey("planning_schedule_revisions.id"), unique=True)
    revision: Mapped[int] = mapped_column(BigInteger)
    correlation_id: Mapped[str] = mapped_column(ForeignKey("command_logs.id"))
    event_type: Mapped[str] = mapped_column(String(80), default="PlanningScheduleRevisionCommitted")
    schema_version: Mapped[int] = mapped_column(Integer, default=1)
    payload_json: Mapped[str] = mapped_column(Text)
    checksum: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=planning_now)
    __table_args__ = (
        UniqueConstraint("organization_id", "project_id", "revision", name="uq_planning_outbox_events_project_revision"),
        UniqueConstraint("organization_id", "correlation_id", name="uq_planning_outbox_events_correlation"),
        CheckConstraint("revision >= 1", name="ck_planning_outbox_events_revision_positive"),
        CheckConstraint("event_type = 'PlanningScheduleRevisionCommitted'", name="ck_planning_outbox_events_type"),
        CheckConstraint("schema_version = 1", name="ck_planning_outbox_events_schema"),
        CheckConstraint("length(checksum) = 64", name="ck_planning_outbox_events_checksum"),
        Index("ix_planning_outbox_events_org_project_created", "organization_id", "project_id", "created_at"),
    )


def _reject_append_only_mutation(*_args: object) -> None:
    raise ValueError("Planning revision and outbox records are immutable and append-only")


def _validate_schedule_revision(_mapper: object, _connection: object, row: PlanningScheduleRevision) -> None:
    try:
        task_versions = json.loads(row.task_versions_json)
        changed_task_ids = json.loads(row.changed_task_ids_json)
    except (TypeError, ValueError) as exc:
        raise ValueError("Planning revision metadata must be valid JSON") from exc
    if not isinstance(task_versions, dict) or not all(isinstance(key, str) and type(value) is int and value >= 1 for key, value in task_versions.items()):
        raise ValueError("Planning revision task versions must be a task-to-positive-version object")
    if not isinstance(changed_task_ids, list) or not all(isinstance(value, str) for value in changed_task_ids):
        raise ValueError("Planning revision changed task IDs must be an array of strings")


def _validate_outbox_event(_mapper: object, _connection: object, row: PlanningOutboxEvent) -> None:
    try:
        payload = json.loads(row.payload_json)
    except (TypeError, ValueError) as exc:
        raise ValueError("Planning outbox payload must be valid JSON") from exc
    if not isinstance(payload, dict):
        raise ValueError("Planning outbox payload must be a JSON object")
    expected = {
        "event_type": row.event_type,
        "schema_version": row.schema_version,
        "organization_id": row.organization_id,
        "project_id": row.project_id,
        "revision": row.revision,
        "correlation_id": row.correlation_id,
    }
    if any(payload.get(key) != value for key, value in expected.items()):
        raise ValueError("Planning outbox payload metadata must match its relational envelope")
    if payload.get("aggregate") != {"type": "PlanningProject", "id": row.project_id}:
        raise ValueError("Planning outbox aggregate must match its Planning project")
    if sha256(row.payload_json.encode("utf-8")).hexdigest() != row.checksum:
        raise ValueError("Planning outbox payload checksum does not match")


event.listen(PlanningScheduleRevision, "before_insert", _validate_schedule_revision)
event.listen(PlanningScheduleRevision, "before_update", _reject_append_only_mutation)
event.listen(PlanningScheduleRevision, "before_delete", _reject_append_only_mutation)
event.listen(PlanningOutboxEvent, "before_insert", _validate_outbox_event)
event.listen(PlanningOutboxEvent, "before_update", _reject_append_only_mutation)
event.listen(PlanningOutboxEvent, "before_delete", _reject_append_only_mutation)


__all__ = ["PlanningOutboxEvent", "PlanningScheduleRevision"]

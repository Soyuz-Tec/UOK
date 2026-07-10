from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import BigInteger, Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, event
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def planning_id() -> str:
    return str(uuid4())


def planning_now() -> datetime:
    return datetime.now(timezone.utc)


class PlanningProject(Base):
    __tablename__ = "planning_projects"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=planning_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(180))
    status: Mapped[str] = mapped_column(String(40), default="active")
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    timezone_name: Mapped[str] = mapped_column("timezone", String(80), default="UTC", server_default="UTC")
    revision: Mapped[int] = mapped_column(BigInteger, default=1, server_default="1")
    attrs_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=planning_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=planning_now)
    __table_args__ = (
        UniqueConstraint("organization_id", "name"),
        CheckConstraint("revision >= 1", name="ck_planning_projects_revision_positive"),
        CheckConstraint("end_at >= start_at", name="ck_planning_projects_date_order"),
        CheckConstraint("length(trim(timezone)) BETWEEN 1 AND 80", name="ck_planning_projects_timezone_nonempty"),
        Index("ix_planning_core_projects_org_status", "organization_id", "status"),
        Index("ix_planning_core_projects_org_revision", "organization_id", "id", "revision"),
    )


class PlanningTask(Base):
    __tablename__ = "planning_tasks"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=planning_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("planning_projects.id"), index=True)
    parent_task_id: Mapped[str | None] = mapped_column(ForeignKey("planning_tasks.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(180))
    task_type: Mapped[str] = mapped_column(String(40), default="task")
    status: Mapped[str] = mapped_column(String(40), default="planned")
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    forecast_start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    forecast_end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_days: Mapped[int] = mapped_column(Integer, default=1)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    version: Mapped[int] = mapped_column(BigInteger, default=1, server_default="1")
    attrs_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=planning_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=planning_now)
    __table_args__ = (
        CheckConstraint("version >= 1", name="ck_planning_tasks_version_positive"),
        CheckConstraint("end_at >= start_at", name="ck_planning_tasks_date_order"),
        CheckConstraint("forecast_start_at IS NULL OR forecast_end_at IS NULL OR forecast_end_at >= forecast_start_at", name="ck_planning_tasks_forecast_order"),
        CheckConstraint("actual_end_at IS NULL OR actual_start_at IS NOT NULL", name="ck_planning_tasks_actual_start_required"),
        CheckConstraint("actual_start_at IS NULL OR actual_end_at IS NULL OR actual_end_at >= actual_start_at", name="ck_planning_tasks_actual_order"),
        CheckConstraint("duration_days >= 0", name="ck_planning_tasks_duration_nonnegative"),
        CheckConstraint("progress >= 0 AND progress <= 100", name="ck_planning_tasks_progress_range"),
        CheckConstraint("sort_order >= 0", name="ck_planning_tasks_sort_order_nonnegative"),
        CheckConstraint("task_type IN ('task', 'summary', 'milestone')", name="ck_planning_tasks_type"),
        Index("ix_planning_core_tasks_project_order", "organization_id", "project_id", "sort_order"),
        Index("ix_planning_core_tasks_project_status", "organization_id", "project_id", "status"),
        Index("ix_planning_core_tasks_org_project_version", "organization_id", "project_id", "version"),
        Index("ix_planning_core_tasks_org_project_parent", "organization_id", "project_id", "parent_task_id"),
        Index("ix_planning_core_tasks_org_project_deadline", "organization_id", "project_id", "deadline_at"),
    )


class PlanningTaskDependency(Base):
    __tablename__ = "planning_task_dependencies"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=planning_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("planning_projects.id"), index=True)
    predecessor_task_id: Mapped[str] = mapped_column(ForeignKey("planning_tasks.id"))
    successor_task_id: Mapped[str] = mapped_column(ForeignKey("planning_tasks.id"))
    dependency_type: Mapped[str] = mapped_column(String(20), default="finish_to_start")
    lag_days: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=planning_now)
    __table_args__ = (
        UniqueConstraint("organization_id", "project_id", "predecessor_task_id", "successor_task_id"),
        CheckConstraint("predecessor_task_id <> successor_task_id", name="ck_planning_dependencies_distinct_tasks"),
        CheckConstraint("dependency_type IN ('finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish')", name="ck_planning_dependencies_type"),
        CheckConstraint("lag_days >= -30 AND lag_days <= 30", name="ck_planning_dependencies_lag_range"),
        Index("ix_planning_core_dependencies_project_predecessor", "organization_id", "project_id", "predecessor_task_id"),
        Index("ix_planning_core_dependencies_project_successor", "organization_id", "project_id", "successor_task_id"),
        Index("ix_planning_core_dependencies_successor", "organization_id", "successor_task_id"),
    )


class PlanningCalendar(Base):
    __tablename__ = "planning_calendars"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=planning_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("planning_projects.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    working_days_json: Mapped[str] = mapped_column(Text, default="[1,2,3,4,5]")
    holidays_json: Mapped[str] = mapped_column(Text, default="[]")
    __table_args__ = (UniqueConstraint("organization_id", "project_id", name="uq_planning_calendars_org_project"),)


class PlanningResource(Base):
    __tablename__ = "planning_resources"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=planning_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("planning_projects.id"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    role: Mapped[str] = mapped_column(String(120), default="")


class PlanningAssignment(Base):
    __tablename__ = "planning_assignments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=planning_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    task_id: Mapped[str] = mapped_column(ForeignKey("planning_tasks.id"), index=True)
    resource_id: Mapped[str] = mapped_column(ForeignKey("planning_resources.id"), index=True)
    allocation_percent: Mapped[int] = mapped_column(Integer, default=100)
    __table_args__ = (
        UniqueConstraint("organization_id", "task_id", "resource_id", name="uq_planning_assignments_org_task_resource"),
        CheckConstraint("allocation_percent >= 1 AND allocation_percent <= 300", name="ck_planning_assignments_allocation_range"),
        Index("ix_planning_core_assignments_org_resource_task", "organization_id", "resource_id", "task_id"),
    )


class PlanningBaseline(Base):
    __tablename__ = "planning_baselines"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=planning_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("planning_projects.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    snapshot_json: Mapped[str] = mapped_column(Text, default="{}")
    schema_version: Mapped[int] = mapped_column(Integer, default=2, server_default="2")
    completeness: Mapped[str] = mapped_column(String(20), default="complete", server_default="complete")
    checksum: Mapped[str | None] = mapped_column(String(64), nullable=True)
    source_revision: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_by_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    correlation_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=planning_now)
    __table_args__ = (
        CheckConstraint("schema_version >= 1", name="ck_planning_baselines_schema_version_positive"),
        CheckConstraint("completeness IN ('partial', 'complete')", name="ck_planning_baselines_completeness"),
        Index("ix_planning_core_baselines_org_project_revision", "organization_id", "project_id", "source_revision"),
    )


@event.listens_for(PlanningBaseline, "before_update")
@event.listens_for(PlanningBaseline, "before_delete")
def _reject_planning_baseline_mutation(*_args: object) -> None:
    raise ValueError("Planning baselines are immutable and append-only")


@event.listens_for(PlanningTask, "before_insert")
@event.listens_for(PlanningTask, "before_update")
def _validate_planning_task_attributes(_mapper: object, _connection: object, task: PlanningTask) -> None:
    try:
        attributes = json.loads(task.attrs_json or "{}")
    except (TypeError, ValueError) as exc:
        raise ValueError("Planning task attributes must be valid JSON") from exc
    if str(attributes.get("scheduling_mode") or "auto") not in {"auto", "manual"}:
        raise ValueError("Planning task scheduling_mode must be auto or manual")


class PlanningLink(Base):
    __tablename__ = "planning_links"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=planning_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("planning_projects.id"), index=True)
    task_id: Mapped[str | None] = mapped_column(ForeignKey("planning_tasks.id"), nullable=True)
    scope_type: Mapped[str] = mapped_column(String(20))
    relationship: Mapped[str] = mapped_column(String(40))
    target_kind: Mapped[str] = mapped_column(String(40))
    target_id: Mapped[str] = mapped_column(String(180))
    resolver: Mapped[str] = mapped_column(String(120))
    resolver_version: Mapped[str] = mapped_column(String(40), default="1")
    blocking: Mapped[bool] = mapped_column(Boolean, default=False)
    resolution_status: Mapped[str] = mapped_column(String(20), default="unavailable")
    status_summary: Mapped[str | None] = mapped_column(String(240), nullable=True)
    provenance_json: Mapped[str] = mapped_column(Text, default="{}")
    created_by_actor_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=planning_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=planning_now)
    last_resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    __table_args__ = (
        UniqueConstraint(
            "organization_id", "project_id", "scope_type", "task_id", "relationship", "target_kind", "target_id", "resolver",
            name="uq_planning_links_identity", postgresql_nulls_not_distinct=True,
        ),
        CheckConstraint("(scope_type = 'project' AND task_id IS NULL) OR (scope_type = 'task' AND task_id IS NOT NULL)", name="ck_planning_links_scope"),
        CheckConstraint("relationship IN ('implements', 'blocks_on', 'requires', 'proves', 'owned_by', 'moves', 'occurs_at', 'discussed_in', 'publishes_to')", name="ck_planning_links_relationship"),
        CheckConstraint("target_kind IN ('operation', 'gate', 'evidence', 'party', 'shipment', 'document', 'location', 'asset', 'agreement', 'communication_thread', 'calendar_event')", name="ck_planning_links_target_kind"),
        CheckConstraint("resolution_status IN ('ready', 'unavailable', 'denied', 'missing')", name="ck_planning_links_resolution_status"),
        Index("ix_planning_links_project_task", "organization_id", "project_id", "task_id"),
        Index("ix_planning_links_target", "organization_id", "target_kind", "target_id", "resolver"),
        Index("ix_planning_links_blocking", "organization_id", "project_id", "blocking", "resolution_status"),
    )


class PlanningTaskParticipant(Base):
    __tablename__ = "planning_task_participants"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=planning_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("planning_projects.id"), index=True)
    task_id: Mapped[str] = mapped_column(ForeignKey("planning_tasks.id"), index=True)
    party_id: Mapped[str] = mapped_column(String(36))
    role: Mapped[str] = mapped_column(String(40))
    source_module: Mapped[str] = mapped_column(String(80), default="contacts.core", server_default="contacts.core")
    attrs_json: Mapped[str] = mapped_column(Text, default="{}")
    created_by_actor_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=planning_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=planning_now)
    __table_args__ = (
        UniqueConstraint("organization_id", "task_id", "party_id", "role", name="uq_planning_task_participant_role"),
        CheckConstraint("role IN ('owner', 'assignee', 'approver', 'consulted', 'informed', 'external_contact')", name="ck_planning_task_participant_role"),
        CheckConstraint("source_module = 'contacts.core'", name="ck_planning_task_participant_source"),
        Index("ix_planning_task_participants_party", "organization_id", "party_id", "task_id"),
        Index("ix_planning_task_participants_task_role", "organization_id", "project_id", "task_id", "role"),
    )


class PlanningTaskRequirement(Base):
    __tablename__ = "planning_task_requirements"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=planning_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("planning_projects.id"), index=True)
    task_id: Mapped[str] = mapped_column(ForeignKey("planning_tasks.id"), index=True)
    requirement_type: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(180))
    state: Mapped[str] = mapped_column(String(40), default="missing", server_default="missing")
    required: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    target_link_id: Mapped[str | None] = mapped_column(ForeignKey("planning_links.id"), nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decision_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    decided_by_actor_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    attrs_json: Mapped[str] = mapped_column(Text, default="{}")
    created_by_actor_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=planning_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=planning_now)
    __table_args__ = (
        CheckConstraint("requirement_type IN ('evidence', 'approval', 'compliance', 'finance', 'shipment', 'document', 'custom')", name="ck_planning_requirement_type"),
        CheckConstraint("state IN ('missing', 'submitted', 'under_review', 'satisfied', 'rejected', 'waived')", name="ck_planning_requirement_state"),
        CheckConstraint("state NOT IN ('satisfied', 'rejected', 'waived') OR (decided_by_actor_id IS NOT NULL AND decided_at IS NOT NULL AND decision_reason IS NOT NULL)", name="ck_planning_requirement_decision"),
        Index("ix_planning_requirements_task_state", "organization_id", "project_id", "task_id", "state"),
        Index("ix_planning_requirements_due", "organization_id", "project_id", "required", "due_at"),
    )


class PlanningScheduleEvent(Base):
    __tablename__ = "planning_schedule_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=planning_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("planning_projects.id"), index=True)
    event_type: Mapped[str] = mapped_column(String(80))
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=planning_now)

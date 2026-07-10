from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, event
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
    revision: Mapped[int] = mapped_column(BigInteger, default=1, server_default="1")
    attrs_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=planning_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=planning_now)
    __table_args__ = (
        UniqueConstraint("organization_id", "name"),
        CheckConstraint("revision >= 1", name="ck_planning_projects_revision_positive"),
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
    duration_days: Mapped[int] = mapped_column(Integer, default=1)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    version: Mapped[int] = mapped_column(BigInteger, default=1, server_default="1")
    attrs_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=planning_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=planning_now)
    __table_args__ = (
        CheckConstraint("version >= 1", name="ck_planning_tasks_version_positive"),
        Index("ix_planning_core_tasks_project_order", "organization_id", "project_id", "sort_order"),
        Index("ix_planning_core_tasks_project_status", "organization_id", "project_id", "status"),
        Index("ix_planning_core_tasks_org_project_version", "organization_id", "project_id", "version"),
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


class PlanningScheduleEvent(Base):
    __tablename__ = "planning_schedule_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=planning_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("planning_projects.id"), index=True)
    event_type: Mapped[str] = mapped_column(String(80))
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=planning_now)

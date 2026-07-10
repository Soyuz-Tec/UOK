from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def planning_resource_id() -> str:
    return str(uuid4())


def planning_resource_now() -> datetime:
    return datetime.now(timezone.utc)


class PlanningResource(Base):
    __tablename__ = "planning_resources"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=planning_resource_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("planning_projects.id"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    role: Mapped[str] = mapped_column(String(120), default="")
    resource_type: Mapped[str] = mapped_column(String(40), default="human", server_default="human")
    capacity_value: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=Decimal("1"), server_default="1")
    capacity_unit: Mapped[str] = mapped_column(String(40), default="fte", server_default="fte")
    canonical_target_kind: Mapped[str | None] = mapped_column(String(40), nullable=True)
    canonical_target_id: Mapped[str | None] = mapped_column(String(180), nullable=True)
    effective_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    effective_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    __table_args__ = (
        CheckConstraint(
            "resource_type IN ('human','team','vehicle','equipment','material','budget','time_window','document','location','asset','custom')",
            name="ck_planning_resources_resource_type",
        ),
        CheckConstraint("capacity_value > 0", name="ck_planning_resources_capacity_positive"),
        CheckConstraint(
            "(resource_type = 'human' AND capacity_unit IN ('fte','hours_per_day','percent')) OR "
            "(resource_type = 'team' AND capacity_unit IN ('fte','people','hours_per_day','percent')) OR "
            "(resource_type IN ('vehicle','equipment','document','location','asset','custom') AND capacity_unit IN ('units','hours_per_day','percent')) OR "
            "(resource_type = 'material' AND capacity_unit IN ('units','kg','tonnes','liters')) OR "
            "(resource_type = 'budget' AND capacity_unit = 'currency') OR "
            "(resource_type = 'time_window' AND capacity_unit IN ('hours_per_day','percent'))",
            name="ck_planning_resources_type_capacity_unit",
        ),
        CheckConstraint("(canonical_target_kind IS NULL) = (canonical_target_id IS NULL)", name="ck_planning_resources_canonical_pair"),
        CheckConstraint(
            "canonical_target_kind IS NULL OR canonical_target_kind IN ('party','document','location','asset','agreement','calendar_event')",
            name="ck_planning_resources_canonical_kind",
        ),
        CheckConstraint(
            "canonical_target_kind IS NULL OR "
            "(resource_type IN ('human','team') AND canonical_target_kind = 'party') OR "
            "(resource_type IN ('vehicle','equipment','material','asset') AND canonical_target_kind = 'asset') OR "
            "(resource_type = 'budget' AND canonical_target_kind = 'agreement') OR "
            "(resource_type = 'time_window' AND canonical_target_kind = 'calendar_event') OR "
            "(resource_type = 'document' AND canonical_target_kind = 'document') OR "
            "(resource_type = 'location' AND canonical_target_kind = 'location') OR resource_type = 'custom'",
            name="ck_planning_resources_type_canonical_kind",
        ),
        CheckConstraint(
            "effective_end IS NULL OR effective_start IS NULL OR effective_end >= effective_start",
            name="ck_planning_resources_effective_order",
        ),
        Index("ix_planning_core_resources_org_project_type", "organization_id", "project_id", "resource_type"),
        Index("ix_planning_core_resources_org_canonical", "organization_id", "canonical_target_kind", "canonical_target_id"),
    )


class PlanningAssignment(Base):
    __tablename__ = "planning_assignments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=planning_resource_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    task_id: Mapped[str] = mapped_column(ForeignKey("planning_tasks.id"), index=True)
    resource_id: Mapped[str] = mapped_column(ForeignKey("planning_resources.id"), index=True)
    allocation_percent: Mapped[int] = mapped_column(Integer, default=100)
    __table_args__ = (
        UniqueConstraint("organization_id", "task_id", "resource_id", name="uq_planning_assignments_org_task_resource"),
        CheckConstraint("allocation_percent >= 1 AND allocation_percent <= 300", name="ck_planning_assignments_allocation_range"),
        Index("ix_planning_core_assignments_org_resource_task", "organization_id", "resource_id", "task_id"),
    )


class PlanningResourceCalendar(Base):
    __tablename__ = "planning_resource_calendars"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=planning_resource_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("planning_projects.id"), index=True)
    resource_id: Mapped[str] = mapped_column(ForeignKey("planning_resources.id"), index=True)
    name: Mapped[str] = mapped_column(String(120), default="Resource capacity")
    working_days_json: Mapped[str] = mapped_column(Text, default="[1,2,3,4,5]")
    holidays_json: Mapped[str] = mapped_column(Text, default="[]")
    default_capacity_percent: Mapped[int] = mapped_column(Integer, default=100, server_default="100")
    capacity_exceptions_json: Mapped[str] = mapped_column(Text, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=planning_resource_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=planning_resource_now)
    __table_args__ = (
        UniqueConstraint("organization_id", "resource_id", name="uq_planning_resource_calendars_org_resource"),
        CheckConstraint(
            "default_capacity_percent >= 0 AND default_capacity_percent <= 300",
            name="ck_planning_resource_calendar_capacity_range",
        ),
        Index("ix_planning_resource_calendars_org_project_resource", "organization_id", "project_id", "resource_id"),
    )

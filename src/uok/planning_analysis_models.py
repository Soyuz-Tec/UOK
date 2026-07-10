from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, event
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base
from .planning_models import planning_id, planning_now


class PlanningWhatIfSnapshot(Base):
    __tablename__ = "planning_what_if_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=planning_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("planning_projects.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    snapshot_json: Mapped[str] = mapped_column(Text)
    schema_version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    checksum: Mapped[str] = mapped_column(String(64))
    source_revision: Mapped[int] = mapped_column(BigInteger)
    created_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    correlation_id: Mapped[str] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=planning_now)

    __table_args__ = (
        CheckConstraint("schema_version = 1", name="ck_planning_what_if_schema_version"),
        CheckConstraint("source_revision >= 1", name="ck_planning_what_if_source_revision"),
        CheckConstraint("length(checksum) = 64", name="ck_planning_what_if_checksum_length"),
        Index("ix_planning_what_if_org_project_revision", "organization_id", "project_id", "source_revision"),
        Index("ix_planning_what_if_org_project_created", "organization_id", "project_id", "created_at"),
    )


@event.listens_for(PlanningWhatIfSnapshot, "before_update")
@event.listens_for(PlanningWhatIfSnapshot, "before_delete")
def _reject_planning_what_if_mutation(*_args: object) -> None:
    raise ValueError("Planning what-if snapshots are immutable and append-only")


class PlanningAnalysisRun(Base):
    __tablename__ = "planning_analysis_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=planning_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("planning_projects.id"), index=True)
    snapshot_id: Mapped[str] = mapped_column(ForeignKey("planning_what_if_snapshots.id"), index=True)
    analysis_type: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(30))
    engine_name: Mapped[str] = mapped_column(String(80))
    engine_version: Mapped[str] = mapped_column(String(40))
    seed: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    inputs_json: Mapped[str] = mapped_column(Text)
    limits_json: Mapped[str] = mapped_column(Text)
    result_json: Mapped[str] = mapped_column(Text)
    checksum: Mapped[str] = mapped_column(String(64))
    created_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    correlation_id: Mapped[str] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=planning_now)

    __table_args__ = (
        CheckConstraint("analysis_type IN ('risk', 'optimization')", name="ck_planning_analysis_run_type"),
        CheckConstraint("status IN ('completed', 'timeout', 'infeasible')", name="ck_planning_analysis_run_status"),
        CheckConstraint("seed IS NULL OR seed >= 0", name="ck_planning_analysis_run_seed"),
        CheckConstraint("length(checksum) = 64", name="ck_planning_analysis_run_checksum_length"),
        Index("ix_planning_analysis_runs_org_project_type", "organization_id", "project_id", "analysis_type", "created_at"),
        Index("ix_planning_analysis_runs_org_snapshot", "organization_id", "snapshot_id", "created_at"),
    )


@event.listens_for(PlanningAnalysisRun, "before_update")
@event.listens_for(PlanningAnalysisRun, "before_delete")
def _reject_planning_analysis_run_mutation(*_args: object) -> None:
    raise ValueError("Planning analysis runs are immutable and append-only")


__all__ = ["PlanningAnalysisRun", "PlanningWhatIfSnapshot"]

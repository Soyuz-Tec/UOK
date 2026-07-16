from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, event, inspect
from sqlalchemy.orm import Mapped, mapped_column

from uok.kernel.persistence import Base
from uok_planning_core._internal.persistence.planning_models import planning_id, planning_now


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


class PlanningAnalysisRecommendation(Base):
    __tablename__ = "planning_analysis_recommendations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=planning_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("planning_projects.id"), index=True)
    analysis_run_id: Mapped[str] = mapped_column(ForeignKey("planning_analysis_runs.id"), index=True)
    recommendation_key: Mapped[str] = mapped_column(String(80))
    rank: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(30), default="proposed", server_default="proposed")
    title: Mapped[str] = mapped_column(String(180))
    explanation_json: Mapped[str] = mapped_column(Text)
    proposal_json: Mapped[str] = mapped_column(Text)
    preview_json: Mapped[str] = mapped_column(Text)
    source_revision: Mapped[int] = mapped_column(BigInteger)
    decision_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    decided_by_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    applied_by_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    applied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    applied_revision: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    rolled_back_by_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    rolled_back_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rollback_revision: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=planning_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=planning_now)

    __table_args__ = (
        UniqueConstraint("organization_id", "analysis_run_id", "recommendation_key", name="uq_planning_analysis_recommendation_key"),
        CheckConstraint("rank >= 1 AND rank <= 100", name="ck_planning_analysis_recommendation_rank"),
        CheckConstraint("status IN ('proposed', 'approved', 'rejected', 'applied', 'rolled_back')", name="ck_planning_analysis_recommendation_status"),
        CheckConstraint("source_revision >= 1", name="ck_planning_analysis_recommendation_source_revision"),
        CheckConstraint("status = 'proposed' OR (decision_reason IS NOT NULL AND decided_by_user_id IS NOT NULL AND decided_at IS NOT NULL)", name="ck_planning_analysis_recommendation_decision"),
        CheckConstraint("status NOT IN ('applied', 'rolled_back') OR (applied_by_user_id IS NOT NULL AND applied_at IS NOT NULL AND applied_revision IS NOT NULL)", name="ck_planning_analysis_recommendation_applied"),
        CheckConstraint("status <> 'rolled_back' OR (rolled_back_by_user_id IS NOT NULL AND rolled_back_at IS NOT NULL AND rollback_revision IS NOT NULL)", name="ck_planning_analysis_recommendation_rollback"),
        Index("ix_planning_analysis_recommendations_org_project_status", "organization_id", "project_id", "status", "rank"),
        Index("ix_planning_analysis_recommendations_org_run_rank", "organization_id", "analysis_run_id", "rank"),
    )


@event.listens_for(PlanningAnalysisRecommendation, "before_update")
def _validate_recommendation_transition(_mapper: object, _connection: object, row: PlanningAnalysisRecommendation) -> None:
    history = inspect(row).attrs.status.history
    if not history.has_changes() or not history.deleted:
        return
    previous = str(history.deleted[0])
    allowed = {"proposed": {"approved", "rejected"}, "approved": {"applied", "rejected"}, "applied": {"rolled_back"}}
    if row.status not in allowed.get(previous, set()):
        raise ValueError(f"Planning recommendation transition {previous} to {row.status} is not allowed")


__all__ = ["PlanningAnalysisRecommendation", "PlanningAnalysisRun", "PlanningWhatIfSnapshot"]

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from uok_planning_core._internal.portfolio_audit.planning_audit import add_planning_schedule_event, emit_planning_event
from uok_planning_core._internal.scheduling.scheduler import project_or_error
from uok_planning_core._internal.analysis.what_if import create_what_if_snapshot, what_if_metadata
from uok_planning_core._internal.analysis.risk_analysis import analysis_metadata, create_risk_analysis
from uok_planning_core._internal.analysis.optimization import (
    apply_recommendation,
    create_optimization,
    decide_recommendation,
    optimization_metadata,
    recommendation_or_error,
    recommendation_read_model,
    rollback_recommendation,
)
from uok_planning_core._internal.scheduling.read_model import schedule_read_model
from uok.kernel.security import Actor


def cmd_create_what_if_snapshot(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    project_id = str(payload.get("project_id") or "").strip()
    project = project_or_error(db, actor, project_id)
    row = create_what_if_snapshot(db, actor, project, payload, command_id)
    evidence = {
        "project_id": project.id,
        "source_revision": int(row.source_revision),
        "schema_version": int(row.schema_version),
        "checksum": row.checksum,
    }
    emit_planning_event(db, actor, command_id, "PlanningWhatIfSnapshotCreated", "PlanningWhatIfSnapshot", row.id, evidence)
    add_planning_schedule_event(db, actor, command_id, project.id, "what_if_snapshot_created", {"what_if_snapshot_id": row.id, **evidence})
    return {"what_if_snapshot": what_if_metadata(row)}


def cmd_run_risk_analysis(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    project_id = str(payload.get("project_id") or "").strip()
    project = project_or_error(db, actor, project_id)
    row = create_risk_analysis(db, actor, project.id, payload, command_id)
    evidence = {
        "project_id": project.id, "snapshot_id": row.snapshot_id,
        "engine_name": row.engine_name, "engine_version": row.engine_version,
        "seed": row.seed, "status": row.status, "checksum": row.checksum,
    }
    emit_planning_event(db, actor, command_id, "PlanningRiskAnalysisCompleted", "PlanningAnalysisRun", row.id, evidence)
    add_planning_schedule_event(db, actor, command_id, project.id, "risk_analysis_completed", {"analysis_run_id": row.id, **evidence})
    return {"risk_analysis": analysis_metadata(row)}


def cmd_run_optimization(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    project_id = str(payload.get("project_id") or "").strip()
    project = project_or_error(db, actor, project_id)
    row = create_optimization(db, actor, project.id, payload, command_id)
    metadata = optimization_metadata(db, actor, row)
    evidence = {
        "project_id": project.id, "snapshot_id": row.snapshot_id, "status": row.status,
        "engine_name": row.engine_name, "engine_version": row.engine_version,
        "recommendation_count": metadata["recommendation_count"], "checksum": row.checksum,
    }
    emit_planning_event(db, actor, command_id, "PlanningOptimizationCompleted", "PlanningAnalysisRun", row.id, evidence)
    add_planning_schedule_event(db, actor, command_id, project.id, "optimization_completed", {"analysis_run_id": row.id, **evidence})
    return {"optimization": metadata}


def cmd_decide_recommendation(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    project = project_or_error(db, actor, str(payload.get("project_id") or ""))
    row = recommendation_or_error(db, actor, project.id, str(payload.get("recommendation_id") or ""))
    decide_recommendation(row, actor, str(payload.get("decision") or ""), str(payload.get("reason") or ""))
    db.flush()
    evidence = {"project_id": project.id, "recommendation_id": row.id, "status": row.status, "reason": row.decision_reason}
    emit_planning_event(db, actor, command_id, "PlanningRecommendationDecided", "PlanningAnalysisRecommendation", row.id, evidence)
    add_planning_schedule_event(db, actor, command_id, project.id, "recommendation_decided", evidence)
    return {"recommendation": recommendation_read_model(row)}


def cmd_apply_recommendation(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    project = project_or_error(db, actor, str(payload.get("project_id") or ""))
    row = recommendation_or_error(db, actor, project.id, str(payload.get("recommendation_id") or ""))
    changed = apply_recommendation(db, actor, row, int(project.revision))
    db.flush()
    evidence = {"project_id": project.id, "recommendation_id": row.id, "changed_task_ids": sorted(changed), "applied_revision": row.applied_revision}
    emit_planning_event(db, actor, command_id, "PlanningRecommendationApplied", "PlanningAnalysisRecommendation", row.id, evidence)
    add_planning_schedule_event(db, actor, command_id, project.id, "recommendation_applied", evidence)
    return {"recommendation": recommendation_read_model(row), "schedule": schedule_read_model(db, actor, project)}


def cmd_rollback_recommendation(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    project = project_or_error(db, actor, str(payload.get("project_id") or ""))
    row = recommendation_or_error(db, actor, project.id, str(payload.get("recommendation_id") or ""))
    changed = rollback_recommendation(db, actor, row, int(project.revision))
    db.flush()
    evidence = {"project_id": project.id, "recommendation_id": row.id, "changed_task_ids": sorted(changed), "rollback_revision": row.rollback_revision}
    emit_planning_event(db, actor, command_id, "PlanningRecommendationRolledBack", "PlanningAnalysisRecommendation", row.id, evidence)
    add_planning_schedule_event(db, actor, command_id, project.id, "recommendation_rolled_back", evidence)
    return {"recommendation": recommendation_read_model(row), "schedule": schedule_read_model(db, actor, project)}


__all__ = [
    "cmd_apply_recommendation", "cmd_create_what_if_snapshot", "cmd_decide_recommendation",
    "cmd_rollback_recommendation", "cmd_run_optimization", "cmd_run_risk_analysis",
]

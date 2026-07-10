from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from .planning_audit import add_planning_schedule_event, emit_planning_event
from .scheduler import project_or_error
from .what_if import create_what_if_snapshot, what_if_metadata
from .risk_analysis import analysis_metadata, create_risk_analysis
from uok.security import Actor


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


__all__ = ["cmd_create_what_if_snapshot", "cmd_run_risk_analysis"]

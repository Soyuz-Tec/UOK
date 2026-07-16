from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok_planning_core._internal.scheduling.concurrency import _command_project_id
from uok_planning_core._internal.persistence.models import PlanningProject, PlanningScheduleRevision
from uok.kernel.command_contracts import CommandDomainError
from uok.kernel.security import Actor


TRUSTED_RESULT_PROJECT_PATHS = (
    ("project", "id"),
    ("schedule", "project", "id"),
    ("task", "project_id"),
    ("what_if_snapshot", "project_id"),
    ("risk_analysis", "project_id"),
    ("optimization", "project_id"),
    ("recommendation", "project_id"),
)


def assert_planning_replay_visible(
    db: Session,
    actor: Actor,
    command_type: str,
    payload: dict[str, Any],
    result: dict[str, Any],
    correlation_id: str,
) -> None:
    project_id = db.scalar(select(PlanningScheduleRevision.project_id).where(
        PlanningScheduleRevision.organization_id == actor.organization_id,
        PlanningScheduleRevision.correlation_id == correlation_id,
    ))
    if project_id:
        project_id = str(project_id)
    else:
        project_id = _trusted_result_project_id(command_type, result)
    if not project_id:
        try:
            project_id = _command_project_id(db, actor, command_type, payload)
        except ValueError:
            project_id = ""
    project = db.scalar(select(PlanningProject).where(
        PlanningProject.id == project_id,
        PlanningProject.organization_id == actor.organization_id,
        PlanningProject.status != "purged",
    ).with_for_update(read=True))
    if project:
        return
    raise CommandDomainError(
        code="planning_object_not_found",
        message="project_id not found",
        field="project_id",
        object_ids=[],
        repair="Reload the visible Planning project list before retrying.",
        current_revision=None,
        correlation_id=None,
        attach_correlation=False,
    )


def _trusted_result_project_id(command_type: str, result: Any) -> str:
    if not isinstance(result, dict):
        return ""
    if command_type == "CreatePlanningProject":
        project_id = _identifier(result.get("id"))
        if project_id:
            return project_id
    project_id = _identifier(result.get("project_id"))
    if project_id:
        return project_id
    for path in TRUSTED_RESULT_PROJECT_PATHS:
        value: Any = result
        for key in path:
            if not isinstance(value, dict):
                value = None
                break
            value = value.get(key)
        project_id = _identifier(value)
        if project_id:
            return project_id
    return ""


def _identifier(value: Any) -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return ""


__all__ = ["assert_planning_replay_visible"]

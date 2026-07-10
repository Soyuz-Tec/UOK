from __future__ import annotations

import re
from dataclasses import dataclass
from hashlib import sha256
from typing import Any, Callable

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import PlanningProject, PlanningTask, PlanningTaskDependency, utcnow
from .planning_errors import planning_domain_error
from .task_aggregate_state import task_context_states
from uok.command_context import (
    COMMAND_ETAG_RESULT_KEY,
    COMMAND_IF_MATCH_CONTEXT_KEY,
    CommandDomainError,
    CommandPreconditionError,
)
from uok.security import Actor
from uok.util import dumps

PlanningHandler = Callable[[Session, Actor, dict[str, Any], str], dict[str, Any]]
STRONG_ETAG_PATTERN = re.compile(r'^"planning-r([1-9][0-9]*)-sha256-([a-f0-9]{64})"$')


@dataclass
class PlanningConcurrencyContext:
    project: PlanningProject
    task_states: dict[str, tuple[Any, ...]]


def guarded_planning_command(command_type: str, handler: PlanningHandler) -> PlanningHandler:
    def guarded(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
        context = None
        try:
            context = _begin_command(db, actor, command_type, payload)
            result = handler(db, actor, payload, command_id)
            return _finish_command(db, actor, context, result, command_id)
        except (CommandDomainError, CommandPreconditionError):
            raise
        except ValueError as exc:
            revision = int(context.project.revision) if context else None
            raise planning_domain_error(exc, payload, command_id, revision) from exc

    return guarded


def read_schedule_snapshot(db: Session, actor: Actor, project: PlanningProject) -> tuple[dict[str, Any], str]:
    from .read_model import schedule_read_model

    schedule = schedule_read_model(db, actor, project)
    return schedule, strong_schedule_etag(schedule)


def read_locked_schedule_snapshot(db: Session, actor: Actor, project_id: str) -> tuple[dict[str, Any], str]:
    project = db.scalar(
        select(PlanningProject)
        .where(
            PlanningProject.id == project_id,
            PlanningProject.organization_id == actor.organization_id,
        )
        .with_for_update(read=True)
        .execution_options(populate_existing=True)
    )
    if not project:
        raise ValueError("project_id not found")
    return read_schedule_snapshot(db, actor, project)


def strong_schedule_etag(schedule: dict[str, Any]) -> str:
    revision = int(schedule["project"]["revision"])
    canonical = _canonical_value({key: value for key, value in schedule.items() if key != "etag"})
    digest = sha256(dumps(canonical).encode("utf-8")).hexdigest()
    return f'"planning-r{revision}-sha256-{digest}"'


def _canonical_value(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _canonical_value(value[key]) for key in sorted(value)}
    if isinstance(value, list):
        items = [_canonical_value(item) for item in value]
        return sorted(items, key=dumps)
    return value


def _begin_command(
    db: Session,
    actor: Actor,
    command_type: str,
    payload: dict[str, Any],
) -> PlanningConcurrencyContext | None:
    if command_type == "CreatePlanningProject":
        return None
    project_id = _command_project_id(db, actor, command_type, payload)
    project = db.scalar(
        select(PlanningProject)
        .where(
            PlanningProject.id == project_id,
            PlanningProject.organization_id == actor.organization_id,
        )
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if not project:
        raise ValueError("project_id not found")
    schedule, current_etag = read_schedule_snapshot(db, actor, project)
    _require_precondition(project, payload, current_etag)
    return PlanningConcurrencyContext(project=project, task_states=_task_states(db, actor, project.id))


def _finish_command(
    db: Session,
    actor: Actor,
    context: PlanningConcurrencyContext | None,
    result: dict[str, Any],
    command_id: str,
) -> dict[str, Any]:
    db.flush()
    if context is None:
        project_id = str(result.get("id") or "")
        project = db.scalar(select(PlanningProject).where(
            PlanningProject.id == project_id,
            PlanningProject.organization_id == actor.organization_id,
        ))
        if not project:
            raise ValueError("created project was not found")
    else:
        project = context.project
        current_states = _task_states(db, actor, project.id)
        for task in _all_project_tasks(db, actor, project.id):
            previous = context.task_states.get(task.id)
            if previous is not None and previous != current_states.get(task.id):
                task.version = int(task.version) + 1
        project.revision = int(project.revision) + 1
        project.updated_at = utcnow()
        db.flush()
    schedule, etag = read_schedule_snapshot(db, actor, project)
    return _current_result(result, schedule, etag, command_id)


def _require_precondition(project: PlanningProject, payload: dict[str, Any], current_etag: str) -> None:
    supplied = payload.get(COMMAND_IF_MATCH_CONTEXT_KEY)
    reload_url = f"/api/planning/projects/{project.id}/schedule"
    common = {
        "current_revision": int(project.revision),
        "current_etag": current_etag,
        "object_ids": [project.id],
        "reload_url": reload_url,
    }
    if supplied is None or not str(supplied).strip():
        raise CommandPreconditionError(
            code="precondition_required",
            message="A current strong Planning ETag is required for this mutation.",
            status_code=428,
            repair="Reload the schedule, review the latest state, and retry with its exact ETag.",
            **common,
        )
    match = STRONG_ETAG_PATTERN.fullmatch(str(supplied))
    if not match:
        raise CommandPreconditionError(
            code="invalid_precondition",
            message="If-Match must contain exactly one quoted strong Planning ETag.",
            status_code=400,
            repair="Use the exact ETag from the latest schedule response; weak tags, wildcards, and lists are not accepted.",
            **common,
        )
    represented_revision = int(match.group(1))
    expected_revision = payload.get("expected_revision")
    if expected_revision is not None:
        if isinstance(expected_revision, bool) or not isinstance(expected_revision, int) or expected_revision < 1:
            raise CommandPreconditionError(
                code="invalid_precondition",
                message="expected_revision must be a positive integer when supplied.",
                status_code=400,
                repair="Use the project revision returned with the same schedule ETag.",
                **common,
            )
        if expected_revision != represented_revision:
            raise CommandPreconditionError(
                code="inconsistent_precondition",
                message="expected_revision does not match the revision represented by If-Match.",
                status_code=400,
                repair="Reload the schedule and send matching revision and ETag metadata.",
                **common,
            )
    if str(supplied) != current_etag:
        raise CommandPreconditionError(
            code="stale_precondition",
            message="The Planning schedule or its actor-visible context changed after it was loaded.",
            status_code=412,
            repair="Review the latest schedule, then explicitly reapply the intended change or keep the current version.",
            **common,
        )


def _command_project_id(db: Session, actor: Actor, command_type: str, payload: dict[str, Any]) -> str:
    project_commands = {
        "CreatePlanningTask",
        "LinkPlanningTasks",
        "SetPlanningCalendar",
        "CreatePlanningBaseline",
        "CreatePlanningResource",
        "SetPlanningResourceCalendar",
        "LevelPlanningResources",
        "BatchPlanningOperations",
        "CreatePlanningLink",
        "RemovePlanningLink",
        "CreatePlanningWhatIfSnapshot",
    }
    task_commands = {"UpdatePlanningTask", "UpdatePlanningTaskDates", "DeletePlanningTask", "AssignPlanningResource", "AddPlanningTaskParticipant", "RemovePlanningTaskParticipant", "CreatePlanningTaskRequirement", "AdvancePlanningTaskRequirement", "SetPlanningTaskRequirementLink", "DecidePlanningTaskRequirement"}
    dependency_commands = {"UpdatePlanningDependency", "RemovePlanningDependency"}
    if command_type in project_commands:
        if not payload.get("project_id"):
            raise ValueError(f"{command_type} requires project_id")
        return str(payload["project_id"])
    if command_type in task_commands and payload.get("task_id"):
        project_id = db.scalar(select(PlanningTask.project_id).where(
            PlanningTask.id == str(payload["task_id"]),
            PlanningTask.organization_id == actor.organization_id,
        ))
        if project_id:
            return _consistent_project_id(command_type, payload, str(project_id))
    if command_type in dependency_commands and payload.get("dependency_id"):
        project_id = db.scalar(select(PlanningTaskDependency.project_id).where(
            PlanningTaskDependency.id == str(payload["dependency_id"]),
            PlanningTaskDependency.organization_id == actor.organization_id,
        ))
        if project_id:
            return _consistent_project_id(command_type, payload, str(project_id))
    raise ValueError(f"{command_type} does not identify an accessible Planning project")


def _consistent_project_id(command_type: str, payload: dict[str, Any], resolved_project_id: str) -> str:
    supplied = payload.get("project_id")
    if supplied is not None and str(supplied) != resolved_project_id:
        raise ValueError(f"{command_type} project_id does not match its target object")
    return resolved_project_id


def _task_states(db: Session, actor: Actor, project_id: str) -> dict[str, tuple[Any, ...]]:
    context = task_context_states(db, actor, project_id)
    return {task.id: _task_state(task, context.get(task.id, ())) for task in _all_project_tasks(db, actor, project_id)}


def _all_project_tasks(db: Session, actor: Actor, project_id: str) -> list[PlanningTask]:
    return list(db.scalars(select(PlanningTask).where(
        PlanningTask.organization_id == actor.organization_id,
        PlanningTask.project_id == project_id,
    )).all())


def _task_state(task: PlanningTask, context: tuple[tuple[object, ...], ...] = ()) -> tuple[Any, ...]:
    return (
        task.parent_task_id,
        task.title,
        task.task_type,
        task.status,
        task.start_at,
        task.end_at,
        task.forecast_start_at,
        task.forecast_end_at,
        task.actual_start_at,
        task.actual_end_at,
        task.deadline_at,
        task.duration_days,
        task.progress,
        task.sort_order,
        task.attrs_json,
        context,
    )


def _current_result(result: dict[str, Any], schedule: dict[str, Any], etag: str, command_id: str) -> dict[str, Any]:
    tasks = {str(task["id"]): task for task in schedule["tasks"]}
    if {"project", "tasks", "dependencies"}.issubset(result):
        current = dict(schedule)
        current.update({key: value for key, value in result.items() if key not in schedule})
    elif isinstance(result.get("task"), dict):
        current = dict(result)
        task_id = str(result["task"].get("id") or "")
        current["task"] = tasks.get(task_id, result["task"])
        current["validation"] = schedule["validation"]
    elif isinstance(result.get("schedule"), dict):
        current = dict(result)
        current["schedule"] = schedule
    elif str(result.get("id") or "") in tasks:
        current = dict(tasks[str(result["id"])])
    elif str(result.get("id") or "") == str(schedule["project"]["id"]):
        current = dict(schedule["project"])
    else:
        current = dict(result)
    current["revision"] = int(schedule["project"]["revision"])
    current["correlation_id"] = command_id
    current[COMMAND_ETAG_RESULT_KEY] = etag
    return current


__all__ = ["guarded_planning_command", "read_locked_schedule_snapshot", "read_schedule_snapshot", "strong_schedule_etag"]

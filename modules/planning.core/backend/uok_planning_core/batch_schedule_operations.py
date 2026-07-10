from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .advanced_commands import _ignored_periods, _working_days, bounded_int, clean_text
from .batch_operation_types import AppliedBatchOperation
from .models import PlanningCalendar, PlanningProject, PlanningTaskDependency
from .scheduler import DEPENDENCY_TYPES, parse_planning_date, task_or_error
from .task_mutations import apply_task_update
from uok.security import Actor
from uok.util import dumps

TASK_UPDATE_FIELDS = {
    "task_id", "title", "task_type", "parent_task_id", "start", "end", "status",
    "progress", "sort_order", "scheduling_mode", "constraint_type", "constraint_date", "cascade",
}


def update_task(
    db: Session, actor: Actor, project: PlanningProject, payload: dict[str, Any], command_id: str,
) -> AppliedBatchOperation:
    _fields(payload, "update_task", TASK_UPDATE_FIELDS, {"task_id"})
    if "cascade" in payload and not isinstance(payload["cascade"], bool):
        raise ValueError("cascade must be true or false")
    task = task_or_error(db, actor, clean_text(payload.get("task_id"), "task_id", 36), project.id)
    apply_task_update(db, actor, project, task, payload, command_id)
    return AppliedBatchOperation([task.id], {task.id}, bool(payload.get("cascade", True)))


def create_dependency(
    db: Session, actor: Actor, project: PlanningProject, payload: dict[str, Any], _command_id: str,
) -> AppliedBatchOperation:
    _fields(
        payload,
        "create_dependency",
        {"predecessor_task_id", "successor_task_id", "dependency_type", "lag_days"},
        {"predecessor_task_id", "successor_task_id"},
    )
    predecessor = task_or_error(
        db, actor, clean_text(payload.get("predecessor_task_id"), "predecessor_task_id", 36), project.id,
    )
    successor = task_or_error(
        db, actor, clean_text(payload.get("successor_task_id"), "successor_task_id", 36), project.id,
    )
    duplicate = db.scalar(select(PlanningTaskDependency).where(
        PlanningTaskDependency.organization_id == actor.organization_id,
        PlanningTaskDependency.project_id == project.id,
        PlanningTaskDependency.predecessor_task_id == predecessor.id,
        PlanningTaskDependency.successor_task_id == successor.id,
    ))
    if duplicate:
        raise ValueError("dependency already exists")
    row = PlanningTaskDependency(
        organization_id=actor.organization_id,
        project_id=project.id,
        predecessor_task_id=predecessor.id,
        successor_task_id=successor.id,
        dependency_type=_dependency_type(payload.get("dependency_type")),
        lag_days=bounded_int(payload.get("lag_days", 0), "lag_days", -30, 30),
    )
    db.add(row)
    db.flush()
    return AppliedBatchOperation([row.id], {successor.id}, True)


def update_dependency(
    db: Session, actor: Actor, project: PlanningProject, payload: dict[str, Any], _command_id: str,
) -> AppliedBatchOperation:
    _fields(payload, "update_dependency", {"dependency_id", "dependency_type", "lag_days"}, {"dependency_id"})
    if set(payload) == {"dependency_id"}:
        raise ValueError("update_dependency requires dependency_type or lag_days")
    row = _dependency(db, actor, project.id, payload.get("dependency_id"))
    if "dependency_type" in payload:
        row.dependency_type = _dependency_type(payload.get("dependency_type"))
    if "lag_days" in payload:
        row.lag_days = bounded_int(payload.get("lag_days"), "lag_days", -30, 30)
    return AppliedBatchOperation([row.id], {row.successor_task_id}, True)


def remove_dependency(
    db: Session, actor: Actor, project: PlanningProject, payload: dict[str, Any], _command_id: str,
) -> AppliedBatchOperation:
    _fields(payload, "remove_dependency", {"dependency_id"}, {"dependency_id"})
    row = _dependency(db, actor, project.id, payload.get("dependency_id"))
    object_id = row.id
    successor_id = row.successor_task_id
    db.delete(row)
    db.flush()
    return AppliedBatchOperation([object_id], {successor_id}, True)


def set_calendar(
    db: Session, actor: Actor, project: PlanningProject, payload: dict[str, Any], _command_id: str,
) -> AppliedBatchOperation:
    _fields(payload, "set_calendar", {"name", "working_days", "holidays", "ignored_periods"})
    row = db.scalar(select(PlanningCalendar).where(
        PlanningCalendar.organization_id == actor.organization_id,
        PlanningCalendar.project_id == project.id,
    ))
    if row is None:
        row = PlanningCalendar(organization_id=actor.organization_id, project_id=project.id, name="Standard")
        db.add(row)
    row.name = clean_text(payload.get("name") or "Standard", "name", 120)
    row.working_days_json = dumps(_working_days(payload.get("working_days")))
    row.holidays_json = dumps({
        "holidays": [parse_planning_date(item, "holiday").date().isoformat() for item in payload.get("holidays", [])],
        "ignored_periods": _ignored_periods(payload.get("ignored_periods", [])),
    })
    db.flush()
    return AppliedBatchOperation([row.id], cascade_dependencies=True)


def _dependency(db: Session, actor: Actor, project_id: str, value: Any) -> PlanningTaskDependency:
    row = db.get(PlanningTaskDependency, clean_text(value, "dependency_id", 36))
    if not row or row.organization_id != actor.organization_id or row.project_id != project_id:
        raise ValueError("dependency_id not found")
    return row


def _dependency_type(value: Any) -> str:
    selected = str(value or "finish_to_start")
    if selected not in DEPENDENCY_TYPES:
        raise ValueError(
            "dependency_type must be finish_to_start, start_to_start, finish_to_finish, or start_to_finish"
        )
    return selected


def _fields(payload: dict[str, Any], kind: str, allowed: set[str], required: set[str] | None = None) -> None:
    unknown = sorted(set(payload) - allowed)
    if unknown:
        raise ValueError(f"{kind} payload contains unsupported fields: {', '.join(unknown)}")
    missing = sorted(name for name in (required or set()) if payload.get(name) in (None, ""))
    if missing:
        raise ValueError(f"{kind} payload requires: {', '.join(missing)}")


__all__ = ["create_dependency", "remove_dependency", "set_calendar", "update_dependency", "update_task"]

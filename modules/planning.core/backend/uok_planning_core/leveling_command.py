from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import PlanningAssignment, PlanningProject, PlanningResource, PlanningTask
from .planning_audit import add_planning_schedule_event, emit_planning_event
from .read_model import schedule_read_model
from .resource_calendar import ResourceCalendarSpec, resource_calendar_specs
from .resource_capacity import calculate_resource_capacity
from .resource_leveling import (
    DEFAULT_LEVELING_HORIZON_DAYS,
    LEVELING_ENGINE_VERSION,
    LEVELING_STRATEGY,
    MAX_LEVELING_HORIZON_DAYS,
    MAX_LEVELING_PASSES,
    LevelingReason,
    level_resource_allocations,
)
from .resource_leveling_validation import validate_leveling_result
from .scheduler import apply_schedule, project_calendar, project_dependencies, project_or_error, project_tasks
from .schedule_math import CalendarSpec
from .task_constraints import is_auto_scheduled
from uok.security import Actor


def cmd_level_resources(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    project = project_or_error(db, actor, _required_text(payload.get("project_id"), "project_id"))
    horizon_days = _bounded_horizon(payload.get("horizon_days", DEFAULT_LEVELING_HORIZON_DAYS))
    command_changes = apply_schedule(db, actor, project.id)
    tasks = project_tasks(db, actor, project.id)
    resources = _project_resources(db, actor, project.id)
    assignments = _project_assignments(db, actor, tasks)
    calendar = project_calendar(db, actor, project.id)
    resource_calendars = resource_calendar_specs(db, actor, project.id)
    initial_windows = {task.id: (task.start_at, task.end_at) for task in tasks}
    initial_capacity = calculate_resource_capacity(tasks, resources, assignments, calendar, resource_calendars)
    initial_overloads = [point for point in initial_capacity.load_points if point.overallocated]
    passes, engine_reasons = _run_leveling_passes(
        db, actor, project, resources, assignments, calendar, resource_calendars,
        horizon_days, bool(initial_overloads), command_changes,
    )
    report = _validated_report(
        db, actor, project, resources, assignments, calendar, resource_calendars,
        initial_windows, len(initial_overloads), horizon_days, passes, engine_reasons,
    )

    command_changes.update(report["changed_task_ids"])
    evidence = {"project_id": project.id, **report}
    emit_planning_event(db, actor, command_id, "PlanningResourcesLeveled", "PlanningProject", project.id, evidence)
    add_planning_schedule_event(db, actor, command_id, project.id, "resources_leveled", {"changed_task_ids": sorted(command_changes), **report})
    return {**schedule_read_model(db, actor, project), "leveling": report}


def _run_leveling_passes(
    db: Session,
    actor: Actor,
    project: PlanningProject,
    resources: list[PlanningResource],
    assignments: list[PlanningAssignment],
    calendar: CalendarSpec,
    resource_calendars: dict[str, ResourceCalendarSpec],
    horizon_days: int,
    has_overloads: bool,
    command_changes: set[str],
) -> tuple[int, list[LevelingReason]]:
    reasons: list[LevelingReason] = []
    passes = 0
    if not has_overloads:
        return passes, reasons
    for _ in range(MAX_LEVELING_PASSES):
        passes += 1
        pass_result = level_resource_allocations(
            project_tasks(db, actor, project.id), resources, assignments, calendar, resource_calendars,
            horizon_days=horizon_days, latest_finish=project.end_at.date(),
        )
        reasons.extend(pass_result.reasons)
        if not pass_result.changed_task_ids:
            break
        command_changes.update(pass_result.changed_task_ids)
        db.flush()
        command_changes.update(apply_schedule(db, actor, project.id))
    return passes, reasons


def _validated_report(
    db: Session,
    actor: Actor,
    project: PlanningProject,
    resources: list[PlanningResource],
    assignments: list[PlanningAssignment],
    calendar: CalendarSpec,
    resource_calendars: dict[str, ResourceCalendarSpec],
    initial_windows: dict[str, tuple[Any, Any]],
    initial_overload_count: int,
    horizon_days: int,
    passes: int,
    engine_reasons: list[LevelingReason],
) -> dict[str, Any]:
    tasks = project_tasks(db, actor, project.id)
    capacity = calculate_resource_capacity(tasks, resources, assignments, calendar, resource_calendars)
    changed = sorted(task.id for task in tasks if initial_windows.get(task.id) != (task.start_at, task.end_at))
    remaining = [point for point in capacity.load_points if point.overallocated]
    report: dict[str, Any] = {
        "engine_version": LEVELING_ENGINE_VERSION,
        "strategy": LEVELING_STRATEGY,
        "outcome": "leveled" if not remaining else "partially_leveled" if changed else "infeasible",
        "horizon_days": horizon_days,
        "passes": passes,
        "initial_overload_count": initial_overload_count,
        "changed_task_ids": changed,
        "remaining_overloads": [point.as_dict() for point in remaining],
        "reasons": _remaining_reasons(remaining, tasks, assignments, engine_reasons),
    }
    issues = validate_leveling_result(
        initial_windows, tasks, project_dependencies(db, actor, project.id), resources,
        assignments, calendar, resource_calendars, capacity, report,
    )
    report["independent_validation"] = {"ok": not issues, "violations": [issue.as_dict() for issue in issues]}
    if issues:
        raise ValueError("independent post-level validation failed: " + "; ".join(issue.message for issue in issues))
    return report


def _remaining_reasons(
    remaining: list[Any],
    tasks: list[PlanningTask],
    assignments: list[PlanningAssignment],
    engine_reasons: list[LevelingReason],
) -> list[dict[str, object]]:
    tasks_by_id = {task.id: task for task in tasks}
    allocation = {(row.task_id, row.resource_id): int(row.allocation_percent) for row in assignments}
    values: list[dict[str, object]] = []
    for point in remaining:
        task_ids = tuple(point.task_ids)
        manual_ids = tuple(sorted(task_id for task_id in task_ids if task_id in tasks_by_id and not is_auto_scheduled(tasks_by_id[task_id])))
        if manual_ids:
            values.append(_reason("manual_task_immovable", "Manual tasks cannot be moved by simple leveling.", manual_ids, (point.resource_id,), point.day.isoformat()))
        oversized = tuple(sorted(task_id for task_id in task_ids if allocation.get((task_id, point.resource_id), 0) > point.capacity_percent))
        if oversized:
            values.append(_reason("allocation_exceeds_capacity", "A task allocation exceeds the resource capacity on this date.", oversized, (point.resource_id,), point.day.isoformat()))
        for reason in engine_reasons:
            if set(reason.task_ids) & set(task_ids) and (not reason.resource_ids or point.resource_id in reason.resource_ids):
                values.append({**reason.as_dict(), "date": point.day.isoformat()})
        if not manual_ids and not oversized and not any(set(reason.task_ids) & set(task_ids) for reason in engine_reasons):
            values.append(_reason("remaining_resource_overload", "The simple strategy could not resolve this resource/date overload.", task_ids, (point.resource_id,), point.day.isoformat()))
    unique = {(value["code"], tuple(value["task_ids"]), tuple(value["resource_ids"]), value["date"]): value for value in values}
    return list(unique.values())


def _reason(code: str, message: str, task_ids: tuple[str, ...], resource_ids: tuple[str, ...], day: str) -> dict[str, object]:
    return {"code": code, "message": message, "task_ids": list(task_ids), "resource_ids": list(resource_ids), "date": day}


def _project_assignments(db: Session, actor: Actor, tasks: list[PlanningTask]) -> list[PlanningAssignment]:
    task_ids = [task.id for task in tasks]
    if not task_ids:
        return []
    return list(db.scalars(select(PlanningAssignment).where(
        PlanningAssignment.organization_id == actor.organization_id,
        PlanningAssignment.task_id.in_(task_ids),
    )).all())


def _project_resources(db: Session, actor: Actor, project_id: str) -> list[PlanningResource]:
    return list(db.scalars(select(PlanningResource).where(
        PlanningResource.organization_id == actor.organization_id,
        PlanningResource.project_id == project_id,
    )).all())


def _required_text(value: Any, field: str) -> str:
    text = str(value or "").strip()
    if not text:
        raise ValueError(f"{field} is required")
    return text


def _bounded_horizon(value: Any) -> int:
    if isinstance(value, bool):
        raise ValueError(f"horizon_days must be between 1 and {MAX_LEVELING_HORIZON_DAYS}")
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("horizon_days must be a number") from exc
    if not 1 <= parsed <= MAX_LEVELING_HORIZON_DAYS:
        raise ValueError(f"horizon_days must be between 1 and {MAX_LEVELING_HORIZON_DAYS}")
    return parsed


__all__ = ["cmd_level_resources"]

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .calendar_bridge import availability_warnings, calendar_availability_read_model
from .calendar_payload import calendar_holidays, calendar_ignored_periods
from .models import (
    PlanningAssignment,
    PlanningBaseline,
    PlanningCalendar,
    PlanningProject,
    PlanningResource,
    PlanningTask,
    PlanningTaskDependency,
)
from .scheduler import (
    project_calendar,
    project_dependencies,
    project_tasks,
    schedule_analysis,
    validate_schedule,
)
from .schedule_math import working_duration
from .task_constraints import serialize_task_constraint
from uok.security import Actor
from uok.util import loads


def list_projects(db: Session, actor: Actor) -> list[dict[str, Any]]:
    rows = db.scalars(select(PlanningProject).where(
        PlanningProject.organization_id == actor.organization_id,
        PlanningProject.status != "purged",
    ).order_by(PlanningProject.updated_at.desc())).all()
    return [serialize_project(row) for row in rows]


def schedule_read_model(db: Session, actor: Actor, project: PlanningProject) -> dict[str, Any]:
    tasks = project_tasks(db, actor, project.id)
    dependencies = project_dependencies(db, actor, project.id)
    calendar = project_calendar(db, actor, project.id)
    analysis, independent_issues = schedule_analysis(
        tasks,
        dependencies,
        calendar,
        project.start_at.date(),
        project.end_at.date(),
    )
    metrics = {task_id: metric.as_dict() for task_id, metric in analysis.task_metrics.items()}
    baselines = _baselines(db, actor, project.id)
    latest_baseline = _baseline_task_index(baselines[0]) if baselines else {}
    resources = _resources(db, actor, project.id)
    assignments = _assignments(db, actor, tasks, resources)
    availability = calendar_availability_read_model(db, actor, project)
    availability["warnings"] = availability_warnings(tasks, availability)
    violations = validate_schedule(tasks, dependencies, calendar)
    violations.extend(issue.message for issue in independent_issues)
    warnings = _resource_warnings(tasks, resources, assignments, calendar)
    wbs = _wbs_numbers(tasks)
    return {
        "project": serialize_project(project),
        "tasks": [serialize_task(task, metrics.get(task.id, {}), latest_baseline.get(task.id), wbs.get(task.id, "")) for task in tasks],
        "dependencies": [serialize_dependency(dep) for dep in dependencies],
        "calendar": _calendar_row(db, actor, project.id),
        "availability": availability,
        "resources": [serialize_resource(row) for row in resources],
        "assignments": [serialize_assignment(row) for row in assignments],
        "baselines": [serialize_baseline(row) for row in baselines],
        "calculation": {
            "engine_version": analysis.engine_version,
            "project_start": analysis.project_start.isoformat(),
            "calculated_finish": analysis.calculated_finish.isoformat(),
            "target_finish": analysis.target_finish.isoformat(),
            "target_variance_days": analysis.target_variance_days,
            "independent_validation": {
                "ok": not independent_issues,
                "violations": [issue.as_dict() for issue in independent_issues],
            },
        },
        "validation": {"ok": not violations, "violations": violations, "warnings": warnings},
    }


def serialize_project(project: PlanningProject) -> dict[str, Any]:
    return {
        "id": project.id,
        "name": project.name,
        "status": project.status,
        "start": project.start_at.date().isoformat(),
        "end": project.end_at.date().isoformat(),
        "revision": int(project.revision),
        "updated_at": _timestamp(project.updated_at),
    }


def serialize_task(task: PlanningTask, metrics: dict[str, Any] | None = None, baseline: dict[str, str] | None = None, wbs: str = "") -> dict[str, Any]:
    metrics = metrics or {}
    start = task.start_at.date()
    end = task.end_at.date()
    baseline_start = baseline.get("start") if baseline else None
    baseline_end = baseline.get("end") if baseline else None
    slack = int(metrics.get("total_slack_days", 0))
    return {
        "id": task.id,
        "project_id": task.project_id,
        "parent_task_id": task.parent_task_id,
        "wbs": wbs,
        "title": task.title,
        "task_type": task.task_type,
        "status": task.status,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "duration_days": task.duration_days,
        "progress": task.progress,
        "sort_order": task.sort_order,
        "version": int(task.version),
        "critical": task.task_type != "summary" and bool(metrics.get("critical", slack <= 0)),
        "early_start": _iso(metrics.get("early_start", start)),
        "early_finish": _iso(metrics.get("early_finish", end)),
        "late_start": _iso(metrics.get("late_start", start)),
        "late_finish": _iso(metrics.get("late_finish", end)),
        "total_slack_days": slack,
        "free_float_days": int(metrics.get("free_float_days", 0)),
        "baseline_start": baseline_start,
        "baseline_end": baseline_end,
        "start_variance_days": _variance_days(baseline_start, start),
        "end_variance_days": _variance_days(baseline_end, end),
        **serialize_task_constraint(task),
    }


def serialize_dependency(dep: PlanningTaskDependency) -> dict[str, Any]:
    return {
        "id": dep.id,
        "project_id": dep.project_id,
        "predecessor_task_id": dep.predecessor_task_id,
        "successor_task_id": dep.successor_task_id,
        "dependency_type": dep.dependency_type,
        "lag_days": dep.lag_days,
    }


def serialize_resource(row: PlanningResource) -> dict[str, Any]:
    return {"id": row.id, "project_id": row.project_id, "name": row.name, "role": row.role}


def serialize_assignment(row: PlanningAssignment) -> dict[str, Any]:
    return {
        "id": row.id,
        "task_id": row.task_id,
        "resource_id": row.resource_id,
        "allocation_percent": row.allocation_percent,
    }


def serialize_baseline(row: PlanningBaseline) -> dict[str, Any]:
    return {"id": row.id, "project_id": row.project_id, "name": row.name, "created_at": _timestamp(row.created_at)}


def baseline_snapshot(tasks: list[PlanningTask]) -> dict[str, Any]:
    return {
        "tasks": [
            {"id": task.id, "title": task.title, "start": task.start_at.date().isoformat(), "end": task.end_at.date().isoformat()}
            for task in tasks
        ]
    }


def _calendar_row(db: Session, actor: Actor, project_id: str) -> dict[str, Any]:
    row = db.scalars(select(PlanningCalendar).where(
        PlanningCalendar.organization_id == actor.organization_id,
        PlanningCalendar.project_id == project_id,
    )).first()
    if not row:
        return {"name": "Standard", "working_days": [1, 2, 3, 4, 5], "holidays": [], "ignored_periods": []}
    raw_holidays = loads(row.holidays_json, [])
    return {
        "id": row.id,
        "name": row.name,
        "working_days": loads(row.working_days_json, [1, 2, 3, 4, 5]),
        "holidays": calendar_holidays(raw_holidays),
        "ignored_periods": calendar_ignored_periods(raw_holidays),
    }


def _baselines(db: Session, actor: Actor, project_id: str) -> list[PlanningBaseline]:
    return list(db.scalars(select(PlanningBaseline).where(
        PlanningBaseline.organization_id == actor.organization_id,
        PlanningBaseline.project_id == project_id,
    ).order_by(PlanningBaseline.created_at.desc())).all())


def _baseline_task_index(row: PlanningBaseline) -> dict[str, dict[str, str]]:
    snapshot = loads(row.snapshot_json, {})
    return {str(item["id"]): item for item in snapshot.get("tasks", []) if "id" in item}


def _resources(db: Session, actor: Actor, project_id: str) -> list[PlanningResource]:
    return list(db.scalars(select(PlanningResource).where(
        PlanningResource.organization_id == actor.organization_id,
        PlanningResource.project_id == project_id,
    ).order_by(PlanningResource.name)).all())


def _assignments(db: Session, actor: Actor, tasks: list[PlanningTask], resources: list[PlanningResource]) -> list[PlanningAssignment]:
    task_ids = {task.id for task in tasks}
    resource_ids = {row.id for row in resources}
    if not task_ids or not resource_ids:
        return []
    return list(db.scalars(select(PlanningAssignment).where(
        PlanningAssignment.organization_id == actor.organization_id,
        PlanningAssignment.task_id.in_(task_ids),
        PlanningAssignment.resource_id.in_(resource_ids),
    )).all())


def _resource_warnings(tasks: list[PlanningTask], resources: list[PlanningResource], assignments: list[PlanningAssignment], calendar: Any) -> list[str]:
    by_task = {task.id: task for task in tasks}
    by_resource = {resource.id: resource for resource in resources}
    usage: dict[tuple[str, date], int] = defaultdict(int)
    for assignment in assignments:
        task = by_task.get(assignment.task_id)
        if not task:
            continue
        current = task.start_at.date()
        while current <= task.end_at.date():
            if calendar.is_working_day(current):
                usage[(assignment.resource_id, current)] += assignment.allocation_percent
            current = date.fromordinal(current.toordinal() + 1)
    warnings: list[str] = []
    for (resource_id, day), allocation in sorted(usage.items(), key=lambda item: (item[0][0], item[0][1])):
        if allocation > 100:
            warnings.append(f"{by_resource[resource_id].name} is allocated {allocation}% on {day.isoformat()}")
    return warnings


def _wbs_numbers(tasks: list[PlanningTask]) -> dict[str, str]:
    children: dict[str | None, list[PlanningTask]] = defaultdict(list)
    for task in tasks:
        children[task.parent_task_id].append(task)
    values: dict[str, str] = {}

    def visit(parent_id: str | None, prefix: str) -> None:
        for index, task in enumerate(children[parent_id], start=1):
            number = f"{prefix}.{index}" if prefix else str(index)
            values[task.id] = number
            visit(task.id, number)

    visit(None, "")
    return values


def _variance_days(baseline_value: str | None, current: date) -> int | None:
    if not baseline_value:
        return None
    return (current - date.fromisoformat(baseline_value)).days


def _iso(value: Any) -> str:
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def _timestamp(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None or value.utcoffset() is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()

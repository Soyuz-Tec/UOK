from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok_planning_core._internal.coordination.calendar_bridge import availability_warnings, calendar_availability_read_model
from uok_planning_core._internal.scheduling.calendar_payload import calendar_holidays, calendar_ignored_periods
from uok_planning_core._internal.scheduling.date_semantics import date_semantics_read_model, task_date_read_model
from uok_planning_core._internal.coordination.link_read_model import planning_links_read_model
from uok_planning_core._internal.coordination.participant_resolver import planning_participants_read_model
from uok_planning_core._internal.coordination.requirement_read_model import project_requirement_context
from uok_planning_core._internal.delivery.policy import capability_read_model
from uok_planning_core._internal.scheduling.project_calculation import project_schedule_analysis
from uok_planning_core._internal.resources.resource_capacity import calculate_resource_capacity, resource_capacity_warnings
from uok_planning_core._internal.resources.resource_capacity_validation import validate_resource_capacity_result
from uok_planning_core._internal.resources.resource_calendar import resource_calendar_specs
from uok_planning_core._internal.resources.resource_read_model import serialize_resource
from uok_planning_core._internal.persistence.models import (
    PlanningAssignment,
    PlanningBaseline,
    PlanningCalendar,
    PlanningProject,
    PlanningResource,
    PlanningTask,
    PlanningTaskDependency,
)
from uok_planning_core._internal.scheduling.scheduler import (
    project_calendar,
    project_dependencies,
    project_tasks,
    validate_schedule,
)
from uok_planning_core._internal.scheduling.schedule_math import working_duration
from uok_planning_core._internal.scheduling.task_constraints import serialize_task_constraint
from uok_planning_core._internal.scheduling.status_policy import task_flow_read_model
from uok.kernel.security import Actor
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
    analysis, cpm_issues = project_schedule_analysis(project, tasks, dependencies, calendar)
    metrics = {task_id: metric.as_dict() for task_id, metric in analysis.task_metrics.items()}
    baselines = _baselines(db, actor, project.id)
    latest_baseline = _baseline_task_index(baselines[0]) if baselines else {}
    resources = _resources(db, actor, project.id)
    resource_calendars = resource_calendar_specs(db, actor, project.id)
    assignments = _assignments(db, actor, tasks, resources)
    links = planning_links_read_model(db, actor, project.id)
    participants = planning_participants_read_model(db, actor, project.id)
    participants_by_task: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for participant in participants:
        participants_by_task[str(participant["task_id"])].append(participant)
    requirements, readiness_by_task, project_readiness = project_requirement_context(db, actor, project.id, links)
    capacity = calculate_resource_capacity(tasks, resources, assignments, calendar, resource_calendars)
    capacity_issues = validate_resource_capacity_result(tasks, resources, assignments, calendar, capacity, resource_calendars)
    independent_issues = [*cpm_issues, *capacity_issues]
    availability = calendar_availability_read_model(db, actor, project, tasks, resources, assignments, participants)
    availability["warnings"] = availability_warnings(tasks, availability)
    violations = validate_schedule(tasks, dependencies, calendar)
    violations.extend(issue.message for issue in independent_issues)
    warnings = resource_capacity_warnings(capacity, resources)
    wbs = _wbs_numbers(tasks)
    return {
        "project": serialize_project(project),
        "capabilities": capability_read_model(actor),
        "task_flow": task_flow_read_model(),
        "tasks": [serialize_task(task, metrics.get(task.id, {}), latest_baseline.get(task.id), wbs.get(task.id, ""), project.timezone_name, participants_by_task.get(task.id, []), readiness_by_task.get(task.id)) for task in tasks],
        "dependencies": [serialize_dependency(dep) for dep in dependencies],
        "calendar": _calendar_row(db, actor, project.id),
        "availability": availability,
        "resources": [serialize_resource(db, actor, row, resource_calendars.get(row.id)) for row in resources],
        "assignments": [serialize_assignment(row) for row in assignments],
        "links": links,
        "participants": participants,
        "requirements": requirements,
        "readiness": project_readiness,
        "date_semantics": date_semantics_read_model(project),
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
            "resource_capacity": {
                **capacity.as_dict(),
                "independent_validation": {
                    "ok": not capacity_issues,
                    "violations": [issue.as_dict() for issue in capacity_issues],
                },
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
        "target_finish": project.target_finish_at.date().isoformat(),
        "calculated_finish": project.calculated_finish_at.date().isoformat(),
        "timezone": project.timezone_name,
        "revision": int(project.revision),
        "updated_at": _timestamp(project.updated_at),
    }


def serialize_task(
    task: PlanningTask,
    metrics: dict[str, Any] | None = None,
    baseline: dict[str, str] | None = None,
    wbs: str = "",
    project_timezone: str = "UTC",
    participants: list[dict[str, Any]] | None = None,
    readiness: dict[str, Any] | None = None,
) -> dict[str, Any]:
    metrics = metrics or {}
    start = task.start_at.date()
    end = task.end_at.date()
    baseline_start = baseline.get("start") if baseline else None
    baseline_end = baseline.get("end") if baseline else None
    slack = int(metrics.get("total_slack_days", 0))
    participants = participants or []
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
        "participant_ids": sorted({str(row["party"]["id"]) for row in participants if row["party"]["id"]}),
        "participant_roles": sorted({str(row["role"]) for row in participants}),
        "readiness": readiness or {"ready": True, "required_count": 0, "blocking_count": 0, "blocking_requirement_ids": []},
        **task_date_read_model(task, project_timezone),
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


def serialize_assignment(row: PlanningAssignment) -> dict[str, Any]:
    return {
        "id": row.id,
        "task_id": row.task_id,
        "resource_id": row.resource_id,
        "allocation_percent": row.allocation_percent,
    }


def serialize_baseline(row: PlanningBaseline) -> dict[str, Any]:
    from .baselines import baseline_metadata

    return baseline_metadata(row)


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
    ).order_by(PlanningBaseline.created_at.desc(), PlanningBaseline.id.desc())).all())


def _baseline_task_index(row: PlanningBaseline) -> dict[str, dict[str, str]]:
    try:
        snapshot = loads(row.snapshot_json, {})
    except (TypeError, ValueError):
        return {}
    if not isinstance(snapshot, dict):
        return {}
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

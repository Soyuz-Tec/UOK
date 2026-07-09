from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, time, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .calendar_payload import calendar_holidays, calendar_ignored_dates
from .models import PlanningCalendar, PlanningProject, PlanningTask, PlanningTaskDependency
from .schedule_math import (
    CalendarSpec,
    at_utc,
    default_calendar,
    end_for_start,
    next_working_day,
    shift_working,
    start_for_finish,
    working_distance,
)
from .schedule_graph import dependency_order
from .schedule_hierarchy import hierarchy_violations
from .task_constraints import constraint_violations, enforce_task_constraints
from uok.security import Actor
from uok.util import loads

DEPENDENCY_TYPES = {"finish_to_start", "start_to_start", "finish_to_finish", "start_to_finish"}

def parse_planning_date(value: Any, field: str) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, date):
        return datetime.combine(value, time.min, tzinfo=timezone.utc)
    text = str(value or "").strip()
    if not text:
        raise ValueError(f"{field} is required")
    try:
        if len(text) == 10:
            return datetime.combine(date.fromisoformat(text), time.min, tzinfo=timezone.utc)
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError as exc:
        raise ValueError(f"{field} must be an ISO date") from exc


def project_or_error(db: Session, actor: Actor, project_id: str) -> PlanningProject:
    project = db.get(PlanningProject, project_id)
    if not project or project.organization_id != actor.organization_id:
        raise ValueError("project_id not found")
    return project


def task_or_error(db: Session, actor: Actor, task_id: str, project_id: str | None = None) -> PlanningTask:
    task = db.get(PlanningTask, task_id)
    if not task or task.organization_id != actor.organization_id or task.status == "deleted":
        raise ValueError("task_id not found")
    if project_id and task.project_id != project_id:
        raise ValueError("task_id is not part of the project")
    return task


def project_tasks(db: Session, actor: Actor, project_id: str) -> list[PlanningTask]:
    return list(db.scalars(select(PlanningTask).where(
        PlanningTask.organization_id == actor.organization_id,
        PlanningTask.project_id == project_id,
        PlanningTask.status != "deleted",
    ).order_by(PlanningTask.sort_order, PlanningTask.created_at)).all())


def project_dependencies(db: Session, actor: Actor, project_id: str) -> list[PlanningTaskDependency]:
    return list(db.scalars(select(PlanningTaskDependency).where(
        PlanningTaskDependency.organization_id == actor.organization_id,
        PlanningTaskDependency.project_id == project_id,
    )).all())


def project_calendar(db: Session, actor: Actor, project_id: str) -> CalendarSpec:
    row = db.scalars(select(PlanningCalendar).where(
        PlanningCalendar.organization_id == actor.organization_id,
        PlanningCalendar.project_id == project_id,
    )).first()
    if not row:
        return default_calendar()
    working_days = {int(item) for item in loads(row.working_days_json, [1, 2, 3, 4, 5]) if 1 <= int(item) <= 7}
    raw_holidays = loads(row.holidays_json, [])
    holidays = {date.fromisoformat(item) for item in calendar_holidays(raw_holidays)}
    holidays.update(calendar_ignored_dates(raw_holidays))
    return CalendarSpec(frozenset(working_days or {1, 2, 3, 4, 5}), frozenset(holidays))

def apply_schedule(db: Session, actor: Actor, project_id: str, cascade_dependencies: bool = True) -> set[str]:
    tasks = project_tasks(db, actor, project_id)
    dependencies = project_dependencies(db, actor, project_id)
    calendar = project_calendar(db, actor, project_id)
    violations = validate_schedule(tasks, dependencies, calendar)
    if any("cycle" in item for item in violations):
        raise ValueError("; ".join(violations))
    changed = _normalize_calendar_windows(tasks, calendar)
    changed.update(enforce_task_constraints(tasks, calendar))
    if cascade_dependencies:
        changed.update(_propagate_dependencies(tasks, dependencies, calendar))
        changed.update(enforce_task_constraints(tasks, calendar))
    changed.update(_roll_up_summaries(tasks))
    return changed

def validate_schedule(
    tasks: list[PlanningTask],
    dependencies: list[PlanningTaskDependency],
    calendar: CalendarSpec | None = None,
) -> list[str]:
    calendar = calendar or default_calendar()
    task_ids = {task.id for task in tasks}
    task_by_id = {task.id: task for task in tasks}
    violations: list[str] = []
    for dep in dependencies:
        if dep.predecessor_task_id not in task_ids or dep.successor_task_id not in task_ids:
            violations.append("dependency references a missing task")
            continue
        if dep.predecessor_task_id == dep.successor_task_id:
            violations.append("dependency cannot link a task to itself")
            continue
        if dep.dependency_type not in DEPENDENCY_TYPES:
            violations.append(f"dependency_type {dep.dependency_type} is not supported")
            continue
        violation = _dependency_violation(task_by_id[dep.predecessor_task_id], task_by_id[dep.successor_task_id], dep, calendar)
        if violation:
            violations.append(violation)
    if dependency_order(task_ids, dependencies) is None:
        violations.append("schedule contains a dependency cycle")
    violations.extend(hierarchy_violations(tasks))
    violations.extend(constraint_violations(tasks))
    return violations

def assert_task_dependency_position(task: PlanningTask, tasks: list[PlanningTask], dependencies: list[PlanningTaskDependency], calendar: CalendarSpec) -> None:
    task_by_id = {row.id: row for row in tasks}
    violations = [
        _dependency_violation(task_by_id[dep.predecessor_task_id], task, dep, calendar)
        for dep in dependencies
        if dep.successor_task_id == task.id and dep.predecessor_task_id in task_by_id
    ]
    violations = [item for item in violations if item]
    if violations:
        raise ValueError("; ".join(violations))


def schedule_metrics(tasks: list[PlanningTask], dependencies: list[PlanningTaskDependency], calendar: CalendarSpec) -> dict[str, dict[str, Any]]:
    active = [task for task in tasks if task.task_type != "summary"]
    by_id = {task.id: task for task in active}
    successors: dict[str, list[PlanningTaskDependency]] = defaultdict(list)
    predecessors: dict[str, list[PlanningTaskDependency]] = defaultdict(list)
    for dep in dependencies:
        if dep.predecessor_task_id in by_id and dep.successor_task_id in by_id:
            successors[dep.predecessor_task_id].append(dep)
            predecessors[dep.successor_task_id].append(dep)
    project_finish = max((task.end_at.date() for task in active), default=date.today())
    latest_start: dict[str, date] = {}
    latest_finish: dict[str, date] = {}
    order = _dependency_order(active, dependencies) or [task.id for task in active]
    for task_id in reversed(order):
        task = by_id[task_id]
        if not successors[task_id]:
            latest_finish[task_id] = project_finish
            latest_start[task_id] = start_for_finish(project_finish, task.duration_days, calendar)
            continue
        starts: list[date] = []
        finishes: list[date] = []
        for dep in successors[task_id]:
            successor = by_id[dep.successor_task_id]
            succ_start = latest_start.get(successor.id, successor.start_at.date())
            succ_finish = latest_finish.get(successor.id, successor.end_at.date())
            if dep.dependency_type == "finish_to_start":
                finishes.append(shift_working(succ_start, -(dep.lag_days + 1), calendar))
            elif dep.dependency_type == "start_to_start":
                starts.append(shift_working(succ_start, -dep.lag_days, calendar))
            elif dep.dependency_type == "finish_to_finish":
                finishes.append(shift_working(succ_finish, -dep.lag_days, calendar))
            elif dep.dependency_type == "start_to_finish":
                starts.append(shift_working(succ_finish, -dep.lag_days, calendar))
        candidate_start = min(starts) if starts else None
        candidate_finish = min(finishes) if finishes else None
        if candidate_finish:
            finish_based_start = start_for_finish(candidate_finish, task.duration_days, calendar)
            candidate_start = min([value for value in [candidate_start, finish_based_start] if value])
        latest_start[task_id] = candidate_start or task.start_at.date()
        latest_finish[task_id] = end_for_start(latest_start[task_id], task.duration_days, calendar)
    return {
        task.id: {
            "early_start": task.start_at.date(),
            "early_finish": task.end_at.date(),
            "late_start": latest_start.get(task.id, task.start_at.date()),
            "late_finish": latest_finish.get(task.id, task.end_at.date()),
            "total_slack_days": max(0, working_distance(task.start_at.date(), latest_start.get(task.id, task.start_at.date()), calendar)),
        }
        for task in tasks
    }


def _propagate_dependencies(tasks: list[PlanningTask], dependencies: list[PlanningTaskDependency], calendar: CalendarSpec) -> set[str]:
    changed: set[str] = set()
    by_id = {task.id: task for task in tasks if task.task_type != "summary"}
    order = _dependency_order(list(by_id.values()), dependencies)
    if order is None:
        return changed
    incoming: dict[str, list[PlanningTaskDependency]] = defaultdict(list)
    for dep in dependencies:
        if dep.predecessor_task_id in by_id and dep.successor_task_id in by_id:
            incoming[dep.successor_task_id].append(dep)
    for task_id in order:
        task = by_id[task_id]
        start = task.start_at.date()
        original_start = start
        for dep in incoming[task_id]:
            predecessor = by_id[dep.predecessor_task_id]
            start = max(start, _required_successor_start(predecessor, task, dep, calendar))
        if start == original_start:
            continue
        new_end = end_for_start(start, task.duration_days, calendar)
        task.start_at = at_utc(start)
        task.end_at = at_utc(new_end)
        changed.add(task.id)
    return changed


def _normalize_calendar_windows(tasks: list[PlanningTask], calendar: CalendarSpec) -> set[str]:
    changed: set[str] = set()
    for task in tasks:
        if task.task_type == "summary":
            continue
        start = next_working_day(task.start_at.date(), calendar)
        if task.task_type == "milestone":
            end = start
        else:
            end = end_for_start(start, max(1, task.duration_days), calendar)
        if task.start_at.date() != start or task.end_at.date() != end:
            task.start_at = at_utc(start)
            task.end_at = at_utc(end)
            changed.add(task.id)
    return changed


def _roll_up_summaries(tasks: list[PlanningTask]) -> set[str]:
    changed: set[str] = set()
    children: dict[str, list[PlanningTask]] = defaultdict(list)
    by_id = {task.id: task for task in tasks}
    for task in tasks:
        if task.parent_task_id in by_id:
            children[str(task.parent_task_id)].append(task)
    for task in sorted(tasks, key=lambda item: item.sort_order, reverse=True):
        if task.task_type != "summary" or not children[task.id]:
            continue
        start = min(child.start_at.date() for child in children[task.id])
        end = max(child.end_at.date() for child in children[task.id])
        weight = sum(max(1, child.duration_days) for child in children[task.id])
        progress = round(sum(child.progress * max(1, child.duration_days) for child in children[task.id]) / weight)
        if task.start_at.date() != start or task.end_at.date() != end or task.progress != progress:
            task.start_at = at_utc(start)
            task.end_at = at_utc(end)
            task.duration_days = max(1, (end - start).days + 1)
            task.progress = progress
            changed.add(task.id)
    return changed


def _required_successor_start(predecessor: PlanningTask, successor: PlanningTask, dep: PlanningTaskDependency, calendar: CalendarSpec) -> date:
    duration = successor.duration_days
    if dep.dependency_type == "finish_to_start":
        return shift_working(predecessor.end_at.date(), dep.lag_days + 1, calendar)
    if dep.dependency_type == "start_to_start":
        return shift_working(predecessor.start_at.date(), dep.lag_days, calendar)
    if dep.dependency_type == "finish_to_finish":
        finish = shift_working(predecessor.end_at.date(), dep.lag_days, calendar)
        return start_for_finish(finish, duration, calendar)
    finish = shift_working(predecessor.start_at.date(), dep.lag_days, calendar)
    return start_for_finish(finish, duration, calendar)


def _dependency_violation(predecessor: PlanningTask, successor: PlanningTask, dep: PlanningTaskDependency, calendar: CalendarSpec) -> str | None:
    required_start = _required_successor_start(predecessor, successor, dep, calendar)
    if successor.start_at.date() < required_start:
        return f"{successor.title} violates {dep.dependency_type} dependency from {predecessor.title}"
    return None


def _dependency_order(tasks: list[PlanningTask], dependencies: list[PlanningTaskDependency]) -> list[str] | None:
    return dependency_order((task.id for task in tasks), dependencies)

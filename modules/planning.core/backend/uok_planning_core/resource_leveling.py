from __future__ import annotations

from collections import defaultdict
from datetime import date

from .models import PlanningAssignment, PlanningResource, PlanningTask
from .resource_calendar import ResourceCalendarSpec, resource_capacity_percent
from .schedule_math import CalendarSpec, at_utc, end_for_start, shift_working
from .task_constraints import is_auto_scheduled


def level_resource_allocations(
    tasks: list[PlanningTask],
    resources: list[PlanningResource],
    assignments: list[PlanningAssignment],
    calendar: CalendarSpec,
    resource_calendars: dict[str, ResourceCalendarSpec] | None = None,
) -> set[str]:
    changed: set[str] = set()
    assigned = _assignments_by_task(assignments)
    resources_by_id = {resource.id: resource for resource in resources}
    calendars = resource_calendars or {}
    fixed_task_ids: set[str] = set()
    for task in sorted(tasks, key=lambda item: (item.start_at.date().isoformat(), item.sort_order, item.created_at.isoformat())):
        if task.task_type in {"summary", "milestone"} or not is_auto_scheduled(task) or task.id not in assigned:
            fixed_task_ids.add(task.id)
            continue
        shifted = _level_task(task, assigned[task.id], tasks, assignments, fixed_task_ids, calendar, resources_by_id, calendars)
        if shifted:
            changed.add(task.id)
        fixed_task_ids.add(task.id)
    return changed


def _level_task(task: PlanningTask, task_assignments: list[PlanningAssignment], tasks: list[PlanningTask], assignments: list[PlanningAssignment], fixed_task_ids: set[str], calendar: CalendarSpec, resources: dict[str, PlanningResource], resource_calendars: dict[str, ResourceCalendarSpec]) -> bool:
    start = task.start_at.date()
    for _ in range(260):
        if not _overloaded(task.id, start, task.duration_days, task_assignments, tasks, assignments, fixed_task_ids, calendar, resources, resource_calendars):
            return _move(task, start, calendar)
        start = shift_working(start, 1, calendar)
    return False


def _overloaded(task_id: str, start: date, duration: int, task_assignments: list[PlanningAssignment], tasks: list[PlanningTask], assignments: list[PlanningAssignment], fixed_task_ids: set[str], calendar: CalendarSpec, resources: dict[str, PlanningResource], resource_calendars: dict[str, ResourceCalendarSpec]) -> bool:
    usage = _usage_excluding(task_id, tasks, assignments, fixed_task_ids, calendar)
    end = end_for_start(start, max(1, duration), calendar)
    for assignment in task_assignments:
        resource = resources.get(assignment.resource_id)
        if resource is None:
            return True
        current = start
        while current <= end:
            capacity = resource_capacity_percent(resource, resource_calendars.get(resource.id), current)
            if calendar.is_working_day(current) and usage[(assignment.resource_id, current)] + assignment.allocation_percent > capacity:
                return True
            current = date.fromordinal(current.toordinal() + 1)
    return False


def _usage_excluding(task_id: str, tasks: list[PlanningTask], assignments: list[PlanningAssignment], fixed_task_ids: set[str], calendar: CalendarSpec) -> dict[tuple[str, date], int]:
    by_task = {task.id: task for task in tasks if task.id in fixed_task_ids and task.id != task_id and task.task_type not in {"summary", "milestone"}}
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
    return usage


def _move(task: PlanningTask, start: date, calendar: CalendarSpec) -> bool:
    end = end_for_start(start, max(1, task.duration_days), calendar)
    if task.start_at.date() == start and task.end_at.date() == end:
        return False
    task.start_at = at_utc(start)
    task.end_at = at_utc(end)
    return True


def _assignments_by_task(assignments: list[PlanningAssignment]) -> dict[str, list[PlanningAssignment]]:
    values: dict[str, list[PlanningAssignment]] = defaultdict(list)
    for assignment in assignments:
        values[assignment.task_id].append(assignment)
    return values

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date

from .models import PlanningAssignment, PlanningResource, PlanningTask
from .resource_calendar import ResourceCalendarSpec, resource_capacity_percent
from .schedule_math import CalendarSpec, at_utc, end_for_start, shift_working
from .task_constraints import is_auto_scheduled

LEVELING_ENGINE_VERSION = "uok-simple-resource-leveling-2"
LEVELING_STRATEGY = "simple_forward"
DEFAULT_LEVELING_HORIZON_DAYS = 260
MAX_LEVELING_HORIZON_DAYS = 1095
MAX_LEVELING_PASSES = 5


@dataclass(frozen=True)
class LevelingReason:
    code: str
    message: str
    task_ids: tuple[str, ...]
    resource_ids: tuple[str, ...]

    def as_dict(self) -> dict[str, object]:
        return {
            "code": self.code,
            "message": self.message,
            "task_ids": list(self.task_ids),
            "resource_ids": list(self.resource_ids),
        }


@dataclass(frozen=True)
class ResourceLevelingPassResult:
    changed_task_ids: tuple[str, ...]
    reasons: tuple[LevelingReason, ...]


def level_resource_allocations(
    tasks: list[PlanningTask],
    resources: list[PlanningResource],
    assignments: list[PlanningAssignment],
    calendar: CalendarSpec,
    resource_calendars: dict[str, ResourceCalendarSpec] | None = None,
    *,
    horizon_days: int = DEFAULT_LEVELING_HORIZON_DAYS,
    latest_finish: date | None = None,
) -> ResourceLevelingPassResult:
    changed: set[str] = set()
    reasons: list[LevelingReason] = []
    assigned = _assignments_by_task(assignments)
    resources_by_id = {resource.id: resource for resource in resources}
    calendars = resource_calendars or {}
    fixed_task_ids: set[str] = set()
    ordered = sorted(tasks, key=lambda item: (item.start_at.date(), item.sort_order, item.created_at))
    for task in ordered:
        if task.task_type in {"summary", "milestone"} or not is_auto_scheduled(task) or task.id not in assigned:
            fixed_task_ids.add(task.id)
            continue
        moved, reason = _level_task(
            task,
            assigned[task.id],
            tasks,
            assignments,
            fixed_task_ids,
            calendar,
            resources_by_id,
            calendars,
            horizon_days,
            latest_finish,
        )
        if moved:
            changed.add(task.id)
        if reason:
            reasons.append(reason)
        fixed_task_ids.add(task.id)
    return ResourceLevelingPassResult(tuple(sorted(changed)), tuple(reasons))


def _level_task(
    task: PlanningTask,
    task_assignments: list[PlanningAssignment],
    tasks: list[PlanningTask],
    assignments: list[PlanningAssignment],
    fixed_task_ids: set[str],
    calendar: CalendarSpec,
    resources: dict[str, PlanningResource],
    resource_calendars: dict[str, ResourceCalendarSpec],
    horizon_days: int,
    latest_finish: date | None,
) -> tuple[bool, LevelingReason | None]:
    start = task.start_at.date()
    conflict_resources: set[str] = set()
    for _ in range(horizon_days + 1):
        end = end_for_start(start, max(1, task.duration_days), calendar)
        if latest_finish and end > latest_finish:
            return False, _reason(
                "project_finish_limit",
                "No feasible placement exists before the project finish limit.",
                task,
                conflict_resources,
            )
        conflicts = _conflicts(
            task.id,
            start,
            task.duration_days,
            task_assignments,
            tasks,
            assignments,
            fixed_task_ids,
            calendar,
            resources,
            resource_calendars,
        )
        if not conflicts:
            return _move(task, start, calendar), None
        conflict_resources.update(conflicts)
        start = shift_working(start, 1, calendar)
    return False, _reason(
        "horizon_exhausted",
        f"No feasible placement was found within the configured {horizon_days}-working-day horizon.",
        task,
        conflict_resources,
    )


def _conflicts(
    task_id: str,
    start: date,
    duration: int,
    task_assignments: list[PlanningAssignment],
    tasks: list[PlanningTask],
    assignments: list[PlanningAssignment],
    fixed_task_ids: set[str],
    calendar: CalendarSpec,
    resources: dict[str, PlanningResource],
    resource_calendars: dict[str, ResourceCalendarSpec],
) -> set[str]:
    usage = _usage_excluding(task_id, tasks, assignments, fixed_task_ids, calendar)
    end = end_for_start(start, max(1, duration), calendar)
    conflicts: set[str] = set()
    for assignment in task_assignments:
        resource = resources.get(assignment.resource_id)
        if resource is None:
            conflicts.add(assignment.resource_id)
            continue
        for ordinal in range(start.toordinal(), end.toordinal() + 1):
            day = date.fromordinal(ordinal)
            capacity = resource_capacity_percent(resource, resource_calendars.get(resource.id), day)
            if calendar.is_working_day(day) and usage[(resource.id, day)] + assignment.allocation_percent > capacity:
                conflicts.add(resource.id)
                break
    return conflicts


def _usage_excluding(
    task_id: str,
    tasks: list[PlanningTask],
    assignments: list[PlanningAssignment],
    fixed_task_ids: set[str],
    calendar: CalendarSpec,
) -> dict[tuple[str, date], int]:
    by_task = {task.id: task for task in tasks if task.id in fixed_task_ids and task.id != task_id and task.task_type not in {"summary", "milestone"}}
    usage: dict[tuple[str, date], int] = defaultdict(int)
    for assignment in assignments:
        task = by_task.get(assignment.task_id)
        if not task:
            continue
        for ordinal in range(task.start_at.date().toordinal(), task.end_at.date().toordinal() + 1):
            day = date.fromordinal(ordinal)
            if calendar.is_working_day(day):
                usage[(assignment.resource_id, day)] += assignment.allocation_percent
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


def _reason(code: str, message: str, task: PlanningTask, resource_ids: set[str]) -> LevelingReason:
    return LevelingReason(code, message, (task.id,), tuple(sorted(resource_ids)))


__all__ = [
    "DEFAULT_LEVELING_HORIZON_DAYS",
    "LEVELING_ENGINE_VERSION",
    "LEVELING_STRATEGY",
    "MAX_LEVELING_HORIZON_DAYS",
    "MAX_LEVELING_PASSES",
    "LevelingReason",
    "ResourceLevelingPassResult",
    "level_resource_allocations",
]

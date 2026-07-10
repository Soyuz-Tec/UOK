from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date

from .models import PlanningAssignment, PlanningResource, PlanningTask
from .resource_capacity import DEFAULT_CAPACITY_PERCENT, RESOURCE_CAPACITY_ENGINE_VERSION, ResourceCapacityResult
from .resource_calendar import ResourceCalendarSpec, resource_capacity_percent
from .schedule_math import CalendarSpec


@dataclass(frozen=True)
class ResourceCapacityValidationIssue:
    code: str
    message: str
    object_ids: tuple[str, ...]

    def as_dict(self) -> dict[str, object]:
        return {"code": self.code, "message": self.message, "object_ids": list(self.object_ids)}


def validate_resource_capacity_result(
    tasks: list[PlanningTask],
    resources: list[PlanningResource],
    assignments: list[PlanningAssignment],
    calendar: CalendarSpec,
    result: ResourceCapacityResult,
    resource_calendars: dict[str, ResourceCalendarSpec] | None = None,
) -> list[ResourceCapacityValidationIssue]:
    issues: list[ResourceCapacityValidationIssue] = []
    if result.engine_version != RESOURCE_CAPACITY_ENGINE_VERSION:
        issues.append(_issue("resource_capacity_engine", "Resource capacity engine version is not supported."))
    if result.default_capacity_percent != DEFAULT_CAPACITY_PERCENT:
        issues.append(_issue("resource_default_capacity", "Default resource capacity is inconsistent."))

    expected = _expected_loads(tasks, resources, assignments, calendar, resource_calendars or {})
    actual = {(point.resource_id, point.day): point for point in result.load_points}
    if len(actual) != len(result.load_points):
        issues.append(_issue("resource_load_duplicate", "Resource load result contains duplicate resource dates."))
    missing = sorted(set(expected) - set(actual))
    unexpected = sorted(set(actual) - set(expected))
    if missing:
        issues.append(_issue("resource_load_coverage", "Resource load result omits assigned working dates.", *sorted({item[0] for item in missing})))
    if unexpected:
        issues.append(_issue("resource_load_coverage", "Resource load result contains unassigned dates.", *sorted({item[0] for item in unexpected})))

    for key in sorted(set(expected) & set(actual)):
        allocation, capacity, task_ids = expected[key]
        point = actual[key]
        if point.allocation_percent != allocation or point.task_ids != task_ids:
            issues.append(_issue("resource_load_mismatch", "Resource allocation or contributing task IDs are inconsistent.", point.resource_id, *task_ids))
        if point.capacity_percent != capacity:
            issues.append(_issue("resource_capacity_mismatch", "Resource capacity does not match the effective resource calendar.", point.resource_id))
        if point.overallocated != (point.allocation_percent > point.capacity_percent):
            issues.append(_issue("resource_overallocation_flag", "Resource over-allocation classification is inconsistent.", point.resource_id, *point.task_ids))
        if not calendar.is_working_day(point.day):
            issues.append(_issue("resource_non_working_load", "Resource load was reported on a non-working date.", point.resource_id))
    return _deduplicate(issues)


def _expected_loads(
    tasks: list[PlanningTask],
    resources: list[PlanningResource],
    assignments: list[PlanningAssignment],
    calendar: CalendarSpec,
    resource_calendars: dict[str, ResourceCalendarSpec],
) -> dict[tuple[str, date], tuple[int, int, tuple[str, ...]]]:
    tasks_by_id = {task.id: task for task in tasks if task.task_type != "summary"}
    resources_by_id = {resource.id: resource for resource in resources}
    allocation: dict[tuple[str, date], int] = defaultdict(int)
    contributors: dict[tuple[str, date], set[str]] = defaultdict(set)
    for assignment in assignments:
        task = tasks_by_id.get(assignment.task_id)
        if task is None or assignment.resource_id not in resources_by_id:
            continue
        for ordinal in range(task.start_at.date().toordinal(), task.end_at.date().toordinal() + 1):
            day = date.fromordinal(ordinal)
            if not calendar.is_working_day(day):
                continue
            key = (assignment.resource_id, day)
            allocation[key] += int(assignment.allocation_percent)
            contributors[key].add(task.id)
    return {
        key: (
            value,
            resource_capacity_percent(resources_by_id[key[0]], resource_calendars.get(key[0]), key[1]),
            tuple(sorted(contributors[key])),
        )
        for key, value in allocation.items()
    }


def _issue(code: str, message: str, *object_ids: str) -> ResourceCapacityValidationIssue:
    return ResourceCapacityValidationIssue(code, message, tuple(object_ids))


def _deduplicate(issues: list[ResourceCapacityValidationIssue]) -> list[ResourceCapacityValidationIssue]:
    found: dict[tuple[str, tuple[str, ...]], ResourceCapacityValidationIssue] = {}
    for issue in issues:
        found[(issue.code, issue.object_ids)] = issue
    return list(found.values())


__all__ = ["ResourceCapacityValidationIssue", "validate_resource_capacity_result"]

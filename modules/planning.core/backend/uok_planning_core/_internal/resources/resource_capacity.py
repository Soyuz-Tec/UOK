from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date

from uok_planning_core._internal.persistence.models import PlanningAssignment, PlanningResource, PlanningTask
from uok_planning_core._internal.resources.resource_calendar import ResourceCalendarSpec, resource_capacity_percent
from uok_planning_core._internal.scheduling.schedule_math import CalendarSpec

RESOURCE_CAPACITY_ENGINE_VERSION = "uok-resource-capacity-2"
DEFAULT_CAPACITY_PERCENT = 100


@dataclass(frozen=True)
class ResourceLoadPoint:
    resource_id: str
    day: date
    allocation_percent: int
    capacity_percent: int
    task_ids: tuple[str, ...]
    overallocated: bool

    def as_dict(self) -> dict[str, object]:
        return {
            "resource_id": self.resource_id,
            "date": self.day.isoformat(),
            "allocation_percent": self.allocation_percent,
            "capacity_percent": self.capacity_percent,
            "task_ids": list(self.task_ids),
            "overallocated": self.overallocated,
        }


@dataclass(frozen=True)
class ResourceCapacityResult:
    engine_version: str
    default_capacity_percent: int
    load_points: tuple[ResourceLoadPoint, ...]

    def as_dict(self) -> dict[str, object]:
        return {
            "engine_version": self.engine_version,
            "default_capacity_percent": self.default_capacity_percent,
            "load_points": [point.as_dict() for point in self.load_points],
            "overallocated_count": sum(point.overallocated for point in self.load_points),
        }


def calculate_resource_capacity(
    tasks: list[PlanningTask],
    resources: list[PlanningResource],
    assignments: list[PlanningAssignment],
    calendar: CalendarSpec,
    resource_calendars: dict[str, ResourceCalendarSpec] | None = None,
) -> ResourceCapacityResult:
    active_tasks = {task.id: task for task in tasks if task.task_type != "summary"}
    resources_by_id = {resource.id: resource for resource in resources}
    calendar_by_resource = resource_calendars or {}
    usage: dict[tuple[str, date], int] = defaultdict(int)
    task_ids: dict[tuple[str, date], set[str]] = defaultdict(set)
    for assignment in assignments:
        task = active_tasks.get(assignment.task_id)
        if not task or assignment.resource_id not in resources_by_id:
            continue
        current = task.start_at.date()
        while current <= task.end_at.date():
            if calendar.is_working_day(current):
                key = (assignment.resource_id, current)
                usage[key] += int(assignment.allocation_percent)
                task_ids[key].add(task.id)
            current = date.fromordinal(current.toordinal() + 1)
    points = tuple(
        ResourceLoadPoint(
            resource_id=resource_id,
            day=day,
            allocation_percent=allocation,
            capacity_percent=resource_capacity_percent(resources_by_id[resource_id], calendar_by_resource.get(resource_id), day),
            task_ids=tuple(sorted(task_ids[(resource_id, day)])),
            overallocated=allocation > resource_capacity_percent(resources_by_id[resource_id], calendar_by_resource.get(resource_id), day),
        )
        for (resource_id, day), allocation in sorted(usage.items(), key=lambda item: (item[0][0], item[0][1]))
    )
    return ResourceCapacityResult(RESOURCE_CAPACITY_ENGINE_VERSION, DEFAULT_CAPACITY_PERCENT, points)


def resource_capacity_warnings(result: ResourceCapacityResult, resources: list[PlanningResource]) -> list[str]:
    names = {resource.id: resource.name for resource in resources}
    return [
        f"{names.get(point.resource_id, point.resource_id)} is allocated {point.allocation_percent}% against {point.capacity_percent}% capacity on {point.day.isoformat()}"
        for point in result.load_points
        if point.overallocated
    ]


__all__ = [
    "DEFAULT_CAPACITY_PERCENT",
    "RESOURCE_CAPACITY_ENGINE_VERSION",
    "ResourceCapacityResult",
    "ResourceLoadPoint",
    "calculate_resource_capacity",
    "resource_capacity_warnings",
]

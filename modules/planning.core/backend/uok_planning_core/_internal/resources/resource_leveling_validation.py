from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from uok_planning_core._internal.persistence.models import PlanningAssignment, PlanningResource, PlanningTask, PlanningTaskDependency
from uok_planning_core._internal.resources.resource_calendar import ResourceCalendarSpec
from uok_planning_core._internal.resources.resource_capacity import ResourceCapacityResult
from uok_planning_core._internal.resources.resource_capacity_validation import validate_resource_capacity_result
from uok_planning_core._internal.resources.resource_leveling import MAX_LEVELING_HORIZON_DAYS
from uok_planning_core._internal.scheduling.schedule_math import CalendarSpec
from uok_planning_core._internal.scheduling.scheduler import validate_schedule


@dataclass(frozen=True)
class LevelingValidationIssue:
    code: str
    message: str
    object_ids: tuple[str, ...] = ()

    def as_dict(self) -> dict[str, object]:
        return {"code": self.code, "message": self.message, "object_ids": list(self.object_ids)}


def validate_leveling_result(
    initial_windows: dict[str, tuple[datetime, datetime]],
    tasks: list[PlanningTask],
    dependencies: list[PlanningTaskDependency],
    resources: list[PlanningResource],
    assignments: list[PlanningAssignment],
    calendar: CalendarSpec,
    resource_calendars: dict[str, ResourceCalendarSpec],
    capacity: ResourceCapacityResult,
    result: dict[str, Any],
) -> list[LevelingValidationIssue]:
    issues: list[LevelingValidationIssue] = []
    capacity_issues = validate_resource_capacity_result(tasks, resources, assignments, calendar, capacity, resource_calendars)
    issues.extend(LevelingValidationIssue(item.code, item.message, item.object_ids) for item in capacity_issues)
    violations = validate_schedule(tasks, dependencies, calendar)
    if violations:
        issues.append(_issue("leveling_schedule_violation", "; ".join(violations)))

    actual_changed = sorted(
        task.id for task in tasks
        if initial_windows.get(task.id) != (task.start_at, task.end_at)
    )
    if result.get("changed_task_ids") != actual_changed:
        issues.append(_issue("leveling_changed_task_mismatch", "Reported changed tasks do not match the post-level schedule.", *actual_changed))

    expected_remaining = [point.as_dict() for point in capacity.load_points if point.overallocated]
    if result.get("remaining_overloads") != expected_remaining:
        issues.append(_issue("leveling_remaining_overload_mismatch", "Reported remaining overloads do not match independently calculated capacity."))

    expected_outcome = "leveled" if not expected_remaining else "partially_leveled" if actual_changed else "infeasible"
    if result.get("outcome") != expected_outcome:
        issues.append(_issue("leveling_outcome_mismatch", "The leveling outcome is inconsistent with changed tasks and remaining overloads."))
    if expected_remaining and not result.get("reasons"):
        issues.append(_issue("leveling_reason_missing", "A partial or infeasible result must include actionable reasons."))

    horizon = result.get("horizon_days")
    if isinstance(horizon, bool) or not isinstance(horizon, int) or not 1 <= horizon <= MAX_LEVELING_HORIZON_DAYS:
        issues.append(_issue("leveling_horizon_invalid", "The reported leveling horizon is outside the supported range."))
    return _deduplicate(issues)


def _issue(code: str, message: str, *object_ids: str) -> LevelingValidationIssue:
    return LevelingValidationIssue(code, message, tuple(object_ids))


def _deduplicate(issues: list[LevelingValidationIssue]) -> list[LevelingValidationIssue]:
    unique = {(issue.code, issue.object_ids): issue for issue in issues}
    return list(unique.values())


__all__ = ["LevelingValidationIssue", "validate_leveling_result"]

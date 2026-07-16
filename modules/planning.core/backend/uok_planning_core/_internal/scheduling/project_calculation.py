from __future__ import annotations

from typing import Any

from uok_planning_core._internal.scheduling.cpm import CpmResult
from uok_planning_core._internal.scheduling.cpm_validation import CpmValidationIssue
from uok_planning_core._internal.persistence.models import PlanningProject, PlanningTask, PlanningTaskDependency
from uok_planning_core._internal.scheduling.schedule_math import CalendarSpec
from uok_planning_core._internal.scheduling.scheduler import schedule_analysis


def project_schedule_analysis(
    project: PlanningProject,
    tasks: list[PlanningTask],
    dependencies: list[PlanningTaskDependency],
    calendar: CalendarSpec,
) -> tuple[CpmResult, list[CpmValidationIssue]]:
    result, issues = schedule_analysis(
        tasks, dependencies, calendar, project.start_at.date(), project.target_finish_at.date(),
    )
    if result.calculated_finish != project.calculated_finish_at.date():
        issues.append(CpmValidationIssue(
            code="cpm_persisted_finish_mismatch",
            message="Persisted calculated finish does not match the authoritative CPM result.",
            object_ids=(project.id,),
        ))
    return result, issues


def assert_persisted_finish_current(schedule: dict[str, Any]) -> None:
    issues = schedule["calculation"]["independent_validation"]["violations"]
    if any(issue.get("code") == "cpm_persisted_finish_mismatch" for issue in issues):
        raise ValueError("persisted calculated finish must be repaired by a scheduler mutation before immutable capture")


__all__ = ["assert_persisted_finish_current", "project_schedule_analysis"]

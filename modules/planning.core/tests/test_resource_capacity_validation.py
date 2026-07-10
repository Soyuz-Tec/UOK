from __future__ import annotations

from dataclasses import replace
from datetime import date

from uok.models import PlanningAssignment, PlanningResource, PlanningTask
from uok_planning_core.resource_capacity import calculate_resource_capacity, resource_capacity_warnings
from uok_planning_core.resource_capacity_validation import validate_resource_capacity_result
from uok_planning_core.schedule_math import at_utc, default_calendar


def test_resource_capacity_result_reports_overallocation_and_validates_independently() -> None:
    tasks, resources, assignments = capacity_fixture()

    result = calculate_resource_capacity(tasks, resources, assignments, default_calendar())

    assert result.engine_version == "uok-resource-capacity-1"
    assert len(result.load_points) == 3
    assert all(point.allocation_percent == 120 and point.overallocated for point in result.load_points)
    assert resource_capacity_warnings(result, resources) == [
        f"Planner is allocated 120% on 2026-08-{day:02d}" for day in (3, 4, 5)
    ]
    assert validate_resource_capacity_result(tasks, resources, assignments, default_calendar(), result) == []


def test_independent_resource_validator_rejects_injected_load_and_coverage_faults() -> None:
    tasks, resources, assignments = capacity_fixture()
    result = calculate_resource_capacity(tasks, resources, assignments, default_calendar())
    invalid_point = replace(result.load_points[0], allocation_percent=80)
    tampered = replace(result, load_points=(invalid_point, *result.load_points[2:]))

    issues = validate_resource_capacity_result(tasks, resources, assignments, default_calendar(), tampered)
    codes = {issue.code for issue in issues}

    assert "resource_load_mismatch" in codes
    assert "resource_overallocation_flag" in codes
    assert "resource_load_coverage" in codes
    assert all(issue.object_ids for issue in issues)


def capacity_fixture() -> tuple[list[PlanningTask], list[PlanningResource], list[PlanningAssignment]]:
    task = PlanningTask(
        id="task-1",
        organization_id="org-1",
        project_id="project-1",
        title="Capacity proof",
        task_type="task",
        status="planned",
        start_at=at_utc(date(2026, 8, 3)),
        end_at=at_utc(date(2026, 8, 5)),
        duration_days=3,
        progress=0,
        sort_order=1,
    )
    resource = PlanningResource(
        id="resource-1",
        organization_id="org-1",
        project_id="project-1",
        name="Planner",
        role="Scheduling",
    )
    assignment = PlanningAssignment(
        id="assignment-1",
        organization_id="org-1",
        task_id=task.id,
        resource_id=resource.id,
        allocation_percent=120,
    )
    return [task], [resource], [assignment]

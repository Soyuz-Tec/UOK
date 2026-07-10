from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.db import SessionLocal
from uok.models import (
    PlanningAssignment,
    PlanningCalendar,
    PlanningProject,
    PlanningResource,
    PlanningTask,
    PlanningTaskDependency,
)


def test_database_rejects_invalid_planning_rows_and_duplicates(client: TestClient) -> None:
    context = _planning_context(client)
    now = datetime(2026, 8, 3, tzinfo=timezone.utc)

    _reject(PlanningProject(
        organization_id=context["organization_id"],
        name=f"Invalid dates {uuid4()}",
        start_at=now,
        end_at=datetime(2026, 8, 2, tzinfo=timezone.utc),
    ))
    _reject(_task(context, progress=101))
    _reject(_task(context, task_type="unsupported"))
    _reject(_task(context, end_at=datetime(2026, 8, 2, tzinfo=timezone.utc)))
    _reject(_task(context, duration_days=-1))
    _reject(_task(context, sort_order=-1))

    _reject(_task(context, attrs_json='{"scheduling_mode":"automatic"}'), ValueError)

    _reject(PlanningTaskDependency(
        organization_id=context["organization_id"],
        project_id=context["project_id"],
        predecessor_task_id=context["first_task_id"],
        successor_task_id=context["second_task_id"],
        dependency_type="unsupported",
        lag_days=0,
    ))
    _reject(PlanningTaskDependency(
        organization_id=context["organization_id"],
        project_id=context["project_id"],
        predecessor_task_id=context["first_task_id"],
        successor_task_id=context["second_task_id"],
        dependency_type="finish_to_start",
        lag_days=31,
    ))
    _reject(PlanningTaskDependency(
        organization_id=context["organization_id"],
        project_id=context["project_id"],
        predecessor_task_id=context["first_task_id"],
        successor_task_id=context["first_task_id"],
        dependency_type="finish_to_start",
        lag_days=0,
    ))
    _reject(PlanningAssignment(
        organization_id=context["organization_id"],
        task_id=context["second_task_id"],
        resource_id=context["resource_id"],
        allocation_percent=0,
    ))
    _reject(PlanningAssignment(
        organization_id=context["organization_id"],
        task_id=context["first_task_id"],
        resource_id=context["resource_id"],
        allocation_percent=100,
    ))
    _reject(PlanningCalendar(
        organization_id=context["organization_id"],
        project_id=context["project_id"],
        name="Duplicate",
    ))


def test_database_invariant_migration_is_additive_and_complete() -> None:
    text = (Path(__file__).parents[1] / "migrations" / "004_planning_database_invariants.sql").read_text(encoding="utf-8")
    for constraint in (
        "ck_planning_projects_date_order",
        "ck_planning_tasks_date_order",
        "ck_planning_tasks_duration_nonnegative",
        "ck_planning_tasks_progress_range",
        "ck_planning_tasks_sort_order_nonnegative",
        "ck_planning_tasks_type",
        "ck_planning_tasks_scheduling_mode",
        "ck_planning_dependencies_distinct_tasks",
        "ck_planning_dependencies_type",
        "ck_planning_dependencies_lag_range",
        "ck_planning_assignments_allocation_range",
        "uq_planning_calendars_org_project",
        "uq_planning_assignments_org_task_resource",
    ):
        assert constraint in text
    assert "attrs_json::jsonb" in text
    assert "DROP TABLE" not in text.upper()
    assert "TRUNCATE" not in text.upper()


def _planning_context(client: TestClient) -> dict[str, str]:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    assert client.post("/api/modules/planning.core/install", headers=admin).status_code == 200
    suffix = str(uuid4())[:8]
    project = command(client, ops, "CreatePlanningProject", {
        "name": f"Invariant project {suffix}", "start": "2026-08-03", "end": "2026-08-28",
    }, f"invariant-project-{suffix}")
    project_id = project.json()["result"]["id"]
    first = command(client, ops, "CreatePlanningTask", {
        "project_id": project_id, "title": "First", "start": "2026-08-03", "end": "2026-08-04",
    }, f"invariant-first-{suffix}").json()["result"]["id"]
    second = command(client, ops, "CreatePlanningTask", {
        "project_id": project_id, "title": "Second", "start": "2026-08-05", "end": "2026-08-06",
    }, f"invariant-second-{suffix}").json()["result"]["id"]
    calendar = command(client, ops, "SetPlanningCalendar", {
        "project_id": project_id, "name": "Standard", "working_days": [1, 2, 3, 4, 5],
    }, f"invariant-calendar-{suffix}")
    assert calendar.status_code == 200, calendar.text
    resource = command(client, ops, "CreatePlanningResource", {
        "project_id": project_id, "name": "Planner", "role": "Scheduling",
    }, f"invariant-resource-{suffix}")
    resource_id = resource.json()["result"]["resources"][0]["id"]
    assigned = command(client, ops, "AssignPlanningResource", {
        "task_id": first, "resource_id": resource_id, "allocation_percent": 100,
    }, f"invariant-assignment-{suffix}")
    assert assigned.status_code == 200, assigned.text
    with SessionLocal() as db:
        project_row = db.get(PlanningProject, project_id)
        resource_row = db.get(PlanningResource, resource_id)
        assert project_row is not None and resource_row is not None
        return {
            "organization_id": project_row.organization_id,
            "project_id": project_id,
            "first_task_id": first,
            "second_task_id": second,
            "resource_id": resource_id,
        }


def _task(context: dict[str, str], **overrides: object) -> PlanningTask:
    values = {
        "organization_id": context["organization_id"],
        "project_id": context["project_id"],
        "title": f"Direct task {uuid4()}",
        "task_type": "task",
        "status": "planned",
        "start_at": datetime(2026, 8, 3, tzinfo=timezone.utc),
        "end_at": datetime(2026, 8, 4, tzinfo=timezone.utc),
        "duration_days": 2,
        "progress": 0,
        "sort_order": 10,
        "attrs_json": "{}",
    }
    return PlanningTask(**{**values, **overrides})


def _reject(row: object, error_type: type[Exception] = IntegrityError) -> None:
    with SessionLocal() as db:
        db.add(row)
        with pytest.raises(error_type):
            db.commit()
        db.rollback()

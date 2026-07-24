from __future__ import annotations

from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.host.database import SessionLocal
from uok_planning_core._internal.persistence.models import PlanningResourceCalendar


def test_resource_calendar_controls_capacity_and_baseline(client: TestClient) -> None:
    admin, ops = _setup(client)
    suffix = uuid4().hex[:8]
    project_id = _project(client, ops, suffix)
    task_id = _task(client, ops, project_id, suffix, "Calendar-bound work", "2026-08-03", "2026-08-07")
    resource = command(client, ops, "CreatePlanningResource", {
        "project_id": project_id,
        "name": "Part-time inspector",
        "resource_type": "human",
        "capacity_value": 0.5,
        "capacity_unit": "fte",
        "effective_start": "2026-08-03",
        "effective_end": "2026-08-07",
    }, f"calendar-resource-{suffix}")
    resource_id = resource.json()["result"]["resources"][0]["id"]
    configured = command(client, ops, "SetPlanningResourceCalendar", {
        "project_id": project_id,
        "resource_id": resource_id,
        "name": "Inspector availability",
        "working_days": [1, 2, 3, 4, 5],
        "holidays": ["2026-08-04"],
        "default_capacity_percent": 50,
        "capacity_exceptions": [{
            "start": "2026-08-06", "end": "2026-08-07", "capacity_percent": 100, "reason": "Approved extended coverage",
        }],
    }, f"resource-calendar-{suffix}")
    assert configured.status_code == 200, configured.text
    calendar = configured.json()["result"]["resources"][0]["calendar"]
    assert calendar == {
        "name": "Inspector availability",
        "working_days": [1, 2, 3, 4, 5],
        "holidays": ["2026-08-04"],
        "default_capacity_percent": 50,
        "capacity_exceptions": [{
            "start": "2026-08-06", "end": "2026-08-07", "capacity_percent": 100, "reason": "Approved extended coverage",
        }],
    }
    assigned = command(client, ops, "AssignPlanningResource", {
        "task_id": task_id, "resource_id": resource_id, "allocation_percent": 80,
    }, f"resource-calendar-assignment-{suffix}")
    assert assigned.status_code == 200, assigned.text
    capacity = assigned.json()["result"]["calculation"]["resource_capacity"]
    assert capacity["engine_version"] == "uok-resource-capacity-2"
    assert capacity["independent_validation"] == {"ok": True, "violations": []}
    points = {row["date"]: row for row in capacity["load_points"]}
    assert {day: points[day]["capacity_percent"] for day in points} == {
        "2026-08-03": 50, "2026-08-04": 0, "2026-08-05": 50, "2026-08-06": 100, "2026-08-07": 100,
    }
    assert {day for day, point in points.items() if point["overallocated"]} == {"2026-08-03", "2026-08-04", "2026-08-05"}

    baseline = command(client, ops, "CreatePlanningBaseline", {
        "project_id": project_id, "name": "Resource calendar baseline",
    }, f"resource-calendar-baseline-{suffix}")
    baseline_id = baseline.json()["result"]["baselines"][0]["id"]
    detail = client.get(f"/api/planning/projects/{project_id}/baselines/{baseline_id}", headers=ops)
    snapshot_resource = detail.json()["snapshot"]["resources"][0]
    assert snapshot_resource["calendar"]["holidays"] == ["2026-08-04"]
    assert snapshot_resource["calendar"]["capacity_exceptions"][0]["capacity_percent"] == 100


def test_resource_leveling_respects_resource_holidays(client: TestClient) -> None:
    _, ops = _setup(client)
    suffix = uuid4().hex[:8]
    project_id = _project(client, ops, suffix)
    first = _task(client, ops, project_id, suffix, "First equipment use", "2026-08-03", "2026-08-04")
    second = _task(client, ops, project_id, suffix, "Second equipment use", "2026-08-03", "2026-08-04")
    resource = command(client, ops, "CreatePlanningResource", {
        "project_id": project_id, "name": "Inspection rig", "resource_type": "equipment", "capacity_value": 1, "capacity_unit": "units",
    }, f"level-calendar-resource-{suffix}")
    resource_id = resource.json()["result"]["resources"][0]["id"]
    calendar = command(client, ops, "SetPlanningResourceCalendar", {
        "project_id": project_id, "resource_id": resource_id, "holidays": ["2026-08-04"], "default_capacity_percent": 100,
    }, f"level-calendar-{suffix}")
    assert calendar.status_code == 200, calendar.text
    for index, task_id in enumerate((first, second)):
        assigned = command(client, ops, "AssignPlanningResource", {
            "task_id": task_id, "resource_id": resource_id, "allocation_percent": 100,
        }, f"level-calendar-assignment-{suffix}-{index}")
        assert assigned.status_code == 200, assigned.text
    leveled = command(client, ops, "LevelPlanningResources", {"project_id": project_id}, f"level-calendar-run-{suffix}")
    assert leveled.status_code == 200, leveled.text
    body = leveled.json()["result"]
    assert body["leveling"]["outcome"] == "leveled"
    assert body["leveling"]["remaining_overloads"] == []
    assert body["calculation"]["resource_capacity"]["overallocated_count"] == 0
    assert body["calculation"]["resource_capacity"]["independent_validation"]["ok"] is True
    assert all(point["capacity_percent"] > 0 for point in body["calculation"]["resource_capacity"]["load_points"])
    assert all(task["start"] != "2026-08-04" and task["end"] != "2026-08-04" for task in body["tasks"])


def test_resource_calendar_rejects_overlap_and_database_overcapacity(client: TestClient) -> None:
    _, ops = _setup(client)
    suffix = uuid4().hex[:8]
    project_id = _project(client, ops, suffix)
    resource = command(client, ops, "CreatePlanningResource", {
        "project_id": project_id, "name": "Calendar constraints",
    }, f"calendar-constraint-resource-{suffix}")
    resource_id = resource.json()["result"]["resources"][0]["id"]
    rejected = command(client, ops, "SetPlanningResourceCalendar", {
        "project_id": project_id,
        "resource_id": resource_id,
        "capacity_exceptions": [
            {"start": "2026-08-03", "end": "2026-08-05", "capacity_percent": 50},
            {"start": "2026-08-05", "end": "2026-08-06", "capacity_percent": 100},
        ],
    }, f"calendar-overlap-{suffix}")
    assert rejected.status_code == 400, rejected.text
    assert "cannot overlap" in rejected.text

    configured = command(client, ops, "SetPlanningResourceCalendar", {
        "project_id": project_id, "resource_id": resource_id, "default_capacity_percent": 75,
    }, f"calendar-valid-{suffix}")
    calendar_id = configured.json()["result"]["resources"][0]["calendar"]
    assert calendar_id["default_capacity_percent"] == 75
    with SessionLocal() as db:
        row = db.query(PlanningResourceCalendar).filter_by(resource_id=resource_id).one()
        row.default_capacity_percent = 301
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()

    sql = (Path(__file__).parents[1] / "migrations" / "010_planning_resource_calendars.sql").read_text(encoding="utf-8")
    assert "planning_resource_calendars" in sql
    assert "ck_planning_resource_calendar_capacity_range" in sql
    assert "ix_planning_resource_calendars_org_project_resource" in sql


def _setup(client: TestClient) -> tuple[dict[str, str], dict[str, str]]:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    for module in ("calendar.core", "planning.core"):
        assert client.post(f"/api/modules/{module}/install", headers=admin).status_code == 200
    return admin, ops


def _project(client: TestClient, ops: dict[str, str], suffix: str) -> str:
    response = command(client, ops, "CreatePlanningProject", {
        "name": f"Resource calendars {suffix}", "start": "2026-08-03", "end": "2026-08-31",
    }, f"resource-calendar-project-{suffix}")
    return response.json()["result"]["id"]


def _task(client: TestClient, ops: dict[str, str], project_id: str, suffix: str, title: str, start: str, end: str) -> str:
    response = command(client, ops, "CreatePlanningTask", {
        "project_id": project_id, "title": title, "start": start, "end": end,
    }, f"resource-calendar-task-{suffix}-{title.lower().replace(' ', '-')}")
    assert response.status_code == 200, response.text
    return response.json()["result"]["id"]

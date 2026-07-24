from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command
from test_resource_capacity_validation import capacity_fixture
from uok_planning_core._internal.resources.resource_capacity import calculate_resource_capacity
from uok_planning_core._internal.resources.resource_leveling_validation import validate_leveling_result
from uok_planning_core._internal.scheduling.schedule_math import default_calendar


def test_leveling_reports_partial_outcome_and_manual_reasons(client: TestClient) -> None:
    ops, project_id, suffix = _setup(client, "Partial leveling")
    manual_ids = [
        _task(client, ops, project_id, suffix, f"Manual {index}", "manual")
        for index in (1, 2)
    ]
    auto_ids = [
        _task(client, ops, project_id, suffix, f"Auto {index}", "auto")
        for index in (1, 2)
    ]
    manual_resource = _resource(client, ops, project_id, suffix, "Manual crew")
    auto_resource = _resource(client, ops, project_id, suffix, "Auto crew")
    for index, task_id in enumerate(manual_ids):
        _assign(client, ops, task_id, manual_resource, suffix, f"manual-{index}")
    for index, task_id in enumerate(auto_ids):
        _assign(client, ops, task_id, auto_resource, suffix, f"auto-{index}")

    response = command(client, ops, "LevelPlanningResources", {
        "project_id": project_id,
        "horizon_days": 10,
    }, f"partial-level-run-{suffix}")

    assert response.status_code == 200, response.text
    result = response.json()["result"]
    report = result["leveling"]
    assert report["engine_version"] == "uok-simple-resource-leveling-2"
    assert report["strategy"] == "simple_forward"
    assert report["outcome"] == "partially_leveled"
    assert report["horizon_days"] == 10
    assert report["changed_task_ids"]
    assert set(report["changed_task_ids"]) <= set(auto_ids)
    assert report["remaining_overloads"]
    assert "manual_task_immovable" in {reason["code"] for reason in report["reasons"]}
    assert report["independent_validation"] == {"ok": True, "violations": []}
    assert result["calculation"]["resource_capacity"]["overallocated_count"] == len(report["remaining_overloads"])


def test_leveling_reports_infeasible_horizon_and_capacity_reasons(client: TestClient) -> None:
    ops, project_id, suffix = _setup(client, "Infeasible leveling")
    task_id = _task(client, ops, project_id, suffix, "Oversized assignment", "auto")
    resource_id = _resource(client, ops, project_id, suffix, "Limited crew")
    _assign(client, ops, task_id, resource_id, suffix, "oversized", allocation=150)

    response = command(client, ops, "LevelPlanningResources", {
        "project_id": project_id,
        "horizon_days": 2,
    }, f"infeasible-level-run-{suffix}")

    assert response.status_code == 200, response.text
    report = response.json()["result"]["leveling"]
    assert report["outcome"] == "infeasible"
    assert report["changed_task_ids"] == []
    assert report["remaining_overloads"]
    codes = {reason["code"] for reason in report["reasons"]}
    assert {"allocation_exceeds_capacity", "horizon_exhausted"} <= codes
    assert report["independent_validation"]["ok"] is True

    rejected = command(client, ops, "LevelPlanningResources", {
        "project_id": project_id,
        "horizon_days": 0,
    }, f"invalid-level-run-{suffix}")
    assert rejected.status_code == 400
    assert "horizon_days must be between 1 and 1095" in rejected.text


def test_independent_leveling_validator_detects_hidden_remaining_overload() -> None:
    tasks, resources, assignments = capacity_fixture()
    capacity = calculate_resource_capacity(tasks, resources, assignments, default_calendar())
    report = {
        "outcome": "leveled",
        "horizon_days": 10,
        "changed_task_ids": [],
        "remaining_overloads": [],
        "reasons": [],
    }

    issues = validate_leveling_result(
        {tasks[0].id: (tasks[0].start_at, tasks[0].end_at)},
        tasks,
        [],
        resources,
        assignments,
        default_calendar(),
        {},
        capacity,
        report,
    )

    codes = {issue.code for issue in issues}
    assert "leveling_remaining_overload_mismatch" in codes
    assert "leveling_outcome_mismatch" in codes
    assert "leveling_reason_missing" in codes


def _setup(client: TestClient, name: str) -> tuple[dict[str, str], str, str]:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    for module in ("calendar.core", "planning.core"):
        assert client.post(f"/api/modules/{module}/install", headers=admin).status_code == 200
    project = command(client, ops, "CreatePlanningProject", {
        "name": f"{name} {suffix}",
        "start": "2026-08-03",
        "end": "2026-08-31",
    }, f"explain-level-project-{suffix}")
    return ops, project.json()["result"]["id"], suffix


def _task(client: TestClient, ops: dict[str, str], project_id: str, suffix: str, title: str, mode: str) -> str:
    response = command(client, ops, "CreatePlanningTask", {
        "project_id": project_id,
        "title": title,
        "start": "2026-08-03",
        "end": "2026-08-04",
        "scheduling_mode": mode,
    }, f"explain-level-task-{suffix}-{title.lower().replace(' ', '-')}")
    assert response.status_code == 200, response.text
    return response.json()["result"]["id"]


def _resource(client: TestClient, ops: dict[str, str], project_id: str, suffix: str, name: str) -> str:
    response = command(client, ops, "CreatePlanningResource", {
        "project_id": project_id,
        "name": name,
    }, f"explain-level-resource-{suffix}-{name.lower().replace(' ', '-')}")
    assert response.status_code == 200, response.text
    return next(row["id"] for row in response.json()["result"]["resources"] if row["name"] == name)


def _assign(client: TestClient, ops: dict[str, str], task_id: str, resource_id: str, suffix: str, label: str, allocation: int = 100) -> None:
    response = command(client, ops, "AssignPlanningResource", {
        "task_id": task_id,
        "resource_id": resource_id,
        "allocation_percent": allocation,
    }, f"explain-level-assignment-{suffix}-{label}")
    assert response.status_code == 200, response.text

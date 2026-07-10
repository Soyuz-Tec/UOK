from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command


def test_schedule_api_exposes_negative_target_float_and_independent_validation(client: TestClient) -> None:
    ops = _planning_users(client)
    suffix = uuid4().hex[:8]
    project = command(
        client,
        ops,
        "CreatePlanningProject",
        {"name": f"Target CPM {suffix}", "start": "2026-08-03", "end": "2026-08-05"},
        f"cpm-target-project-{suffix}",
    )
    project_id = project.json()["result"]["id"]
    created = command(
        client,
        ops,
        "CreatePlanningTask",
        {"project_id": project_id, "title": "Delivery", "start": "2026-08-03", "end": "2026-08-07"},
        f"cpm-target-task-{suffix}",
    )
    assert created.status_code == 200, created.text

    response = client.get(f"/api/planning/projects/{project_id}/schedule", headers=ops)
    assert response.status_code == 200, response.text
    schedule = response.json()

    assert schedule["calculation"] == {
        "engine_version": "uok-cpm-1",
        "project_start": "2026-08-03",
        "calculated_finish": "2026-08-07",
        "target_finish": "2026-08-05",
        "target_variance_days": 2,
        "independent_validation": {"ok": True, "violations": []},
    }
    assert schedule["tasks"][0]["total_slack_days"] == -2
    assert schedule["tasks"][0]["free_float_days"] == -2
    assert schedule["tasks"][0]["critical"] is True


def test_cpm_values_do_not_depend_on_ui_sort_order(client: TestClient) -> None:
    ops = _planning_users(client)
    suffix = uuid4().hex[:8]
    project = command(
        client,
        ops,
        "CreatePlanningProject",
        {"name": f"Order CPM {suffix}", "start": "2026-08-03", "end": "2026-08-28"},
        f"cpm-order-project-{suffix}",
    )
    project_id = project.json()["result"]["id"]
    ids = {
        name: _task(client, ops, project_id, suffix, name, end, order)
        for order, (name, end) in enumerate(
            (("start", "2026-08-04"), ("long", "2026-08-06"), ("short", "2026-08-04"), ("merge", "2026-08-03")),
            start=1,
        )
    }
    for predecessor, successor in (("start", "long"), ("start", "short"), ("long", "merge"), ("short", "merge")):
        linked = command(
            client,
            ops,
            "LinkPlanningTasks",
            {"project_id": project_id, "predecessor_task_id": ids[predecessor], "successor_task_id": ids[successor]},
            f"cpm-order-link-{predecessor}-{successor}-{suffix}",
        )
        assert linked.status_code == 200, linked.text

    before = _metric_index(client.get(f"/api/planning/projects/{project_id}/schedule", headers=ops).json())
    reordered = command(
        client,
        ops,
        "UpdatePlanningTask",
        {"task_id": ids["short"], "sort_order": 999},
        f"cpm-order-reorder-{suffix}",
    )
    assert reordered.status_code == 200, reordered.text
    after = _metric_index(client.get(f"/api/planning/projects/{project_id}/schedule", headers=ops).json())

    assert before == after


def _planning_users(client: TestClient) -> dict[str, str]:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    assert client.post("/api/modules/planning.core/install", headers=admin).status_code == 200
    return ops


def _task(client: TestClient, ops: dict[str, str], project_id: str, suffix: str, name: str, end: str, order: int) -> str:
    response = command(
        client,
        ops,
        "CreatePlanningTask",
        {"project_id": project_id, "title": name, "start": "2026-08-03", "end": end, "sort_order": order},
        f"cpm-order-task-{name}-{suffix}",
    )
    assert response.status_code == 200, response.text
    return response.json()["result"]["id"]


def _metric_index(schedule: dict) -> dict[str, tuple]:
    return {
        task["id"]: tuple(task[key] for key in (
            "early_start", "early_finish", "late_start", "late_finish", "total_slack_days", "free_float_days", "critical",
        ))
        for task in schedule["tasks"]
        if task["task_type"] != "summary"
    }

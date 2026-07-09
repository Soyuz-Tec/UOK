from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command


def test_planning_core_schedule_authority_and_security(client: TestClient) -> None:
    suffix = str(uuid4())[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    viewer = auth(client, "viewer", "viewer123")

    install = client.post("/api/modules/planning.core/install", headers=admin)
    assert install.status_code == 200, install.text
    assert install.json()["status"] == "installed"

    denied = command(
        client,
        viewer,
        "CreatePlanningProject",
        {"name": f"Denied Plan {suffix}", "start": "2026-08-01", "end": "2026-08-10"},
        f"planning-denied-{suffix}",
    )
    assert denied.status_code == 403, denied.text

    project = command(
        client,
        ops,
        "CreatePlanningProject",
        {"name": f"Launch Plan {suffix}", "start": "2026-08-01", "end": "2026-08-15"},
        f"planning-project-{suffix}",
    )
    assert project.status_code == 200, project.text
    project_id = project.json()["result"]["id"]

    first = command(
        client,
        ops,
        "CreatePlanningTask",
        {"project_id": project_id, "title": "Foundation", "start": "2026-08-01", "end": "2026-08-03", "progress": 25},
        f"planning-task-a-{suffix}",
    )
    second = command(
        client,
        ops,
        "CreatePlanningTask",
        {"project_id": project_id, "title": "Build", "start": "2026-08-04", "end": "2026-08-08"},
        f"planning-task-b-{suffix}",
    )
    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text

    linked = command(
        client,
        ops,
        "LinkPlanningTasks",
        {
            "project_id": project_id,
            "predecessor_task_id": first.json()["result"]["id"],
            "successor_task_id": second.json()["result"]["id"],
        },
        f"planning-link-{suffix}",
    )
    assert linked.status_code == 200, linked.text
    assert linked.json()["result"]["validation"]["ok"] is True

    rescheduled = command(
        client,
        ops,
        "UpdatePlanningTask",
        {"task_id": second.json()["result"]["id"], "start": "2026-08-05", "end": "2026-08-10"},
        f"planning-reschedule-{suffix}",
    )
    assert rescheduled.status_code == 200, rescheduled.text
    assert rescheduled.json()["result"]["validation"]["ok"] is True

    cycle = command(
        client,
        ops,
        "LinkPlanningTasks",
        {
            "project_id": project_id,
            "predecessor_task_id": second.json()["result"]["id"],
            "successor_task_id": first.json()["result"]["id"],
        },
        f"planning-cycle-{suffix}",
    )
    assert cycle.status_code == 400, cycle.text
    assert "cycle" in cycle.text

    schedule = client.get(f"/api/planning/projects/{project_id}/schedule", headers=viewer)
    assert schedule.status_code == 200, schedule.text
    body = schedule.json()
    assert body["validation"]["ok"] is True
    assert len(body["tasks"]) == 2
    assert len(body["dependencies"]) == 1
    assert any(task["critical"] for task in body["tasks"])


def test_planning_core_gantt_improvements(client: TestClient) -> None:
    suffix = str(uuid4())[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")

    assert client.post("/api/modules/planning.core/install", headers=admin).status_code == 200
    project = command(
        client,
        ops,
        "CreatePlanningProject",
        {"name": f"Improved Plan {suffix}", "start": "2026-08-03", "end": "2026-08-31"},
        f"planning-improved-project-{suffix}",
    )
    assert project.status_code == 200, project.text
    project_id = project.json()["result"]["id"]

    calendar = command(
        client,
        ops,
        "SetPlanningCalendar",
        {"project_id": project_id, "working_days": [1, 2, 3, 4, 5], "holidays": ["2026-08-14"], "ignored_periods": ["2026-08-19..2026-08-20"]},
        f"planning-calendar-{suffix}",
    )
    assert calendar.status_code == 200, calendar.text

    summary = _create_task(client, ops, project_id, suffix, "Delivery", "2026-08-03", "2026-08-20", "summary", 1)
    first = _create_task(client, ops, project_id, suffix, "Design", "2026-08-03", "2026-08-05", "task", 2, summary)
    second = _create_task(client, ops, project_id, suffix, "Build", "2026-08-06", "2026-08-07", "task", 3, summary)
    review = _create_task(client, ops, project_id, suffix, "Review", "2026-08-10", "2026-08-10", "milestone", 4, summary)
    holiday_task = _create_task(client, ops, project_id, suffix, "Holiday start", "2026-08-14", "2026-08-14", "task", 5)
    holiday_schedule = client.get(f"/api/planning/projects/{project_id}/schedule", headers=ops).json()
    holiday_row = {task["id"]: task for task in holiday_schedule["tasks"]}[holiday_task]
    assert holiday_row["start"] == "2026-08-17"
    assert holiday_row["end"] == "2026-08-17"
    ignored_task = _create_task(client, ops, project_id, suffix, "Ignored start", "2026-08-19", "2026-08-19", "task", 6)
    ignored_schedule = client.get(f"/api/planning/projects/{project_id}/schedule", headers=ops).json()
    ignored_row = {task["id"]: task for task in ignored_schedule["tasks"]}[ignored_task]
    assert ignored_row["start"] == "2026-08-21"
    assert ignored_schedule["calendar"]["ignored_periods"] == [{"start": "2026-08-19", "end": "2026-08-20"}]

    linked = command(
        client,
        ops,
        "LinkPlanningTasks",
        {
            "project_id": project_id,
            "predecessor_task_id": first,
            "successor_task_id": second,
            "dependency_type": "finish_to_start",
            "lag_days": 1,
        },
        f"planning-fs-lag-{suffix}",
    )
    assert linked.status_code == 200, linked.text
    tasks = {task["id"]: task for task in linked.json()["result"]["tasks"]}
    assert tasks[second]["start"] == "2026-08-07"

    ss = command(
        client,
        ops,
        "LinkPlanningTasks",
        {
            "project_id": project_id,
            "predecessor_task_id": second,
            "successor_task_id": review,
            "dependency_type": "start_to_start",
            "lag_days": -1,
        },
        f"planning-ss-lead-{suffix}",
    )
    assert ss.status_code == 200, ss.text

    no_cascade = command(
        client,
        ops,
        "UpdatePlanningTask",
        {"task_id": first, "start": "2026-08-12", "end": "2026-08-13", "cascade": False},
        f"planning-no-cascade-{suffix}",
    )
    assert no_cascade.status_code == 400, no_cascade.text
    assert "violates finish_to_start dependency" in no_cascade.text

    moved = command(
        client,
        ops,
        "UpdatePlanningTask",
        {"task_id": first, "start": "2026-08-12", "end": "2026-08-13"},
        f"planning-propagate-{suffix}",
    )
    assert moved.status_code == 200, moved.text
    schedule = client.get(f"/api/planning/projects/{project_id}/schedule", headers=ops).json()
    tasks = {task["id"]: task for task in schedule["tasks"]}
    assert tasks[second]["start"] == "2026-08-18"
    assert tasks[summary]["start"] == "2026-08-12"
    assert tasks[summary]["end"] >= tasks[review]["end"]
    assert tasks[first]["early_start"] == tasks[first]["start"]
    assert any(task["total_slack_days"] == 0 for task in tasks.values())

    rejected = command(
        client,
        ops,
        "UpdatePlanningTask",
        {"task_id": second, "start": "2026-08-13", "end": "2026-08-14"},
        f"planning-invalid-successor-{suffix}",
    )
    assert rejected.status_code == 400, rejected.text

    baseline = command(
        client,
        ops,
        "CreatePlanningBaseline",
        {"project_id": project_id, "name": "Control"},
        f"planning-baseline-{suffix}",
    )
    assert baseline.status_code == 200, baseline.text
    assert baseline.json()["result"]["baselines"][0]["name"] == "Control"

    resource = command(
        client,
        ops,
        "CreatePlanningResource",
        {"project_id": project_id, "name": "Planner", "role": "Scheduling"},
        f"planning-resource-{suffix}",
    )
    resource_id = resource.json()["result"]["resources"][0]["id"]
    assigned = command(
        client,
        ops,
        "AssignPlanningResource",
        {"task_id": first, "resource_id": resource_id, "allocation_percent": 150},
        f"planning-assignment-a-{suffix}",
    )
    assert assigned.status_code == 200, assigned.text
    assigned_again = command(
        client,
        ops,
        "AssignPlanningResource",
        {"task_id": second, "resource_id": resource_id, "allocation_percent": 150},
        f"planning-assignment-b-{suffix}",
    )
    assert assigned_again.status_code == 200, assigned_again.text
    final_schedule = client.get(f"/api/planning/projects/{project_id}/schedule", headers=ops).json()
    assert final_schedule["validation"]["ok"] is True
    assert final_schedule["validation"]["warnings"]
    assert final_schedule["calendar"]["holidays"] == ["2026-08-14"]
    assert final_schedule["calendar"]["ignored_periods"] == [{"start": "2026-08-19", "end": "2026-08-20"}]


def _create_task(
    client: TestClient,
    headers: dict[str, str],
    project_id: str,
    suffix: str,
    title: str,
    start: str,
    end: str,
    task_type: str,
    sort_order: int,
    parent_task_id: str | None = None,
) -> str:
    created = command(
        client,
        headers,
        "CreatePlanningTask",
        {
            "project_id": project_id,
            "title": title,
            "start": start,
            "end": end,
            "task_type": task_type,
            "sort_order": sort_order,
            "parent_task_id": parent_task_id,
        },
        f"planning-task-{title}-{suffix}",
    )
    assert created.status_code == 200, created.text
    return created.json()["result"]["id"]

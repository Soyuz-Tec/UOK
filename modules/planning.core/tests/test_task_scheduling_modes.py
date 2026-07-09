from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command


def test_manual_tasks_are_not_moved_by_dependency_propagation(client: TestClient) -> None:
    suffix = str(uuid4())[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/planning.core/install", headers=admin).status_code == 200
    project = command(client, ops, "CreatePlanningProject", {"name": f"Mode Plan {suffix}", "start": "2026-08-03", "end": "2026-08-20"}, f"mode-project-{suffix}")
    project_id = project.json()["result"]["id"]
    predecessor = _task(client, ops, project_id, suffix, "Foundation", "2026-08-03", "2026-08-05", "auto")
    auto_successor = _task(client, ops, project_id, suffix, "Auto build", "2026-08-06", "2026-08-07", "auto")
    manual_successor = _task(client, ops, project_id, suffix, "Manual build", "2026-08-06", "2026-08-07", "manual")
    auto_link = command(client, ops, "LinkPlanningTasks", {"project_id": project_id, "predecessor_task_id": predecessor, "successor_task_id": auto_successor, "lag_days": 2}, f"mode-auto-link-{suffix}")
    assert auto_link.status_code == 200, auto_link.text
    auto_row = {task["id"]: task for task in auto_link.json()["result"]["tasks"]}[auto_successor]
    assert auto_row["start"] == "2026-08-10"
    assert auto_row["scheduling_mode"] == "auto"
    manual_link = command(client, ops, "LinkPlanningTasks", {"project_id": project_id, "predecessor_task_id": predecessor, "successor_task_id": manual_successor, "lag_days": 2}, f"mode-manual-link-{suffix}")
    assert manual_link.status_code == 400, manual_link.text
    assert "violates finish_to_start dependency" in manual_link.text
    schedule = client.get(f"/api/planning/projects/{project_id}/schedule", headers=ops).json()
    manual_row = {task["id"]: task for task in schedule["tasks"]}[manual_successor]
    assert manual_row["start"] == "2026-08-06"
    assert manual_row["scheduling_mode"] == "manual"


def test_resource_leveling_moves_later_auto_tasks(client: TestClient) -> None:
    suffix = str(uuid4())[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/planning.core/install", headers=admin).status_code == 200
    project = command(client, ops, "CreatePlanningProject", {"name": f"Level Plan {suffix}", "start": "2026-08-03", "end": "2026-08-20"}, f"level-project-{suffix}")
    project_id = project.json()["result"]["id"]
    first = _task(client, ops, project_id, suffix, "First assigned", "2026-08-03", "2026-08-05", "auto")
    second = _task(client, ops, project_id, suffix, "Second assigned", "2026-08-04", "2026-08-06", "auto")
    resource = command(client, ops, "CreatePlanningResource", {"project_id": project_id, "name": "Planner", "role": "Scheduling"}, f"level-resource-{suffix}")
    resource_id = resource.json()["result"]["resources"][0]["id"]
    assert command(client, ops, "AssignPlanningResource", {"task_id": first, "resource_id": resource_id, "allocation_percent": 100}, f"level-first-{suffix}").status_code == 200
    assigned = command(client, ops, "AssignPlanningResource", {"task_id": second, "resource_id": resource_id, "allocation_percent": 100}, f"level-second-{suffix}")
    assert "allocated 200%" in str(assigned.json()["result"]["validation"]["warnings"])
    leveled = command(client, ops, "LevelPlanningResources", {"project_id": project_id}, f"level-run-{suffix}")
    assert leveled.status_code == 200, leveled.text
    tasks = {task["id"]: task for task in leveled.json()["result"]["tasks"]}
    assert tasks[first]["start"] == "2026-08-03"
    assert tasks[second]["start"] == "2026-08-06"
    assert not leveled.json()["result"]["validation"]["warnings"]


def _task(client: TestClient, headers: dict[str, str], project_id: str, suffix: str, title: str, start: str, end: str, mode: str) -> str:
    response = command(client, headers, "CreatePlanningTask", {"project_id": project_id, "title": title, "start": start, "end": end, "scheduling_mode": mode}, f"mode-task-{title}-{suffix}")
    assert response.status_code == 200, response.text
    return response.json()["result"]["id"]

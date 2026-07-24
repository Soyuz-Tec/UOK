from __future__ import annotations

from dataclasses import dataclass

from starlette.testclient import TestClient

from tests.helpers import auth, command


@dataclass(frozen=True)
class BatchFixture:
    project_id: str
    first_task_id: str
    second_task_id: str
    dependency_id: str
    resource_id: str
    assignment_id: str
    link_id: str
    requirement_id: str


def planning_fixture(client: TestClient, ops: dict[str, str], suffix: str) -> BatchFixture:
    project = command(client, ops, "CreatePlanningProject", {
        "name": f"Registry {suffix}", "start": "2026-08-03", "end": "2026-08-28",
    }, f"registry-project-{suffix}")
    project_id = project.json()["result"]["id"]
    first = command(client, ops, "CreatePlanningTask", {
        "project_id": project_id, "title": "First task", "start": "2026-08-03", "end": "2026-08-05",
    }, f"registry-first-{suffix}")
    second = command(client, ops, "CreatePlanningTask", {
        "project_id": project_id, "title": "Second task", "start": "2026-08-06", "end": "2026-08-07",
    }, f"registry-second-{suffix}")
    first_id, second_id = first.json()["result"]["id"], second.json()["result"]["id"]
    dependency = command(client, ops, "LinkPlanningTasks", {
        "project_id": project_id, "predecessor_task_id": first_id, "successor_task_id": second_id,
    }, f"registry-dependency-{suffix}")
    dependency_id = dependency.json()["result"]["dependencies"][0]["id"]
    resource = command(client, ops, "CreatePlanningResource", {
        "project_id": project_id, "name": "Batch resource",
    }, f"registry-resource-{suffix}")
    resource_id = resource.json()["result"]["resources"][0]["id"]
    assignment = command(client, ops, "AssignPlanningResource", {
        "task_id": first_id, "resource_id": resource_id, "allocation_percent": 50,
    }, f"registry-assignment-{suffix}")
    assignment_id = assignment.json()["result"]["assignments"][0]["id"]
    link = command(client, ops, "CreatePlanningLink", {
        "project_id": project_id, "scope_type": "project", "relationship": "implements",
        "target": {"kind": "operation", "id": f"operation-old-{suffix}"},
    }, f"registry-link-{suffix}")
    requirement = command(client, ops, "CreatePlanningTaskRequirement", {
        "task_id": first_id, "requirement_type": "approval", "title": "Batch gate",
    }, f"registry-requirement-{suffix}")
    return BatchFixture(
        project_id, first_id, second_id, dependency_id, resource_id,
        assignment_id, link.json()["result"]["id"], requirement.json()["result"]["id"],
    )


def planning_users(client: TestClient) -> dict[str, str]:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    assert client.post("/api/modules/planning.core/install", headers=admin).status_code == 200
    return ops


def schedule(client: TestClient, headers: dict[str, str], project_id: str):
    response = client.get(f"/api/planning/projects/{project_id}/schedule", headers=headers)
    assert response.status_code == 200, response.text
    return response

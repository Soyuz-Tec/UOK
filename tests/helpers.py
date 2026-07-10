from __future__ import annotations

from starlette.testclient import TestClient
from sqlalchemy import select

from uok.db import SessionLocal
from uok.models import User


def auth(client: TestClient, username: str, password: str) -> dict[str, str]:
    res = client.post("/api/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def command(client: TestClient, headers: dict[str, str], command_type: str, payload: dict, key: str):
    request_headers = dict(headers)
    if command_type.startswith(("CreatePlanning", "UpdatePlanning", "DeletePlanning", "LinkPlanning", "RemovePlanning", "SetPlanning", "AssignPlanning", "LevelPlanning")) and command_type != "CreatePlanningProject":
        project_id = _planning_project_id(client, headers, payload)
        schedule = client.get(f"/api/planning/projects/{project_id}/schedule", headers=headers)
        assert schedule.status_code == 200, schedule.text
        request_headers["If-Match"] = schedule.headers["ETag"]
    return client.post("/api/commands", headers=request_headers, json={
        "command_type": command_type,
        "payload": payload,
        "idempotency_key": key,
    })


def _planning_project_id(client: TestClient, headers: dict[str, str], payload: dict) -> str:
    if payload.get("project_id"):
        return str(payload["project_id"])
    rows = client.get("/api/planning/projects", headers=headers)
    assert rows.status_code == 200, rows.text
    for project in rows.json():
        schedule = client.get(f"/api/planning/projects/{project['id']}/schedule", headers=headers)
        assert schedule.status_code == 200, schedule.text
        body = schedule.json()
        if payload.get("task_id") and any(task["id"] == payload["task_id"] for task in body["tasks"]):
            return str(project["id"])
        if payload.get("dependency_id") and any(dep["id"] == payload["dependency_id"] for dep in body["dependencies"]):
            return str(project["id"])
    raise AssertionError("Planning command payload did not identify a visible project")


def user_id(username: str) -> str:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.username == username))
        assert user is not None
        return user.id

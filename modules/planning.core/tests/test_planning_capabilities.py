from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok_planning_core.commands import command_permissions
from uok_planning_core.policy import PLANNING_CAPABILITY_PERMISSIONS, PLANNING_ROLE_GRANTS


def test_capability_endpoint_returns_server_authority_by_role(client: TestClient) -> None:
    users = _planning_users(client)

    admin = _capabilities(client, users["admin"])
    ops = _capabilities(client, users["ops"])
    trader = _capabilities(client, users["trader"])
    finance = _capabilities(client, users["finance"])
    viewer = _capabilities(client, users["viewer"])

    assert all(admin[name] for name in PLANNING_CAPABILITY_PERMISSIONS)
    assert all(ops[name] for name in PLANNING_CAPABILITY_PERMISSIONS)
    assert ops["review_only"] is False
    assert trader == {
        "read": True,
        "edit": True,
        "baseline_create": False,
        "level": False,
        "link": False,
        "gate_approve": False,
        "admin": False,
        "analyze": False,
        "analysis_approve": False,
        "review_only": False,
    }
    for read_only in (finance, viewer):
        assert read_only["read"] is True
        assert read_only["review_only"] is True
        assert not any(read_only[name] for name in PLANNING_CAPABILITY_PERMISSIONS if name != "read")

    response = client.get("/api/planning/capabilities", headers=users["viewer"])
    assert response.headers["Cache-Control"] == "private, no-store"
    assert response.headers["Vary"] == "Authorization"


def test_direct_api_calls_cannot_bypass_capability_split(client: TestClient) -> None:
    users = _planning_users(client)
    suffix = str(uuid4())[:8]
    project = command(
        client,
        users["ops"],
        "CreatePlanningProject",
        {"name": f"Capability matrix {suffix}", "start": "2026-08-03", "end": "2026-08-28"},
        f"capability-project-{suffix}",
    )
    assert project.status_code == 200, project.text
    project_id = project.json()["result"]["id"]

    trader_schedule = _schedule(client, users["trader"], project_id)
    trader_edit = client.post(
        f"/api/planning/projects/{project_id}/tasks",
        headers={
            **users["trader"],
            "If-Match": trader_schedule.headers["ETag"],
            "Idempotency-Key": f"capability-trader-edit-{suffix}",
        },
        json={"title": "Trader proposed task", "start": "2026-08-03", "end": "2026-08-05"},
    )
    assert trader_edit.status_code == 200, trader_edit.text
    task_id = trader_edit.json()["id"]

    before_denials = _schedule(client, users["trader"], project_id)
    denied_baseline = client.post(
        f"/api/planning/projects/{project_id}/baselines",
        headers={
            **users["trader"],
            "If-Match": before_denials.headers["ETag"],
            "Idempotency-Key": f"capability-trader-baseline-{suffix}",
        },
        json={"name": "Unauthorized control"},
    )
    assert denied_baseline.status_code == 403, denied_baseline.text
    assert "planning.baseline.create" in denied_baseline.text

    denied_level = client.post(
        "/api/commands",
        headers={**users["trader"], "If-Match": before_denials.headers["ETag"]},
        json={
            "command_type": "LevelPlanningResources",
            "payload": {"project_id": project_id},
            "idempotency_key": f"capability-trader-level-{suffix}",
        },
    )
    assert denied_level.status_code == 403, denied_level.text
    assert "planning.level" in denied_level.text

    viewer_schedule = _schedule(client, users["viewer"], project_id)
    denied_update = client.patch(
        f"/api/planning/tasks/{task_id}",
        headers={
            **users["viewer"],
            "If-Match": viewer_schedule.headers["ETag"],
            "Idempotency-Key": f"capability-viewer-update-{suffix}",
        },
        json={"progress": 70},
    )
    assert denied_update.status_code == 403, denied_update.text
    assert "planning.edit" in denied_update.text

    denied_project = client.post(
        "/api/planning/projects",
        headers={**users["finance"], "Idempotency-Key": f"capability-finance-project-{suffix}"},
        json={"name": f"Unauthorized {suffix}", "start": "2026-08-03", "end": "2026-08-04"},
    )
    assert denied_project.status_code == 403, denied_project.text
    assert "planning.edit" in denied_project.text

    after_denials = _schedule(client, users["ops"], project_id)
    assert after_denials.json()["project"]["revision"] == trader_edit.json()["revision"]
    assert after_denials.json()["tasks"][0]["progress"] == 0
    assert after_denials.json()["baselines"] == []


def test_every_planning_command_uses_one_declared_capability() -> None:
    permissions = command_permissions()
    assert permissions["CreatePlanningProject"] == "planning.edit"
    assert permissions["LinkPlanningTasks"] == "planning.edit"
    assert permissions["BatchPlanningOperations"] == "planning.edit"
    assert permissions["CreatePlanningBaseline"] == "planning.baseline.create"
    assert permissions["LevelPlanningResources"] == "planning.level"
    assert permissions["CreatePlanningWhatIfSnapshot"] == "planning.analyze"
    assert set(permissions.values()) <= set(PLANNING_CAPABILITY_PERMISSIONS.values())
    assert "planning.manage" not in permissions.values()
    assert PLANNING_ROLE_GRANTS["trader"] == {"planning.read", "planning.edit"}


def _planning_users(client: TestClient) -> dict[str, dict[str, str]]:
    users = {
        "admin": auth(client, "admin", "admin"),
        "ops": auth(client, "ops", "ops123"),
        "trader": auth(client, "trader", "trader123"),
        "finance": auth(client, "finance", "finance123"),
        "viewer": auth(client, "viewer", "viewer123"),
    }
    assert client.post("/api/modules/calendar.core/install", headers=users["admin"]).status_code == 200
    assert client.post("/api/modules/planning.core/install", headers=users["admin"]).status_code == 200
    return users


def _capabilities(client: TestClient, headers: dict[str, str]) -> dict[str, bool]:
    response = client.get("/api/planning/capabilities", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def _schedule(client: TestClient, headers: dict[str, str], project_id: str):
    response = client.get(f"/api/planning/projects/{project_id}/schedule", headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["capabilities"] == _capabilities(client, headers)
    return response

from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy import select, update
from starlette.testclient import TestClient

import uok.commands as command_gateway
from tests.helpers import auth, command
from uok.host.database import SessionLocal
from uok.host.module_commands import load_module_command_replay_guards
from uok.kernel_models import CommandLog
from uok.module_contract_validation import validate_module_extension_contracts
from uok.module_manifest_loader import load_module_manifests
from uok.util import dumps
from uok_planning_core._internal.persistence.models import PlanningProject, PlanningScheduleRevision
from uok_planning_core._internal.portfolio_audit.replay_visibility import (
    _trusted_result_project_id,
)
from uok_planning_core.public_api import assert_planning_replay_visible


def test_exact_replay_visibility_allows_visible_and_archived_projects(client: TestClient) -> None:
    suffix, ops, project_id = _project(client)
    task_payload = {
        "project_id": project_id,
        "title": "Replay before archive",
        "start": "2026-08-03",
        "end": "2026-08-04",
    }
    task_key = f"replay-visible-task-{suffix}"
    accepted = command(client, ops, "CreatePlanningTask", task_payload, task_key)
    assert accepted.status_code == 200, accepted.text

    visible_replay = command(client, ops, "CreatePlanningTask", task_payload, task_key)
    assert visible_replay.status_code == 200, visible_replay.text
    assert visible_replay.json()["idempotent"] is True
    assert visible_replay.json()["result"] == accepted.json()["result"]
    assert visible_replay.headers["ETag"] == accepted.headers["ETag"]

    archived = command(client, ops, "TransitionPlanningProject", {
        "project_id": project_id,
        "target_status": "archived",
        "reason": "Retain the completed plan",
    }, f"replay-archive-{suffix}")
    assert archived.status_code == 200, archived.text

    archived_replay = command(client, ops, "CreatePlanningTask", task_payload, task_key)
    assert archived_replay.status_code == 200, archived_replay.text
    assert archived_replay.json()["idempotent"] is True
    assert archived_replay.json()["result"] == accepted.json()["result"]
    assert archived_replay.headers["ETag"] == accepted.headers["ETag"]


def test_mismatch_precedes_guard_and_purged_exact_replay_is_non_disclosing(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    suffix, ops, project_id = _project(client)
    payload = {
        "project_id": project_id,
        "title": "Hidden replay",
        "start": "2026-08-03",
        "end": "2026-08-04",
    }
    key = f"replay-purge-task-{suffix}"
    accepted = command(client, ops, "CreatePlanningTask", payload, key)
    assert accepted.status_code == 200, accepted.text
    correlation_id = accepted.json()["command_id"]
    with SessionLocal() as db:
        db.execute(update(PlanningProject).where(PlanningProject.id == project_id).values(status="purged"))
        db.commit()

    def unexpected_guard(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("a mismatched idempotency request must not invoke the replay guard")

    with monkeypatch.context() as patch:
        patch.setattr(command_gateway, "assert_command_replay_visible", unexpected_guard)
        conflict = client.post("/api/commands", headers=ops, json={
            "command_type": "CreatePlanningTask",
            "payload": {**payload, "title": "Different intent"},
            "idempotency_key": key,
        })
    assert conflict.status_code == 409, conflict.text
    assert conflict.json()["error"]["code"] == "idempotency_conflict"
    assert conflict.json()["error"]["correlation_id"] == correlation_id

    hidden = client.post("/api/commands", headers=ops, json={
        "command_type": "CreatePlanningTask",
        "payload": payload,
        "idempotency_key": key,
    })
    assert hidden.status_code == 400, hidden.text
    error = hidden.json()["error"]
    assert error["code"] == "planning_object_not_found"
    assert error["object_ids"] == []
    assert error["correlation_id"] is None
    assert project_id not in hidden.text
    assert correlation_id not in hidden.text


def test_legacy_remove_dependency_replay_uses_trusted_schedule_shape_without_ledger(
    client: TestClient,
) -> None:
    suffix, ops, project_id = _project(client)
    key = f"legacy-remove-dependency-{suffix}"
    command_id = str(uuid4())
    payload = {"dependency_id": f"deleted-dependency-{suffix}"}
    legacy_result = {
        "project": {"id": project_id, "status": "active"},
        "tasks": [],
        "dependencies": [],
    }
    with SessionLocal() as db:
        assert db.scalar(select(PlanningScheduleRevision).where(
            PlanningScheduleRevision.correlation_id == command_id,
        )) is None
        db.add(CommandLog(
            id=command_id,
            organization_id=_organization_id(db, project_id),
            command_type="RemovePlanningDependency",
            idempotency_key=key,
            status="succeeded",
            request_json=dumps(payload),
            response_json=dumps(legacy_result),
        ))
        db.commit()

    replay = client.post("/api/commands", headers=ops, json={
        "command_type": "RemovePlanningDependency",
        "payload": payload,
        "idempotency_key": key,
    })
    assert replay.status_code == 200, replay.text
    assert replay.json() == {"idempotent": True, "status": "succeeded", "result": legacy_result}


@pytest.mark.parametrize(
    ("command_type", "result"),
    [
        ("CreatePlanningProject", {"id": "project-1"}),
        ("CreatePlanningTask", {"project_id": "project-1"}),
        ("UpdatePlanningTask", {"task": {"project_id": "project-1"}}),
        ("RemovePlanningDependency", {"project": {"id": "project-1"}, "dependencies": []}),
        ("BatchPlanningOperations", {"schedule": {"project": {"id": "project-1"}}}),
        ("RunPlanningOptimization", {"optimization": {"project_id": "project-1"}}),
    ],
)
def test_only_documented_legacy_result_shapes_recover_project_identity(
    command_type: str,
    result: dict[str, object],
) -> None:
    assert _trusted_result_project_id(command_type, result) == "project-1"
    assert _trusted_result_project_id(command_type, {"untrusted": result}) == ""


def test_planning_manifest_loads_one_valid_replay_guard_for_every_declared_command() -> None:
    manifest = load_module_manifests()["planning.core"]
    assert manifest["command_replay_guard"] == "uok_planning_core.public_api:assert_planning_replay_visible"
    assert "command_replay_guard" in manifest["extension_points"]

    guards = load_module_command_replay_guards()
    assert set(manifest["commands"]).issubset(guards)
    assert all(guards[command_type] is assert_planning_replay_visible for command_type in manifest["commands"])

    contract = validate_module_extension_contracts()
    assert contract["checks"]["command_replay_guards_valid"] is True
    assert not [row for row in contract["violations"] if row["field"] == "command_replay_guard"]


def _project(client: TestClient) -> tuple[str, dict[str, str], str]:
    suffix = uuid4().hex[:8]
    admin, ops = auth(client, "admin", "admin"), auth(client, "ops", "ops123")
    for module_name in ("calendar.core", "planning.core"):
        installed = client.post(f"/api/modules/{module_name}/install", headers=admin)
        assert installed.status_code == 200, installed.text
    created = command(client, ops, "CreatePlanningProject", {
        "name": f"Replay visibility {suffix}",
        "start": "2026-08-03",
        "end": "2026-08-28",
    }, f"replay-project-{suffix}")
    assert created.status_code == 200, created.text
    return suffix, ops, created.json()["result"]["id"]


def _organization_id(db, project_id: str) -> str:
    organization_id = db.scalar(select(PlanningProject.organization_id).where(PlanningProject.id == project_id))
    assert organization_id
    return str(organization_id)

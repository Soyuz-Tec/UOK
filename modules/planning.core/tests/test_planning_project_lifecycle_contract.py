from __future__ import annotations

import json
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import update
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.command_context import CommandDomainError
from uok.host.application import app
from uok.host.database import SessionLocal
from uok_planning_core._internal.persistence.models import PlanningProject
from uok_planning_core._internal.delivery.commands import command_handlers, command_permissions
from uok_planning_core._internal.scheduling.project_lifecycle import (
    PROJECT_STATUSES,
    PROJECT_STATUS_TRANSITIONS,
    PUBLIC_PROJECT_STATUSES,
    _assert_transition,
)

ALLOWED_PROJECT_STATUS_EDGES = sorted(
    (source, target)
    for source, targets in PROJECT_STATUS_TRANSITIONS.items()
    for target in targets
)


def test_every_project_status_pair_uses_the_controlled_transition_policy() -> None:
    for source in PROJECT_STATUSES:
        project = PlanningProject(id=f"project-{source}", status=source, revision=7)
        for target in (*PROJECT_STATUSES, "unknown"):
            allowed = target in PUBLIC_PROJECT_STATUSES and target != source and target in PROJECT_STATUS_TRANSITIONS[source]
            if allowed:
                _assert_transition(project, target, "command-1")
            else:
                with pytest.raises(CommandDomainError) as rejected:
                    _assert_transition(project, target, "command-1")
                assert rejected.value.code == "planning_project_transition_invalid"
                assert rejected.value.field == "target_status"


def test_transition_command_manifest_permission_and_openapi_are_generated_contracts() -> None:
    assert "TransitionPlanningProject" in command_handlers()
    assert command_permissions()["TransitionPlanningProject"] == "planning.edit"
    manifest = Path("modules/planning.core/manifest.yaml").read_text(encoding="utf-8")
    assert "  - TransitionPlanningProject" in manifest
    assert "  - PlanningProjectTransitioned" in manifest

    generated = json.loads(Path("web/src/generated/openapi.json").read_text(encoding="utf-8"))
    for schema in (app.openapi(), generated):
        operation = schema["paths"]["/api/planning/projects/{project_id}/transitions"]["post"]
        request = schema["components"]["schemas"]["PlanningProjectTransitionRequest"]
        assert operation["requestBody"]["required"] is True
        assert {"target_status", "reason"}.issubset(request["required"])
        assert request["properties"]["target_status"]["enum"] == ["draft", "active", "on_hold", "completed", "archived"]
        assert {"200", "400", "403", "409", "412", "422", "428"}.issubset(operation["responses"])


@pytest.mark.parametrize(("source", "target"), ALLOWED_PROJECT_STATUS_EDGES)
def test_every_allowed_project_status_edge_executes_through_the_guarded_command_api(
    client: TestClient,
    source: str,
    target: str,
) -> None:
    suffix, ops, project_id = _fresh_project(client, f"edge-{source}-{target}")
    _prepare_project_source(client, ops, project_id, source, suffix)
    before = client.get(f"/api/planning/projects/{project_id}/schedule", headers=ops)
    assert before.status_code == 200, before.text
    before_revision = int(before.json()["project"]["revision"])
    payload = {
        "project_id": project_id,
        "target_status": target,
        "reason": f"Exercise {source} to {target}",
    }
    key = f"transition-edge-{source}-{target}-{suffix}"

    accepted = command(client, ops, "TransitionPlanningProject", payload, key)
    assert accepted.status_code == 200, accepted.text
    result = accepted.json()["result"]
    assert result["status"] == target
    assert result["revision"] == before_revision + 1
    assert result["correlation_id"] == accepted.json()["command_id"]

    replay = command(client, ops, "TransitionPlanningProject", payload, key)
    assert replay.status_code == 200, replay.text
    assert replay.json()["idempotent"] is True
    assert replay.json()["result"] == result
    assert replay.headers["ETag"] == accepted.headers["ETag"]


@pytest.mark.parametrize("status", PUBLIC_PROJECT_STATUSES)
def test_every_public_project_status_rejects_same_state_through_the_guarded_command_api(
    client: TestClient,
    status: str,
) -> None:
    suffix, ops, project_id = _fresh_project(client, f"same-{status}")
    _prepare_project_source(client, ops, project_id, status, suffix)
    before = client.get(f"/api/planning/projects/{project_id}/schedule", headers=ops)
    assert before.status_code == 200, before.text
    revision = int(before.json()["project"]["revision"])

    rejected = command(client, ops, "TransitionPlanningProject", {
        "project_id": project_id,
        "target_status": status,
        "reason": "Same state is not a transition",
    }, f"transition-same-{status}-{suffix}")
    assert rejected.status_code == 400, rejected.text
    assert rejected.json()["error"]["code"] == "planning_project_transition_invalid"
    after = client.get(f"/api/planning/projects/{project_id}/schedule", headers=ops)
    assert after.status_code == 200, after.text
    assert after.json()["project"]["revision"] == revision


def test_transition_http_permission_preconditions_etag_and_idempotency(client: TestClient) -> None:
    suffix = uuid4().hex[:8]
    admin, ops, viewer = auth(client, "admin", "admin"), auth(client, "ops", "ops123"), auth(client, "viewer", "viewer123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    assert client.post("/api/modules/planning.core/install", headers=admin).status_code == 200
    created = command(client, ops, "CreatePlanningProject", {
        "name": f"Transition HTTP {suffix}", "start": "2026-08-03", "end": "2026-08-31",
    }, f"transition-http-project-{suffix}")
    project_id = created.json()["result"]["id"]
    schedule = client.get(f"/api/planning/projects/{project_id}/schedule", headers=ops)
    first_etag = schedule.headers["ETag"]
    path = f"/api/planning/projects/{project_id}/transitions"

    denied = client.post(path, headers={
        **viewer, "If-Match": first_etag, "Idempotency-Key": f"transition-viewer-{suffix}",
    }, json={"target_status": "on_hold", "reason": "Viewer cannot edit"})
    missing = client.post(path, headers={
        **ops, "Idempotency-Key": f"transition-missing-{suffix}",
    }, json={"target_status": "on_hold", "reason": "Missing precondition"})
    assert denied.status_code == 403 and denied.json()["error"]["code"] == "permission_denied"
    assert missing.status_code == 428 and missing.json()["error"]["code"] == "precondition_required"

    key = f"transition-success-{suffix}"
    held = client.post(path, headers={**ops, "If-Match": first_etag, "Idempotency-Key": key}, json={
        "target_status": "on_hold", "reason": "External dependency",
    })
    assert held.status_code == 200, held.text
    assert held.headers["ETag"] != first_etag
    stale = client.post(path, headers={
        **ops, "If-Match": first_etag, "Idempotency-Key": f"transition-stale-{suffix}",
    }, json={"target_status": "active", "reason": "Old view"})
    conflict = client.post(path, headers={**ops, "If-Match": held.headers["ETag"], "Idempotency-Key": key}, json={
        "target_status": "completed", "reason": "Changed request",
    })
    assert stale.status_code == 412 and stale.json()["error"]["code"] == "stale_precondition"
    assert conflict.status_code == 409 and conflict.json()["error"]["code"] == "idempotency_conflict"


def _fresh_project(client: TestClient, label: str) -> tuple[str, dict[str, str], str]:
    suffix = uuid4().hex[:8]
    admin, ops = auth(client, "admin", "admin"), auth(client, "ops", "ops123")
    for module_name in ("calendar.core", "planning.core"):
        installed = client.post(f"/api/modules/{module_name}/install", headers=admin)
        assert installed.status_code == 200, installed.text
    created = command(client, ops, "CreatePlanningProject", {
        "name": f"Transition {label} {suffix}",
        "start": "2026-08-03",
        "end": "2026-08-31",
    }, f"transition-project-{label}-{suffix}")
    assert created.status_code == 200, created.text
    return suffix, ops, created.json()["result"]["id"]


def _prepare_project_source(
    client: TestClient,
    ops: dict[str, str],
    project_id: str,
    source: str,
    suffix: str,
) -> None:
    if source == "active":
        return
    if source == "draft":
        # Draft deliberately has no public inbound edge; seed only the fresh
        # row's source state so its two public outbound edges use the real API.
        with SessionLocal() as db:
            db.execute(update(PlanningProject).where(PlanningProject.id == project_id).values(status="draft"))
            db.commit()
        return
    prepared = command(client, ops, "TransitionPlanningProject", {
        "project_id": project_id,
        "target_status": source,
        "reason": f"Prepare fresh {source} source",
    }, f"transition-prepare-{source}-{suffix}")
    assert prepared.status_code == 200, prepared.text
    assert prepared.json()["result"]["status"] == source

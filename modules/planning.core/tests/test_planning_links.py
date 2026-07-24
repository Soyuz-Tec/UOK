from __future__ import annotations

from json import loads
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok_contacts_core.public_api import command_handlers as contact_command_handlers
from uok_planning_core._internal.coordination.link_resolver import serialize_link
from uok.host.database import SessionLocal
from uok.kernel_models import CommandLog, EventRecord, Membership, Organization, User
from uok_planning_core._internal.persistence.models import PlanningLink, PlanningScheduleEvent
from uok.kernel.security import Actor


def test_typed_party_link_resolves_tracks_lifecycle_and_enters_baseline(client: TestClient) -> None:
    admin, ops, viewer = _planning_with_link_providers(client)
    suffix = uuid4().hex[:8]
    party = command(client, ops, "CreateContact", {"display_name": f"Gate B owner {suffix}"}, f"link-party-{suffix}")
    party_id = party.json()["result"]["id"]
    project_id, task_id = _project_and_task(client, ops, suffix)
    before = _schedule(client, ops, project_id)

    created = client.post(
        f"/api/planning/projects/{project_id}/links",
        headers={**ops, "Idempotency-Key": f"planning-link-{suffix}", "If-Match": before.headers["ETag"]},
        json={
            "scope_type": "task",
            "task_id": task_id,
            "relationship": "owned_by",
            "target": {"kind": "party", "id": party_id},
        },
    )
    assert created.status_code == 200, created.text
    body = created.json()
    assert body["revision"] == before.json()["project"]["revision"] + 1
    assert body["target"] == {"kind": "party", "id": party_id, "resolver": "contacts.party", "resolver_version": "1"}
    assert body["resolution"]["status"] == "ready"
    assert body["resolution"]["display_label"] == f"Gate B owner {suffix}"
    assert body["resolution"]["open_path"].endswith(party_id)
    _assert_link_correlation(body["id"], body["correlation_id"], project_id)
    with SessionLocal() as db:
        link = db.get(PlanningLink, body["id"])
        assert link is not None
        hidden = serialize_link(db, Actor("unprivileged", "unprivileged", link.organization_id, "registered_user"), link)
        assert hidden["resolution"]["status"] == "denied"
        assert hidden["target"]["id"] is None
        assert hidden["resolution"]["display_label"] is None

    schedule = _schedule(client, ops, project_id)
    assert schedule.json()["links"][0]["id"] == body["id"]
    baseline = command(client, ops, "CreatePlanningBaseline", {"project_id": project_id, "name": "Linked operation baseline"}, f"link-baseline-{suffix}")
    assert baseline.status_code == 200, baseline.text
    baseline_id = baseline.json()["result"]["baselines"][0]["id"]
    detail = client.get(f"/api/planning/projects/{project_id}/baselines/{baseline_id}", headers=ops)
    assert detail.status_code == 200, detail.text
    assert detail.json()["snapshot"]["links"][0]["target"]["id"] == party_id
    assert detail.json()["integrity"]["verified"] is True

    assert client.post("/api/modules/contacts.core/disable", headers=admin).status_code == 200
    unavailable = _schedule(client, ops, project_id).json()["links"][0]
    assert unavailable["id"] == body["id"]
    assert unavailable["resolution"]["status"] == "unavailable"
    assert unavailable["resolution"]["display_label"] is None
    assert client.post("/api/modules/contacts.core/enable", headers=admin).status_code == 200

    viewer_schedule = _schedule(client, viewer, project_id)
    denied = client.post(
        f"/api/planning/projects/{project_id}/links",
        headers={**viewer, "Idempotency-Key": f"planning-link-denied-{suffix}", "If-Match": viewer_schedule.headers["ETag"]},
        json={"scope_type": "project", "relationship": "owned_by", "target": {"kind": "party", "id": party_id}},
    )
    assert denied.status_code == 403, denied.text
    assert denied.json()["error"]["code"] == "permission_denied"


def test_link_resolver_rejects_missing_or_cross_org_targets_and_keeps_optional_targets_explicit(client: TestClient) -> None:
    _, ops, _ = _planning_with_link_providers(client)
    suffix = uuid4().hex[:8]
    project_id, _ = _project_and_task(client, ops, suffix)
    before = _schedule(client, ops, project_id)
    other_party_id = _cross_org_party(suffix)

    missing = client.post(
        f"/api/planning/projects/{project_id}/links",
        headers={**ops, "Idempotency-Key": f"planning-link-missing-{suffix}", "If-Match": before.headers["ETag"]},
        json={"scope_type": "project", "relationship": "owned_by", "target": {"kind": "party", "id": other_party_id}},
    )
    assert missing.status_code == 400, missing.text
    assert missing.json()["error"]["code"] == "planning_link_target_missing"
    assert _schedule(client, ops, project_id).headers["ETag"] == before.headers["ETag"]

    unavailable = client.post(
        f"/api/planning/projects/{project_id}/links",
        headers={**ops, "Idempotency-Key": f"planning-link-operation-{suffix}", "If-Match": before.headers["ETag"]},
        json={"scope_type": "project", "relationship": "implements", "target": {"kind": "operation", "id": f"operation-{suffix}"}},
    )
    assert unavailable.status_code == 200, unavailable.text
    assert unavailable.json()["resolution"]["status"] == "unavailable"
    assert unavailable.json()["target"]["resolver"] == "operation.provider"


def test_operation_link_migration_and_manifest_are_module_owned() -> None:
    root = Path(__file__).parents[1]
    sql = (root / "migrations" / "005_planning_operation_links.sql").read_text(encoding="utf-8")
    manifest = (root / "manifest.yaml").read_text(encoding="utf-8")
    assert "CREATE TABLE IF NOT EXISTS planning_links" in sql
    assert "UNIQUE NULLS NOT DISTINCT" in sql
    for constraint in ("ck_planning_links_scope", "ck_planning_links_relationship", "ck_planning_links_target_kind", "ck_planning_links_resolution_status"):
        assert constraint in sql
    for value in ("CreatePlanningLink", "RemovePlanningLink", "PlanningLinkCreated", "PlanningLinkRemoved", "PlanningLink"):
        assert value in manifest


def _planning_with_link_providers(client: TestClient) -> tuple[dict[str, str], dict[str, str], dict[str, str]]:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    viewer = auth(client, "viewer", "viewer123")
    for module in ("contacts.core", "reports.core", "calendar.core", "planning.core"):
        response = client.post(f"/api/modules/{module}/install", headers=admin)
        assert response.status_code == 200, response.text
    return admin, ops, viewer


def _project_and_task(client: TestClient, ops: dict[str, str], suffix: str) -> tuple[str, str]:
    project = command(client, ops, "CreatePlanningProject", {"name": f"Links {suffix}", "start": "2026-08-03", "end": "2026-08-28"}, f"links-project-{suffix}")
    project_id = project.json()["result"]["id"]
    task = command(client, ops, "CreatePlanningTask", {"project_id": project_id, "title": "Linked task", "start": "2026-08-03", "end": "2026-08-05"}, f"links-task-{suffix}")
    return project_id, task.json()["result"]["id"]


def _schedule(client: TestClient, headers: dict[str, str], project_id: str):
    response = client.get(f"/api/planning/projects/{project_id}/schedule", headers=headers)
    assert response.status_code == 200, response.text
    return response


def _cross_org_party(suffix: str) -> str:
    with SessionLocal() as db:
        org = Organization(name=f"Other links org {suffix}")
        user = User(
            username=f"cross-org-links-{suffix}",
            password_hash="not-used",
            display_name="Cross-organization link owner",
        )
        db.add_all([org, user])
        db.flush()
        db.add(Membership(organization_id=org.id, user_id=user.id, role="platform_admin"))
        db.flush()
        result = contact_command_handlers()["CreateContact"](
            db,
            Actor(user.id, user.username, org.id, "platform_admin"),
            {"party_type": "person", "display_name": "Hidden other party"},
            f"cross-org-links-{suffix}",
        )
        db.commit()
        return str(result["id"])


def _assert_link_correlation(link_id: str, command_id: str, project_id: str) -> None:
    with SessionLocal() as db:
        log = db.get(CommandLog, command_id)
        module_event = db.scalar(select(EventRecord).where(EventRecord.event_type == "PlanningLinkCreated", EventRecord.object_id == link_id))
        schedule_event = db.scalar(select(PlanningScheduleEvent).where(PlanningScheduleEvent.event_type == "link_created", PlanningScheduleEvent.project_id == project_id))
        link = db.get(PlanningLink, link_id)
        assert log is not None and log.status == "succeeded"
        assert module_event is not None and loads(module_event.payload_json)["correlation_id"] == command_id
        assert schedule_event is not None and loads(schedule_event.payload_json)["correlation_id"] == command_id
        assert link is not None and loads(link.provenance_json)["correlation_id"] == command_id

from __future__ import annotations

from json import loads
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok_contacts_core.public_api import command_handlers as contact_command_handlers
from uok.host.database import SessionLocal
from uok.kernel_models import CommandLog, EventRecord, Membership, Organization, User
from uok_planning_core._internal.persistence.models import PlanningScheduleEvent, PlanningTaskParticipant
from uok.security import Actor
from uok_planning_core._internal.coordination.participant_resolver import serialize_participant


def test_task_participants_resolve_version_filter_and_enter_baseline(client: TestClient) -> None:
    admin, ops, viewer = _planning_with_contacts(client)
    suffix = uuid4().hex[:8]
    owner = command(client, ops, "CreateContact", {"display_name": f"Task owner {suffix}"}, f"participant-party-{suffix}")
    party_id = owner.json()["result"]["id"]
    project_id, task_id = _project_and_task(client, ops, suffix)
    before = _schedule(client, ops, project_id)
    original_task = before.json()["tasks"][0]

    added = client.post(
        f"/api/planning/tasks/{task_id}/participants",
        headers={**ops, "Idempotency-Key": f"participant-add-{suffix}", "If-Match": before.headers["ETag"]},
        json={"party_id": party_id, "role": "owner"},
    )
    assert added.status_code == 200, added.text
    body = added.json()
    assert body["revision"] == before.json()["project"]["revision"] + 1
    assert body["party"] == {"id": party_id, "resolver": "contacts.party", "resolver_version": "1"}
    assert body["resolution"]["status"] == "ready"
    assert body["resolution"]["display_label"] == f"Task owner {suffix}"
    _assert_participant_correlation(body["id"], body["correlation_id"], project_id)

    schedule = _schedule(client, ops, project_id)
    assert schedule.json()["tasks"][0]["version"] == original_task["version"] + 1
    assert schedule.json()["tasks"][0]["participant_ids"] == [party_id]
    assert schedule.json()["tasks"][0]["participant_roles"] == ["owner"]
    assert schedule.json()["participants"][0]["id"] == body["id"]
    duplicate = client.post(
        f"/api/planning/tasks/{task_id}/participants",
        headers={**ops, "Idempotency-Key": f"participant-duplicate-{suffix}", "If-Match": schedule.headers["ETag"]},
        json={"party_id": party_id, "role": "owner"},
    )
    assert duplicate.status_code == 400, duplicate.text
    assert duplicate.json()["error"]["code"] == "planning_participant_duplicate"
    assert _schedule(client, ops, project_id).headers["ETag"] == schedule.headers["ETag"]

    baseline = client.post(
        f"/api/planning/projects/{project_id}/baselines",
        headers={**ops, "Idempotency-Key": f"participant-baseline-{suffix}", "If-Match": schedule.headers["ETag"]},
        json={"name": "Participant baseline"},
    )
    assert baseline.status_code == 200, baseline.text
    baseline_id = baseline.json()["baselines"][0]["id"]
    detail = client.get(f"/api/planning/projects/{project_id}/baselines/{baseline_id}", headers=ops)
    assert detail.status_code == 200, detail.text
    assert detail.json()["snapshot"]["participants"][0]["party"]["id"] == party_id
    assert detail.json()["integrity"]["verified"] is True

    viewer_schedule = _schedule(client, viewer, project_id)
    denied = client.post(
        f"/api/planning/tasks/{task_id}/participants",
        headers={**viewer, "Idempotency-Key": f"participant-viewer-{suffix}", "If-Match": viewer_schedule.headers["ETag"]},
        json={"party_id": party_id, "role": "consulted"},
    )
    assert denied.status_code == 403, denied.text

    assert client.post("/api/modules/contacts.core/disable", headers=admin).status_code == 200
    unavailable = _schedule(client, ops, project_id).json()["participants"][0]
    assert unavailable["id"] == body["id"]
    assert unavailable["resolution"]["status"] == "unavailable"
    assert client.post("/api/modules/contacts.core/enable", headers=admin).status_code == 200

    current = _schedule(client, ops, project_id)
    before_remove_version = current.json()["tasks"][0]["version"]
    removed = client.delete(
        f"/api/planning/tasks/{task_id}/participants/{body['id']}",
        headers={**ops, "Idempotency-Key": f"participant-remove-{suffix}", "If-Match": current.headers["ETag"]},
    )
    assert removed.status_code == 200, removed.text
    assert removed.json()["removed"] is True
    after_remove = _schedule(client, ops, project_id).json()
    assert after_remove["participants"] == []
    assert after_remove["tasks"][0]["version"] == before_remove_version + 1


def test_participants_reject_cross_org_or_unavailable_parties_and_hide_denied_identity(client: TestClient) -> None:
    admin, ops, _ = _planning_with_contacts(client)
    suffix = uuid4().hex[:8]
    project_id, task_id = _project_and_task(client, ops, suffix)
    cross_org_party = _cross_org_party(suffix)
    schedule = _schedule(client, ops, project_id)
    missing = client.post(
        f"/api/planning/tasks/{task_id}/participants",
        headers={**ops, "Idempotency-Key": f"participant-missing-{suffix}", "If-Match": schedule.headers["ETag"]},
        json={"party_id": cross_org_party, "role": "assignee"},
    )
    assert missing.status_code == 400, missing.text
    assert missing.json()["error"]["code"] == "planning_participant_party_missing"
    assert _schedule(client, ops, project_id).headers["ETag"] == schedule.headers["ETag"]

    assert client.post("/api/modules/contacts.core/disable", headers=admin).status_code == 200
    disabled_schedule = _schedule(client, ops, project_id)
    unavailable = client.post(
        f"/api/planning/tasks/{task_id}/participants",
        headers={**ops, "Idempotency-Key": f"participant-unavailable-{suffix}", "If-Match": disabled_schedule.headers["ETag"]},
        json={"party_id": cross_org_party, "role": "assignee"},
    )
    assert unavailable.status_code == 400, unavailable.text
    assert unavailable.json()["error"]["code"] == "planning_participant_party_unavailable"
    assert client.post("/api/modules/contacts.core/enable", headers=admin).status_code == 200

    party = command(client, ops, "CreateContact", {"display_name": f"Hidden participant {suffix}"}, f"participant-hidden-{suffix}")
    party_id = party.json()["result"]["id"]
    current = _schedule(client, ops, project_id)
    added = client.post(
        f"/api/planning/tasks/{task_id}/participants",
        headers={**ops, "Idempotency-Key": f"participant-hidden-add-{suffix}", "If-Match": current.headers["ETag"]},
        json={"party_id": party_id, "role": "informed"},
    )
    assert added.status_code == 200, added.text
    with SessionLocal() as db:
        participant = db.get(PlanningTaskParticipant, added.json()["id"])
        assert participant is not None
        hidden = serialize_participant(db, Actor("unprivileged", "unprivileged", participant.organization_id, "registered_user"), participant)
        assert hidden["resolution"]["status"] == "denied"
        assert hidden["party"]["id"] is None
        assert hidden["resolution"]["display_label"] is None


def test_participant_migration_and_manifest_are_module_owned() -> None:
    root = Path(__file__).parents[1]
    sql = (root / "migrations" / "007_planning_task_participants.sql").read_text(encoding="utf-8")
    manifest = (root / "manifest.yaml").read_text(encoding="utf-8")
    assert "CREATE TABLE IF NOT EXISTS planning_task_participants" in sql
    for constraint in ("uq_planning_task_participant_role", "ck_planning_task_participant_role", "ck_planning_task_participant_source"):
        assert constraint in sql
    for value in ("AddPlanningTaskParticipant", "RemovePlanningTaskParticipant", "PlanningTaskParticipantAdded", "PlanningTaskParticipantRemoved", "PlanningTaskParticipant"):
        assert value in manifest


def _planning_with_contacts(client: TestClient) -> tuple[dict[str, str], dict[str, str], dict[str, str]]:
    admin = auth(client, "admin", "admin")
    for module in ("contacts.core", "calendar.core", "planning.core"):
        response = client.post(f"/api/modules/{module}/install", headers=admin)
        assert response.status_code == 200, response.text
    return admin, auth(client, "ops", "ops123"), auth(client, "viewer", "viewer123")


def _project_and_task(client: TestClient, ops: dict[str, str], suffix: str) -> tuple[str, str]:
    project = command(client, ops, "CreatePlanningProject", {"name": f"Participants {suffix}", "start": "2026-08-03", "end": "2026-08-28"}, f"participant-project-{suffix}")
    project_id = project.json()["result"]["id"]
    task = command(client, ops, "CreatePlanningTask", {"project_id": project_id, "title": "Participant task", "start": "2026-08-03", "end": "2026-08-05"}, f"participant-task-{suffix}")
    return project_id, task.json()["result"]["id"]


def _schedule(client: TestClient, headers: dict[str, str], project_id: str):
    response = client.get(f"/api/planning/projects/{project_id}/schedule", headers=headers)
    assert response.status_code == 200, response.text
    return response


def _cross_org_party(suffix: str) -> str:
    with SessionLocal() as db:
        org = Organization(name=f"Other participant org {suffix}")
        user = User(
            username=f"cross-org-participant-{suffix}",
            password_hash="not-used",
            display_name="Cross-organization participant owner",
        )
        db.add_all([org, user])
        db.flush()
        db.add(Membership(organization_id=org.id, user_id=user.id, role="platform_admin"))
        db.flush()
        result = contact_command_handlers()["CreateContact"](
            db,
            Actor(user.id, user.username, org.id, "platform_admin"),
            {"party_type": "person", "display_name": "Other organization participant"},
            f"cross-org-participant-{suffix}",
        )
        db.commit()
        return str(result["id"])


def _assert_participant_correlation(participant_id: str, command_id: str, project_id: str) -> None:
    with SessionLocal() as db:
        log = db.get(CommandLog, command_id)
        module_event = db.scalar(select(EventRecord).where(EventRecord.event_type == "PlanningTaskParticipantAdded", EventRecord.object_id == participant_id))
        schedule_event = db.scalar(select(PlanningScheduleEvent).where(PlanningScheduleEvent.event_type == "task_participant_added", PlanningScheduleEvent.project_id == project_id))
        assert log is not None and log.status == "succeeded"
        assert module_event is not None and loads(module_event.payload_json)["correlation_id"] == command_id
        assert schedule_event is not None and loads(schedule_event.payload_json)["correlation_id"] == command_id

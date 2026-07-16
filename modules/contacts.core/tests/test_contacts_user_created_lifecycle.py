from __future__ import annotations

from uuid import uuid4

from sqlalchemy import select
from starlette.testclient import TestClient

from uok.db import SessionLocal
from uok.models import EventRecord
from uok.util import loads
from tests.helpers import auth, command, user_id


def _install(client: TestClient) -> tuple[dict[str, str], dict[str, str]]:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    trader = auth(client, "trader", "trader123")
    installed = client.post("/api/modules/contacts.core/install", headers=admin)
    assert installed.status_code == 200, installed.text
    return ops, trader


def test_contact_team_delete_restore_is_recoverable_and_concurrency_safe(client: TestClient) -> None:
    suffix = str(uuid4())
    ops, trader = _install(client)
    created = command(
        client,
        ops,
        "CreateContactTeam",
        {"name": f"Lifecycle team {suffix}", "description": "Initial"},
        f"lifecycle-team-{suffix}",
    )
    assert created.status_code == 200, created.text
    team_id = created.json()["result"]["id"]
    added = command(
        client,
        ops,
        "AddContactTeamMember",
        {"team_id": team_id, "user_id": user_id("trader"), "role": "member"},
        f"lifecycle-team-member-{suffix}",
    )
    assert added.status_code == 200, added.text

    listed = client.get("/api/contacts/teams?include_archived=true", headers=ops)
    assert listed.status_code == 200, listed.text
    assert listed.headers["Cache-Control"] == "private, no-store"
    assert listed.headers["Vary"] == "Authorization"
    snapshot = next(row for row in listed.json() if row["id"] == team_id)
    assert snapshot["can_delete"] is True
    assert snapshot["can_restore"] is False
    viewer_row = next(row for row in client.get("/api/contacts/teams", headers=trader).json() if row["id"] == team_id)
    assert viewer_row["can_delete"] is False
    assert viewer_row["can_restore"] is False

    missing = client.request(
        "DELETE",
        f"/api/contacts/teams/{team_id}",
        headers=ops,
        json={"reason": "Team retired"},
    )
    assert missing.status_code == 428, missing.text
    assert missing.json()["detail"]["code"] == "contact_team_precondition_required"

    changed = client.patch(
        f"/api/contacts/teams/{team_id}",
        headers=ops,
        json={"name": snapshot["name"], "description": "Changed after confirmation opened"},
    )
    assert changed.status_code == 200, changed.text
    stale = client.request(
        "DELETE",
        f"/api/contacts/teams/{team_id}",
        headers={**ops, "If-Match": snapshot["etag"]},
        json={"reason": "Team retired"},
    )
    assert stale.status_code == 412, stale.text
    assert stale.json()["detail"]["code"] == "contact_team_precondition_stale"
    assert stale.json()["detail"]["current_etag"] == stale.headers["ETag"]

    refreshed = client.get("/api/contacts/teams?include_archived=true", headers=ops).json()
    current = next(row for row in refreshed if row["id"] == team_id)
    deleted = client.request(
        "DELETE",
        f"/api/contacts/teams/{team_id}",
        headers={**ops, "If-Match": current["etag"]},
        json={"reason": "Team retired"},
    )
    assert deleted.status_code == 200, deleted.text
    archived = deleted.json()
    assert archived["status"] == "archived"
    assert archived["can_restore"] is True
    assert _event_payload("ContactTeamDeleted", team_id)["reason"] == "Team retired"
    assert {member["user_id"] for member in archived["members"]} >= {user_id("trader")}
    assert team_id not in {row["id"] for row in client.get("/api/contacts/teams", headers=ops).json()}

    restored = client.post(
        f"/api/contacts/teams/{team_id}/restore",
        headers={**ops, "If-Match": archived["etag"]},
    )
    assert restored.status_code == 200, restored.text
    assert restored.json()["status"] == "active"
    assert {member["user_id"] for member in restored.json()["members"]} >= {user_id("trader")}


def test_custom_field_delete_hides_editor_but_preserves_values_for_restore(client: TestClient) -> None:
    suffix = str(uuid4()).replace("-", "_")
    ops, trader = _install(client)
    created_contact = command(
        client,
        ops,
        "CreateContact",
        {"display_name": f"Custom lifecycle contact {suffix}"},
        f"custom-lifecycle-contact-{suffix}",
    )
    assert created_contact.status_code == 200, created_contact.text
    party_id = created_contact.json()["result"]["contact_id"]
    field_key = f"lifecycle_{suffix}"
    defined = client.post(
        "/api/contacts/custom-fields",
        headers=ops,
        json={"field_key": field_key, "label": "Lifecycle field", "field_type": "text"},
    )
    assert defined.status_code == 200, defined.text
    definition = defined.json()
    saved = client.put(
        f"/api/contacts/{party_id}/custom-fields/{definition['id']}",
        headers=ops,
        json={"value": "preserve me"},
    )
    assert saved.status_code == 200, saved.text

    changed = client.post(
        "/api/contacts/custom-fields",
        headers=ops,
        json={"field_key": field_key, "label": "Latest lifecycle field", "field_type": "text"},
    )
    assert changed.status_code == 200, changed.text
    stale = client.request(
        "DELETE",
        f"/api/contacts/custom-fields/{definition['id']}",
        headers={**ops, "If-Match": definition["etag"]},
        json={"reason": "Field is no longer used"},
    )
    assert stale.status_code == 412, stale.text
    assert stale.json()["detail"]["code"] == "contact_custom_field_precondition_stale"

    listed = client.get("/api/contacts/custom-fields?include_archived=true", headers=ops)
    assert listed.status_code == 200, listed.text
    assert listed.headers["Cache-Control"] == "private, no-store"
    assert listed.headers["Vary"] == "Authorization"
    current = next(row for row in listed.json() if row["id"] == definition["id"])
    deleted = client.request(
        "DELETE",
        f"/api/contacts/custom-fields/{definition['id']}",
        headers={**ops, "If-Match": current["etag"]},
        json={"reason": "Field is no longer used"},
    )
    assert deleted.status_code == 200, deleted.text
    archived = deleted.json()
    assert archived["status"] == "archived"
    assert archived["can_restore"] is True
    assert _event_payload("ContactCustomFieldDeleted", definition["id"])["reason"] == "Field is no longer used"
    assert definition["id"] not in {row["id"] for row in client.get("/api/contacts/custom-fields", headers=ops).json()}
    assert client.get(f"/api/contacts/{party_id}/custom-fields", headers=ops).json() == []

    viewer_row = next(
        row for row in client.get("/api/contacts/custom-fields?include_archived=true", headers=trader).json()
        if row["id"] == definition["id"]
    )
    assert viewer_row["can_delete"] is False
    assert viewer_row["can_restore"] is False
    redefine = client.post(
        "/api/contacts/custom-fields",
        headers=ops,
        json={"field_key": field_key, "label": "Bypass restore", "field_type": "text"},
    )
    assert redefine.status_code == 400, redefine.text
    assert "RestoreContactCustomField" in redefine.text

    restored = client.post(
        f"/api/contacts/custom-fields/{definition['id']}/restore",
        headers={**ops, "If-Match": archived["etag"]},
    )
    assert restored.status_code == 200, restored.text
    values = client.get(f"/api/contacts/{party_id}/custom-fields", headers=ops)
    assert values.status_code == 200, values.text
    assert values.json()[0]["value"] == "preserve me"


def _event_payload(event_type: str, object_id: str) -> dict[str, object]:
    with SessionLocal() as db:
        event = db.scalar(select(EventRecord).where(
            EventRecord.event_type == event_type,
            EventRecord.object_id == object_id,
        ).order_by(EventRecord.sequence.desc()))
        assert event is not None
        return loads(event.payload_json, {})

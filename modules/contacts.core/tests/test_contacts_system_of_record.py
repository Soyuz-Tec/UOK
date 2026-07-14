from __future__ import annotations

from uuid import uuid4

from sqlalchemy import func, select
from starlette.testclient import TestClient

from tests.helpers import auth, command, user_id
from uok.db import SessionLocal
from uok.models import EventRecord
from uok.util import loads
from uok_contacts_core.models import (
    ContactConsentRecord,
    ContactExternalIdentity,
    ContactGroupMember,
    Party,
    PartyFact,
    PartyNote,
    PartyRelationship,
)


def _install(client: TestClient) -> tuple[dict[str, str], dict[str, str], dict[str, str], dict[str, str]]:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    trader = auth(client, "trader", "trader123")
    viewer = auth(client, "viewer", "viewer123")
    installed = client.post("/api/modules/contacts.core/install", headers=admin)
    assert installed.status_code == 200, installed.text
    return admin, ops, trader, viewer


def test_first_class_facts_consent_and_team_membership_are_authoritative(client: TestClient) -> None:
    suffix = str(uuid4())
    _, ops, trader, viewer = _install(client)
    team = command(client, ops, "CreateContactTeam", {"name": f"Trade Desk {suffix}"}, f"team-{suffix}")
    assert team.status_code == 200, team.text
    team_id = team.json()["result"]["id"]
    member = command(
        client,
        ops,
        "AddContactTeamMember",
        {"team_id": team_id, "user_id": user_id("trader"), "role": "member"},
        f"team-member-{suffix}",
    )
    assert member.status_code == 200, member.text

    created = command(
        client,
        ops,
        "CreateContact",
        {
            "display_name": f"Team Visible {suffix}",
            "email": f"primary-{suffix}@example.test",
            "team_id": team_id,
            "visibility_scope": "team",
        },
        f"contact-{suffix}",
    )
    assert created.status_code == 200, created.text
    party_id = created.json()["result"]["contact_id"]
    assert client.get(f"/api/contacts/{party_id}", headers=trader).status_code == 200
    assert client.get(f"/api/contacts/{party_id}", headers=viewer).status_code == 403

    second_email = client.post(
        f"/api/contacts/{party_id}/facts",
        headers=ops,
        json={
            "fact_type": "email",
            "label": "personal",
            "value": f"personal-{suffix}@example.test",
            "is_primary": True,
            "is_verified": True,
            "source": "verified_by_owner",
            "confidence": "high",
        },
    )
    assert second_email.status_code == 200, second_email.text
    facts = client.get(f"/api/contacts/{party_id}/facts", headers=trader)
    assert facts.status_code == 200, facts.text
    emails = [row for row in facts.json() if row["fact_type"] == "email"]
    assert len(emails) == 2
    assert sum(bool(row["is_primary"]) for row in emails) == 1
    assert next(row for row in emails if row["is_primary"])["normalized_value"] == f"personal-{suffix}@example.test"

    email_denied = client.post(
        f"/api/contacts/{party_id}/consents",
        headers=ops,
        json={
            "purpose": "directory_export",
            "channel": "email",
            "status": "denied",
            "legal_basis": "objection",
            "allowed_use": "internal_view_only",
        },
    )
    assert email_denied.status_code == 200, email_denied.text
    redacted = client.get(f"/api/contacts/export.csv?party_id={party_id}", headers=ops)
    assert redacted.status_code == 200, redacted.text
    assert redacted.headers["x-consent-restricted-count"] == "1"
    assert f"Team Visible {suffix}" in redacted.text
    assert f"primary-{suffix}@example.test" not in redacted.text
    assert f"personal-{suffix}@example.test" not in redacted.text
    redacted_vcard = client.get(f"/api/contacts/export.vcf?party_id={party_id}", headers=ops)
    assert f"FN:Team Visible {suffix}" in redacted_vcard.text
    assert "EMAIL" not in redacted_vcard.text

    denied = client.post(
        f"/api/contacts/{party_id}/consents",
        headers=ops,
        json={
            "purpose": "directory_export",
            "channel": "any",
            "status": "denied",
            "legal_basis": "objection",
            "allowed_use": "internal_view_only",
            "evidence": {"ticket": f"privacy-{suffix}"},
        },
    )
    assert denied.status_code == 200, denied.text
    consents = client.get(f"/api/contacts/{party_id}/consents", headers=ops)
    assert consents.status_code == 200, consents.text
    assert consents.json()[0]["status"] == "denied"
    exported = client.get(f"/api/contacts/export.csv?party_id={party_id}", headers=ops)
    assert exported.status_code == 200, exported.text
    assert exported.headers["x-consent-restricted-count"] == "1"
    assert f"personal-{suffix}@example.test" not in exported.text


def test_guided_import_saved_views_dedupe_activity_and_vcard_round_trip(client: TestClient) -> None:
    suffix = str(uuid4())
    _, ops, _, _ = _install(client)
    email = f"guided-{suffix}@example.test"
    csv_text = f"Full Name,Mail\nGuided Contact {suffix},{email}\n"
    preview = client.post(
        "/api/contacts/import-csv",
        headers=ops,
        json={
            "filename": "guided.csv",
            "csv_text": csv_text,
            "dry_run": True,
            "mode": "upsert",
            "mapping": {"display_name": "Full Name", "email": "Mail"},
        },
    )
    assert preview.status_code == 200, preview.text
    assert preview.json()["validated_count"] == 1
    preview_rows = client.get(f"/api/contacts/import-batches/{preview.json()['batch_id']}/rows", headers=ops)
    assert preview_rows.status_code == 200, preview_rows.text
    assert preview_rows.json()[0]["status"] == "validated"

    executed = client.post(
        "/api/contacts/import-csv",
        headers=ops,
        json={
            "filename": "guided.csv",
            "csv_text": csv_text,
            "mode": "upsert",
            "mapping": {"display_name": "Full Name", "email": "Mail"},
        },
    )
    assert executed.status_code == 200, executed.text
    assert executed.json()["imported_count"] == 1
    party_id = executed.json()["imported"][0]["party_id"]
    repeated = client.post(
        "/api/contacts/import-csv",
        headers=ops,
        json={
            "filename": "guided.csv",
            "csv_text": csv_text,
            "mode": "upsert",
            "mapping": {"display_name": "Full Name", "email": "Mail"},
        },
    )
    assert repeated.status_code == 200, repeated.text
    assert repeated.json()["imported_count"] == 0
    assert repeated.json()["skipped_count"] == 1

    saved = client.post(
        "/api/contacts/saved-views",
        headers=ops,
        json={"name": f"Needs review {suffix}", "is_pinned": True, "query": {"review_state": "needs_review", "sort_by": "updated_at"}},
    )
    assert saved.status_code == 200, saved.text
    views = client.get("/api/contacts/saved-views", headers=ops)
    assert any(row["id"] == saved.json()["id"] for row in views.json())

    duplicate = command(
        client,
        ops,
        "CreateContact",
        {"display_name": f"Duplicate {suffix}", "email": email},
        f"duplicate-{suffix}",
    )
    assert duplicate.status_code == 200, duplicate.text
    refreshed = client.post("/api/contacts/duplicate-candidates/refresh", headers=ops)
    assert refreshed.status_code == 200, refreshed.text
    assert refreshed.json()["candidate_count"] >= 1
    candidates = client.get("/api/contacts/duplicate-candidates", headers=ops)
    assert candidates.status_code == 200, candidates.text
    assert any(party_id in {row["left_party_id"], row["right_party_id"]} for row in candidates.json())

    activity = client.get(f"/api/contacts/{party_id}/activity", headers=ops)
    assert activity.status_code == 200, activity.text
    assert int(activity.headers["x-total-count"]) >= 1

    vcard = client.get(f"/api/contacts/export.vcf?party_id={party_id}", headers=ops)
    assert vcard.status_code == 200, vcard.text
    assert "BEGIN:VCARD" in vcard.text
    imported_vcard = client.post("/api/contacts/import-vcard", headers=ops, json={"vcard_text": vcard.text, "dry_run": True})
    assert imported_vcard.status_code == 200, imported_vcard.text
    assert imported_vcard.json()["validated_count"] == 1

    rolled_back = client.post(f"/api/contacts/import-batches/{executed.json()['batch_id']}/rollback", headers=ops)
    assert rolled_back.status_code == 200, rolled_back.text
    assert rolled_back.json()["rolled_back_count"] == 1
    archived = client.get(f"/api/contacts/{party_id}", headers=ops)
    assert archived.status_code == 200, archived.text
    assert archived.json()["status"] == "archived"


def test_purge_anonymizes_contact_owned_pii_and_audit_payloads(client: TestClient) -> None:
    suffix = str(uuid4())
    admin, ops, _, _ = _install(client)
    created = command(
        client,
        ops,
        "CreateContact",
        {
            "display_name": f"Erase Me {suffix}",
            "email": f"erase-{suffix}@example.test",
            "phone": "+1 202 555 0101",
            "note": f"Sensitive note {suffix}",
        },
        f"purge-create-{suffix}",
    )
    assert created.status_code == 200, created.text
    party_id = created.json()["result"]["contact_id"]
    consent = client.post(
        f"/api/contacts/{party_id}/consents",
        headers=ops,
        json={"purpose": "all", "channel": "any", "status": "revoked", "evidence": {"email": f"erase-{suffix}@example.test"}},
    )
    assert consent.status_code == 200, consent.text
    identity = client.post(
        f"/api/contacts/{party_id}/external-identities",
        headers=ops,
        json={"provider": "vcard", "external_id": f"external-{suffix}", "attributes": {"email": f"erase-{suffix}@example.test"}},
    )
    assert identity.status_code == 200, identity.text

    purged = command(client, admin, "PurgeContact", {"party_id": party_id}, f"purge-{suffix}")
    assert purged.status_code == 200, purged.text
    assert purged.json()["result"] == {"party_id": party_id, "status": "purged", "tombstone": True}

    with SessionLocal() as db:
        party = db.get(Party, party_id)
        assert party is not None
        assert party.status == "purged"
        assert loads(party.attrs_json, {}) == {"purged": True}
        assert "Erase Me" not in party.display_name
        assert db.scalar(select(func.count(PartyFact.id)).where(PartyFact.party_id == party_id)) == 0
        assert db.scalar(select(func.count(ContactConsentRecord.id)).where(ContactConsentRecord.party_id == party_id)) == 0
        assert db.scalar(select(func.count(PartyNote.id)).where(PartyNote.party_id == party_id)) == 0
        assert db.scalar(select(func.count(PartyRelationship.id)).where((PartyRelationship.from_party_id == party_id) | (PartyRelationship.to_party_id == party_id))) == 0
        assert db.scalar(select(func.count(ContactGroupMember.id)).where(ContactGroupMember.party_id == party_id)) == 0
        assert db.scalar(select(func.count(ContactExternalIdentity.id)).where(ContactExternalIdentity.party_id == party_id)) == 0
        events = db.scalars(select(EventRecord).where(EventRecord.organization_id == party.organization_id, EventRecord.object_id == party_id)).all()
        assert events
        assert all(f"erase-{suffix}@example.test" not in event.payload_json for event in events)

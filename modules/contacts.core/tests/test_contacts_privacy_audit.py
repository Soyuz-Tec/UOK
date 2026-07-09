from __future__ import annotations

from uuid import uuid4

from sqlalchemy import select
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.db import SessionLocal
from uok.models import EventRecord
from uok.util import loads


def test_contact_governance_fields_and_actor_audit_round_trip(client: TestClient) -> None:
    suffix = str(uuid4())
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")

    install = client.post("/api/modules/contacts.core/install", headers=admin)
    assert install.status_code == 200, install.text

    created = command(
        client,
        ops,
        "CreateContact",
        {
            "display_name": f"Governance Contact {suffix}",
            "email": f"governance-{suffix}@example.test",
            "source": "gmail",
            "client_reference": f"thread-{suffix}",
            "consent_status": "business_contact",
            "allowed_use": "operations",
            "confidence_level": "medium",
        },
        f"uok-governance-create-{suffix}",
    )
    assert created.status_code == 200, created.text
    contact_id = created.json()["result"]["contact_id"]

    updated = command(
        client,
        ops,
        "UpdateContact",
        {
            "party_id": contact_id,
            "allowed_use": "restricted",
            "confidence_level": "verified",
        },
        f"uok-governance-update-{suffix}",
    )
    assert updated.status_code == 200, updated.text
    result = updated.json()["result"]
    assert result["consent_status"] == "business_contact"
    assert result["allowed_use"] == "restricted"
    assert result["confidence_level"] == "verified"

    with SessionLocal() as db:
        event = db.scalar(
            select(EventRecord)
            .where(EventRecord.object_id == contact_id, EventRecord.event_type == "ContactUpdated")
            .order_by(EventRecord.sequence.desc())
        )
    assert event is not None
    payload = loads(event.payload_json, {})
    assert payload["actor_username"] == "ops"
    assert payload["display_name"] == f"Governance Contact {suffix}"

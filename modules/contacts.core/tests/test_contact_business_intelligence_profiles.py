from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command


def test_contact_detail_exposes_derived_business_intelligence_profile(client: TestClient) -> None:
    suffix = str(uuid4())
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")

    install = client.post("/api/modules/contacts.core/install", headers=admin)
    assert install.status_code == 200, install.text

    person = command(
        client,
        ops,
        "CreateContact",
        {
            "display_name": f"Profile Person {suffix}",
            "email": f"profile-person-{suffix}@example.test",
            "phone": f"+1-555-{suffix[:4]}",
            "address": "100 Example Street",
        },
        f"uok-profile-person-{suffix}",
    )
    assert person.status_code == 200, person.text
    person_id = person.json()["result"]["contact_id"]

    organization = command(
        client,
        ops,
        "CreateContact",
        {
            "party_type": "organization",
            "display_name": f"Profile Organization {suffix}",
            "email": f"profile-org-{suffix}@example.test",
        },
        f"uok-profile-organization-{suffix}",
    )
    assert organization.status_code == 200, organization.text
    organization_id = organization.json()["result"]["contact_id"]

    group = command(
        client,
        ops,
        "CreateContactGroup",
        {"name": f"Profile Group {suffix}"},
        f"uok-profile-group-{suffix}",
    )
    assert group.status_code == 200, group.text
    group_id = group.json()["result"]["id"]

    added = command(
        client,
        ops,
        "AddContactsToGroup",
        {"group_id": group_id, "party_ids": [person_id]},
        f"uok-profile-group-add-{suffix}",
    )
    assert added.status_code == 200, added.text

    note = command(
        client,
        ops,
        "AddContactNote",
        {"party_id": person_id, "body": "Validated by operations."},
        f"uok-profile-note-{suffix}",
    )
    assert note.status_code == 200, note.text

    relationship = command(
        client,
        ops,
        "LinkContactRelationship",
        {
            "from_party_id": person_id,
            "to_party_id": organization_id,
            "relationship_type": "works_for",
        },
        f"uok-profile-relationship-{suffix}",
    )
    assert relationship.status_code == 200, relationship.text

    detail = client.get(f"/api/contacts/{person_id}", headers=ops)
    assert detail.status_code == 200, detail.text
    profile = detail.json()["business_intelligence_profile"]

    assert profile["profile_type"] == "person"
    assert profile["readiness"] == "ready"
    assert profile["headline"] == "Ready contact"
    assert profile["note_count"] == 1
    assert profile["relationship_count"] == 1
    assert profile["group_count"] == 1
    assert profile["business_domain_group_count"] == 0
    assert profile["primary_organization_name"] == f"Profile Organization {suffix}"
    assert profile["summary"].startswith("Ready contact with")
    assert profile["signal_count"] >= 4
    assert f"Profile Group {suffix}" in profile["group_names"]
    assert f"Profile Organization {suffix}" in profile["relationship_names"]

    listed = client.get("/api/contacts", headers=ops, params={"status": "all"})
    assert listed.status_code == 200, listed.text
    row = next(item for item in listed.json() if item["id"] == person_id)
    assert "business_intelligence_profile" in row
    assert row["business_intelligence_profile"]["profile_type"] == "person"


def test_imported_contacts_surface_as_needing_review_in_the_profile(client: TestClient) -> None:
    suffix = str(uuid4())
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")

    install = client.post("/api/modules/contacts.core/install", headers=admin)
    assert install.status_code == 200, install.text

    imported = command(
        client,
        ops,
        "CreateContact",
        {
            "display_name": f"Imported Contact {suffix}",
            "email": f"imported-{suffix}@example.test",
            "source": "csv_import",
            "review_state": "needs_review",
        },
        f"uok-profile-imported-{suffix}",
    )
    assert imported.status_code == 200, imported.text
    contact_id = imported.json()["result"]["contact_id"]

    detail = client.get(f"/api/contacts/{contact_id}", headers=ops)
    assert detail.status_code == 200, detail.text
    profile = detail.json()["business_intelligence_profile"]

    assert profile["readiness"] == "needs_review"
    assert profile["headline"] == "Needs review"
    assert profile["confidence"] == "medium"
    assert "review" in profile["summary"].lower()

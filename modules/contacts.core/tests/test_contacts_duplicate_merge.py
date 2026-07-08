from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command


def test_duplicate_merge_preserves_facts_and_archives_duplicate(client: TestClient) -> None:
    suffix = str(uuid4())
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")

    install = client.post("/api/modules/contacts.core/install", headers=admin)
    assert install.status_code == 200, install.text

    organization = command(
        client,
        ops,
        "CreateContact",
        {
            "party_type": "organization",
            "display_name": f"Merge Organization {suffix}",
            "website": "https://merge.example.test",
        },
        f"uok-merge-organization-{suffix}",
    )
    assert organization.status_code == 200, organization.text
    organization_id = organization.json()["result"]["contact_id"]

    primary = command(
        client,
        ops,
        "CreateContact",
        {
            "display_name": f"Merge Person {suffix}",
            "email": f"merge-{suffix}@example.test",
        },
        f"uok-merge-primary-{suffix}",
    )
    assert primary.status_code == 200, primary.text
    primary_id = primary.json()["result"]["contact_id"]

    duplicate = command(
        client,
        ops,
        "CreateContact",
        {
            "display_name": f"Merge Person Duplicate {suffix}",
            "email": f"merge-{suffix}@example.test",
            "phone": "+1 555 0142",
            "address": "42 Merge Street",
        },
        f"uok-merge-duplicate-{suffix}",
    )
    assert duplicate.status_code == 200, duplicate.text
    duplicate_body = duplicate.json()["result"]
    duplicate_id = duplicate_body["contact_id"]
    assert duplicate_body["review_state"] == "possible_duplicate"

    note = command(
        client,
        ops,
        "AddContactNote",
        {"party_id": duplicate_id, "body": "Duplicate contains confirmed phone and address."},
        f"uok-merge-note-{suffix}",
    )
    assert note.status_code == 200, note.text

    group = command(
        client,
        ops,
        "CreateContactGroup",
        {"name": f"Merge Group {suffix}"},
        f"uok-merge-group-{suffix}",
    )
    assert group.status_code == 200, group.text
    group_id = group.json()["result"]["id"]

    grouped = command(
        client,
        ops,
        "AddContactsToGroup",
        {"group_id": group_id, "party_ids": [duplicate_id]},
        f"uok-merge-group-member-{suffix}",
    )
    assert grouped.status_code == 200, grouped.text

    relationship = command(
        client,
        ops,
        "LinkContactRelationship",
        {
            "from_party_id": duplicate_id,
            "to_party_id": organization_id,
            "relationship_type": "works_for",
        },
        f"uok-merge-relationship-{suffix}",
    )
    assert relationship.status_code == 200, relationship.text

    merged = command(
        client,
        ops,
        "MergeDuplicateContact",
        {"primary_party_id": primary_id, "duplicate_party_id": duplicate_id},
        f"uok-merge-contacts-{suffix}",
    )
    assert merged.status_code == 200, merged.text
    result = merged.json()["result"]
    assert result["id"] == primary_id
    assert result["phone"] == "+1 555 0142"
    assert result["address"] == "42 Merge Street"
    assert result["moved_notes"] == 1
    assert result["moved_groups"] == 1
    assert result["moved_relationships"] == 1
    assert result["notes"][0]["body"] == "Duplicate contains confirmed phone and address."
    assert any(row["id"] == group_id for row in result["groups"])
    assert any(row["related_party_id"] == organization_id for row in result["relationships"])

    archived_duplicate = client.get(f"/api/contacts/{duplicate_id}", headers=ops)
    assert archived_duplicate.status_code == 200, archived_duplicate.text
    assert archived_duplicate.json()["status"] == "archived"
    assert archived_duplicate.json()["attrs"]["merged_into_party_id"] == primary_id

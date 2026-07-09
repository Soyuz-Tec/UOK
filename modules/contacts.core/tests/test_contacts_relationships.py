from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command


def test_relationship_details_include_related_party_and_collapse_duplicates(client: TestClient) -> None:
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
            "display_name": f"Relationship Person {suffix}",
            "email": f"person-{suffix}@example.test",
        },
        f"uok-relationship-person-{suffix}",
    )
    assert person.status_code == 200, person.text
    person_id = person.json()["result"]["contact_id"]

    organization = command(
        client,
        ops,
        "CreateContact",
        {
            "party_type": "organization",
            "display_name": f"Relationship Organization {suffix}",
            "email": f"organization-{suffix}@example.test",
        },
        f"uok-relationship-organization-{suffix}",
    )
    assert organization.status_code == 200, organization.text
    organization_id = organization.json()["result"]["contact_id"]

    for index in range(2):
        linked = command(
            client,
            ops,
            "LinkContactRelationship",
            {
                "from_party_id": person_id,
                "to_party_id": organization_id,
                "relationship_type": "works_for",
            },
            f"uok-relationship-link-{suffix}-{index}",
        )
        assert linked.status_code == 200, linked.text

    detail = client.get(f"/api/contacts/{person_id}", headers=ops)
    assert detail.status_code == 200, detail.text
    relationships = detail.json()["relationships"]

    assert len(relationships) == 1
    assert relationships[0]["related_party_id"] == organization_id
    assert relationships[0]["related_party_name"] == f"Relationship Organization {suffix}"
    assert relationships[0]["related_party_type"] == "organization"
    assert relationships[0]["related_party_email"] == f"organization-{suffix}@example.test"

    updated = command(
        client,
        ops,
        "UpdateContactRelationship",
        {
            "relationship_id": relationships[0]["id"],
            "from_party_id": person_id,
            "to_party_id": organization_id,
            "relationship_type": "billing_contact",
        },
        f"uok-relationship-update-{suffix}",
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["result"]["updated_count"] == 1

    updated_detail = client.get(f"/api/contacts/{person_id}", headers=ops)
    assert updated_detail.status_code == 200, updated_detail.text
    updated_relationships = updated_detail.json()["relationships"]
    assert len(updated_relationships) == 1
    assert updated_relationships[0]["relationship_type"] == "billing_contact"

    removed = command(
        client,
        ops,
        "RemoveContactRelationship",
        {"relationship_id": updated_relationships[0]["id"]},
        f"uok-relationship-remove-{suffix}",
    )
    assert removed.status_code == 200, removed.text
    assert removed.json()["result"]["removed_count"] == 1

    unlinked_detail = client.get(f"/api/contacts/{person_id}", headers=ops)
    assert unlinked_detail.status_code == 200, unlinked_detail.text
    assert unlinked_detail.json()["relationships"] == []

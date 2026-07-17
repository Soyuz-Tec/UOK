from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from module_catalog_assertions import assert_module_lifecycle_and_evidence
from tests.helpers import auth, command


def test_apps_manager_installs_contacts_and_baseline_stays_module_neutral(client: TestClient) -> None:
    suffix = str(uuid4())
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    viewer = auth(client, "viewer", "viewer123")

    catalog = client.get("/api/modules/catalog", headers=admin)
    assert catalog.status_code == 200, catalog.text
    modules = catalog.json()["modules"]
    assert sorted(modules) == [
        "agents.core",
        "apps.manager",
        "calendar.core",
        "communications.core",
        "contacts.core",
        "locations.core",
        "planning.core",
        "product.master",
        "reports.core",
        "routes.core",
        "shipments.core",
    ]
    assert modules["apps.manager"]["status"] == "installed"
    assert modules["apps.manager"]["required"] is True
    assert modules["agents.core"]["required"] is False
    assert modules["calendar.core"]["kind"] == "capability_module"
    assert modules["calendar.core"]["required"] is False
    assert modules["calendar.core"]["installable"] is True
    assert modules["communications.core"]["kind"] == "capability_module"
    assert modules["communications.core"]["required"] is False
    assert modules["contacts.core"]["required"] is False
    assert modules["locations.core"]["kind"] == "capability_module"
    assert modules["locations.core"]["required"] is False
    assert modules["locations.core"]["installable"] is True
    assert modules["routes.core"]["kind"] == "capability_module"
    assert modules["routes.core"]["required"] is False
    assert modules["routes.core"]["installable"] is True
    assert modules["shipments.core"]["kind"] == "business_module"
    assert modules["shipments.core"]["required"] is False
    assert modules["shipments.core"]["installable"] is True
    assert modules["planning.core"]["required"] is False
    assert modules["reports.core"]["kind"] == "capability_module"
    assert modules["reports.core"]["required"] is False
    assert modules["reports.core"]["installable"] is True
    assert modules["reports.core"]["uninstallable"] is True

    install = client.post("/api/modules/contacts.core/install", headers=admin)
    assert install.status_code == 200, install.text
    assert install.json()["status"] == "installed"

    invalid = command(client, ops, "CreateContact", {}, f"uok-invalid-contact-{suffix}")
    assert invalid.status_code == 400, invalid.text

    denied = command(
        client,
        viewer,
        "CreateContact",
        {"display_name": f"Denied Contact {suffix}", "company_name": "Denied Account"},
        f"uok-denied-contact-{suffix}",
    )
    assert denied.status_code == 403, denied.text

    contact = command(
        client,
        ops,
        "CreateContact",
        {
            "display_name": f"UOK Contact {suffix}",
            "email": f"contact-{suffix}@example.test",
            "company_name": f"UOK Account {suffix}",
        },
        f"uok-contact-{suffix}",
    )
    assert contact.status_code == 200, contact.text
    assert contact.json()["result"]["display_name"].startswith("UOK Contact")
    contact_id = contact.json()["result"]["contact_id"]
    company_id = contact.json()["result"]["company_party_id"]

    updated = command(
        client,
        ops,
        "UpdateContact",
        {
            "party_id": contact_id,
            "phone": "+1 555 0100",
            "website": "https://example.test",
            "note": "Updated during alpha.3 Contacts module verification.",
        },
        f"uok-update-contact-{suffix}",
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["result"]["phone"] == "+1 555 0100"

    note = command(
        client,
        ops,
        "AddContactNote",
        {"party_id": contact_id, "body": "Private internal note for testing."},
        f"uok-note-contact-{suffix}",
    )
    assert note.status_code == 200, note.text
    assert note.json()["result"]["note_id"]

    linked = command(
        client,
        ops,
        "LinkContactRelationship",
        {"from_party_id": contact_id, "to_party_id": company_id, "relationship_type": "primary_contact"},
        f"uok-link-contact-{suffix}",
    )
    assert linked.status_code == 200, linked.text
    assert linked.json()["result"]["relationship_id"]
    relationship_id = linked.json()["result"]["relationship_id"]

    relationship_updated = command(
        client,
        ops,
        "UpdateContactRelationship",
        {"relationship_id": relationship_id, "from_party_id": contact_id, "to_party_id": company_id, "relationship_type": "billing_contact"},
        f"uok-update-relationship-{suffix}",
    )
    assert relationship_updated.status_code == 200, relationship_updated.text
    assert relationship_updated.json()["result"]["updated_count"] >= 1

    relationship_removed = command(
        client,
        ops,
        "RemoveContactRelationship",
        {"relationship_id": relationship_id},
        f"uok-remove-relationship-{suffix}",
    )
    assert relationship_removed.status_code == 200, relationship_removed.text
    assert relationship_removed.json()["result"]["removed_count"] >= 1

    relinked = command(
        client,
        ops,
        "LinkContactRelationship",
        {"from_party_id": contact_id, "to_party_id": company_id, "relationship_type": "primary_contact"},
        f"uok-relink-contact-{suffix}",
    )
    assert relinked.status_code == 200, relinked.text
    assert relinked.json()["result"]["relationship_id"]

    contact_group = command(
        client,
        ops,
        "CreateContactGroup",
        {"name": f"Operations Contacts {suffix}", "description": "Baseline evidence contact group."},
        f"uok-contact-group-{suffix}",
    )
    assert contact_group.status_code == 200, contact_group.text
    contact_group_id = contact_group.json()["result"]["id"]

    grouped = command(
        client,
        ops,
        "AddContactsToGroup",
        {"group_id": contact_group_id, "party_ids": [contact_id]},
        f"uok-contact-group-add-{suffix}",
    )
    assert grouped.status_code == 200, grouped.text
    assert grouped.json()["result"]["added_count"] == 1

    ungrouped = command(
        client,
        ops,
        "RemoveContactFromGroup",
        {"group_id": contact_group_id, "party_id": contact_id},
        f"uok-contact-group-remove-{suffix}",
    )
    assert ungrouped.status_code == 200, ungrouped.text
    assert ungrouped.json()["result"]["removed_count"] == 1

    regrouped = command(
        client,
        ops,
        "AddContactsToGroup",
        {"group_id": contact_group_id, "party_ids": [contact_id]},
        f"uok-contact-group-readd-{suffix}",
    )
    assert regrouped.status_code == 200, regrouped.text

    archived = command(client, ops, "ArchiveContact", {"party_id": contact_id}, f"uok-archive-contact-{suffix}")
    assert archived.status_code == 200, archived.text
    assert archived.json()["result"]["status"] == "archived"

    restored = command(client, ops, "RestoreContact", {"party_id": contact_id}, f"uok-restore-contact-{suffix}")
    assert restored.status_code == 200, restored.text
    assert restored.json()["result"]["status"] == "active"

    imported = command(
        client,
        ops,
        "ImportContactsCsv",
        {
            "filename": "contacts-alpha3.csv",
            "csv_text": "display_name,email,company,phone\nImported Contact,contact-{suffix}@example.test,Imported Account,+1 555 9999\n",
        },
        f"uok-import-contact-{suffix}",
    )
    assert imported.status_code == 200, imported.text
    assert imported.json()["result"]["imported_count"] == 1

    contacts = client.get("/api/contacts", headers=admin)
    assert contacts.status_code == 200, contacts.text
    assert any(row["id"] == contact_id for row in contacts.json())

    detail = client.get(f"/api/contacts/{contact_id}", headers=admin)
    assert detail.status_code == 200, detail.text
    assert detail.json()["notes"]
    assert detail.json()["relationships"]
    assert detail.json()["groups"]

    review_queue = client.get("/api/contacts/review-queue", headers=admin)
    assert review_queue.status_code == 200, review_queue.text
    assert any(row["source"] == "csv_import" for row in review_queue.json())

    assert_module_lifecycle_and_evidence(client, admin)

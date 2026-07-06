from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient

from tests.helpers import auth, command


def test_apps_manager_installs_contacts_and_baseline_stays_module_neutral(client: TestClient) -> None:
    suffix = str(uuid4())
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    viewer = auth(client, "viewer", "viewer123")

    catalog = client.get("/api/modules/catalog", headers=admin)
    assert catalog.status_code == 200, catalog.text
    modules = catalog.json()["modules"]
    assert sorted(modules) == ["apps.manager", "contacts.core"]
    assert modules["apps.manager"]["status"] == "installed"
    assert modules["apps.manager"]["required"] is True
    assert modules["contacts.core"]["required"] is False

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
            "note": "Updated during alpha.2 CRM slice verification.",
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
            "filename": "contacts-alpha2.csv",
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

    review_queue = client.get("/api/contacts/review-queue", headers=admin)
    assert review_queue.status_code == 200, review_queue.text
    assert any(row["source"] == "csv_import" for row in review_queue.json())

    dashboard = client.get("/api/dashboard", headers=admin)
    assert dashboard.status_code == 200, dashboard.text
    assert dashboard.json()["counts"]["contacts"] >= 1
    assert dashboard.json()["counts"]["organizations"] >= 1
    assert dashboard.json()["counts"]["review_queue"] >= 1

    lifecycle = client.get("/api/modules/lifecycle", headers=admin)
    assert lifecycle.status_code == 200, lifecycle.text
    lifecycle_checks = lifecycle.json()["checks"]
    assert lifecycle_checks["apps_manager_declared"] is True
    assert lifecycle_checks["contacts_declared_as_available_module"] is True
    assert lifecycle_checks["only_apps_manager_required"] is True
    assert lifecycle_checks["no_business_modules_declared"] is True
    assert lifecycle_checks["contacts_installable"] is True
    assert lifecycle_checks["contacts_uninstallable"] is True

    evidence = client.get("/api/baseline-evidence", headers=admin)
    assert evidence.status_code == 200, evidence.text
    checks = evidence.json()["checks"]
    assert evidence.json()["ok"] is True
    assert checks["apps_manager_operational"] is True
    assert checks["contacts_module_available_to_install"] is True
    assert checks["contacts_module_operational"] is True
    assert checks["module_lifecycle_events_present"] is True
    assert checks["contact_full_crm_events_present"] is True
    assert checks["private_notes_available"] is True
    assert checks["relationships_available"] is True
    assert checks["import_batches_available"] is True
    assert checks["review_queue_available"] is True
    assert checks["role_denials_recorded"] is True
    assert checks["validation_errors_recorded"] is True

    verify = client.post("/api/architecture/verify-baseline", headers=admin)
    assert verify.status_code == 200, verify.text
    assert verify.json()["result"]["ok"] is True
    assert verify.json()["result"]["checks"]["module_neutral_baseline"] is True
    assert verify.json()["result"]["checks"]["module_lifecycle_ok"] is True

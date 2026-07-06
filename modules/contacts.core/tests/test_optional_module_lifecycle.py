from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command


def test_optional_contacts_module_can_be_uninstalled_without_compromising_uok(client: TestClient) -> None:
    suffix = str(uuid4())
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")

    install = client.post("/api/modules/contacts.core/install", headers=admin)
    assert install.status_code == 200, install.text

    maintenance = client.get("/api/modules/contacts.core/maintenance", headers=admin)
    assert maintenance.status_code == 200, maintenance.text
    assert maintenance.json()["operations_safe_for_uok"] is True
    assert maintenance.json()["checks"]["uok_compromise_required"] is False

    upgraded = client.post("/api/modules/contacts.core/upgrade", headers=admin)
    assert upgraded.status_code == 200, upgraded.text
    assert upgraded.json()["status"] == "upgraded"

    readable_before_uninstall = command(
        client,
        ops,
        "CreateContact",
        {"display_name": f"Readable Before Uninstall {suffix}", "company_name": "Operational Account"},
        f"uok-readable-before-uninstall-{suffix}",
    )
    assert readable_before_uninstall.status_code == 200, readable_before_uninstall.text
    readable_contact_id = readable_before_uninstall.json()["result"]["contact_id"]

    disabled = client.post("/api/modules/contacts.core/disable", headers=admin)
    assert disabled.status_code == 200, disabled.text
    assert disabled.json()["status"] == "disabled"

    disabled_read = client.get(f"/api/contacts/{readable_contact_id}", headers=admin)
    assert disabled_read.status_code == 400, disabled_read.text
    assert "contacts.core" in disabled_read.json()["detail"]["error"]

    disabled_command = command(
        client,
        ops,
        "CreateContact",
        {"display_name": f"Disabled Contact {suffix}", "company_name": "Disabled Account"},
        f"uok-disabled-contact-{suffix}",
    )
    assert disabled_command.status_code == 400, disabled_command.text
    assert "contacts.core" in disabled_command.json()["detail"]["error"]

    enabled = client.post("/api/modules/contacts.core/enable", headers=admin)
    assert enabled.status_code == 200, enabled.text
    assert enabled.json()["status"] == "installed"

    enabled_read = client.get(f"/api/contacts/{readable_contact_id}", headers=admin)
    assert enabled_read.status_code == 200, enabled_read.text

    archived = command(client, ops, "ArchiveContact", {"party_id": readable_contact_id}, f"uok-lifecycle-archive-{suffix}")
    assert archived.status_code == 200, archived.text
    assert archived.json()["result"]["status"] == "archived"

    restored_by_admin = command(client, admin, "RestoreContact", {"party_id": readable_contact_id}, f"uok-lifecycle-restore-{suffix}")
    assert restored_by_admin.status_code == 200, restored_by_admin.text
    assert restored_by_admin.json()["result"]["status"] == "active"

    purge_denied = command(client, ops, "PurgeContact", {"party_id": readable_contact_id}, f"uok-lifecycle-purge-denied-{suffix}")
    assert purge_denied.status_code == 403, purge_denied.text

    purged_by_admin = command(client, admin, "PurgeContact", {"party_id": readable_contact_id}, f"uok-lifecycle-purge-{suffix}")
    assert purged_by_admin.status_code == 200, purged_by_admin.text
    assert purged_by_admin.json()["result"]["status"] == "purged"

    restore_purged = command(client, admin, "RestoreContact", {"party_id": readable_contact_id}, f"uok-lifecycle-restore-purged-{suffix}")
    assert restore_purged.status_code == 400, restore_purged.text
    assert "purged contacts cannot be restored" in restore_purged.text

    uninstalled = client.post("/api/modules/contacts.core/uninstall", headers=admin)
    assert uninstalled.status_code == 200, uninstalled.text
    assert uninstalled.json()["status"] == "uninstalled"

    for path in (
        "/api/contacts",
        "/api/contacts/review-queue",
        "/api/contacts/import-batches",
        f"/api/contacts/{readable_contact_id}",
        f"/api/contacts/{readable_contact_id}/notes",
        f"/api/contacts/{readable_contact_id}/relationships",
    ):
        blocked_read = client.get(path, headers=admin)
        assert blocked_read.status_code == 400, blocked_read.text
        assert "contacts.core" in blocked_read.json()["detail"]["error"]

    contact_blocked = command(
        client,
        ops,
        "CreateContact",
        {"display_name": f"Blocked Contact {suffix}", "company_name": "Blocked Account"},
        f"uok-blocked-contact-{suffix}",
    )
    assert contact_blocked.status_code == 400, contact_blocked.text
    assert "contacts.core" in contact_blocked.json()["detail"]["error"]

    health = client.get("/health")
    assert health.status_code == 200, health.text
    assert health.json()["status"] == "ok"

    reinstalled = client.post("/api/modules/contacts.core/install", headers=admin)
    assert reinstalled.status_code == 200, reinstalled.text
    assert reinstalled.json()["status"] == "installed"

    contact = command(
        client,
        ops,
        "CreateContact",
        {"display_name": f"Reinstalled Contact {suffix}", "company_name": "Reinstalled Account"},
        f"uok-reinstalled-contact-{suffix}",
    )
    assert contact.status_code == 200, contact.text

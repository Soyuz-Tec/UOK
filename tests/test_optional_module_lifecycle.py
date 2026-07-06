from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient

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

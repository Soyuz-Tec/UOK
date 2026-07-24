from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.host.database import SessionLocal
from uok.kernel.security import Actor
from uok_contacts_core._internal.groups_relationships.group_read_model import serialize_contact_group
from uok_contacts_core._internal.persistence.models import ContactGroup


def test_contact_group_lifecycle_projection_uses_exact_command_permissions(client: TestClient, monkeypatch) -> None:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/contacts.core/install", headers=admin).status_code == 200
    created = command(
        client,
        ops,
        "CreateContactGroup",
        {"name": f"Capability split {suffix}"},
        f"contact-group-capability-split-{suffix}",
    )
    assert created.status_code == 200, created.text
    group_id = created.json()["result"]["id"]
    monkeypatch.setattr(
        "uok.kernel.security.effective_role_permissions",
        lambda: {
            "manage_only": {"contacts.manage"},
            "restore_only": {"contacts.restore"},
        },
    )

    with SessionLocal() as db:
        group = db.get(ContactGroup, group_id)
        assert group is not None
        manage_row = serialize_contact_group(
            db,
            group,
            actor=Actor("manage", "manage", group.organization_id, "manage_only"),
        )
        restore_row = serialize_contact_group(
            db,
            group,
            actor=Actor("restore", "restore", group.organization_id, "restore_only"),
        )

    assert manage_row["can_delete"] is True
    assert manage_row["can_restore"] is False
    assert restore_row["can_delete"] is False
    assert restore_row["can_restore"] is False


def test_contact_group_lifecycle_fails_closed_for_unknown_status(client: TestClient) -> None:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/contacts.core/install", headers=admin).status_code == 200
    created = command(
        client,
        ops,
        "CreateContactGroup",
        {"name": f"Unknown lifecycle {suffix}"},
        f"contact-group-unknown-lifecycle-{suffix}",
    )
    assert created.status_code == 200, created.text
    group_id = created.json()["result"]["id"]
    with SessionLocal() as db:
        group = db.get(ContactGroup, group_id)
        assert group is not None
        group.status = "legacy_unknown"
        db.commit()

    row = next(
        item
        for item in client.get(
            "/api/contacts/groups",
            headers=ops,
            params={"include_archived": True},
        ).json()
        if item["id"] == group_id
    )
    assert row["can_delete"] is False
    assert row["can_restore"] is False
    deleted = client.delete(f"/api/contacts/groups/{group_id}", headers={**ops, "If-Match": row["etag"]})
    restored = client.post(f"/api/contacts/groups/{group_id}/restore", headers={**ops, "If-Match": row["etag"]})
    assert deleted.status_code == 400, deleted.text
    assert restored.status_code == 400, restored.text

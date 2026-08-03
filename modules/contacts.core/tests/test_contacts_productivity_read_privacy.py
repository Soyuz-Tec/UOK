from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command, user_id
from uok.host.database import SessionLocal
from uok.kernel_models import Organization
from uok.util import dumps
from uok_contacts_core._internal.persistence.models import Party


def _install(client: TestClient) -> tuple[dict[str, str], dict[str, str], dict[str, str]]:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    viewer = auth(client, "viewer", "viewer123")
    installed = client.post("/api/modules/contacts.core/install", headers=admin)
    assert installed.status_code == 200, installed.text
    return admin, ops, viewer


def test_selected_party_activity_is_private_non_cacheable_and_pii_minimized(client: TestClient) -> None:
    suffix = str(uuid4())
    _, ops, _ = _install(client)
    sensitive_values = (
        f"Sensitive Activity Name {suffix}",
        f"activity-{suffix}@example.test",
        f"+1-202-555-{suffix[-4:]}",
        f"Private address {suffix}",
        f"Private note {suffix}",
    )
    created = command(
        client,
        ops,
        "CreateContact",
        {
            "display_name": sensitive_values[0],
            "email": sensitive_values[1],
            "phone": sensitive_values[2],
            "address": sensitive_values[3],
            "note": sensitive_values[4],
        },
        f"activity-privacy-{suffix}",
    )
    assert created.status_code == 200, created.text
    party_id = created.json()["result"]["contact_id"]

    activity = client.get(f"/api/contacts/{party_id}/activity", headers=ops)

    assert activity.status_code == 200, activity.text
    assert activity.headers["Cache-Control"] == "private, no-store"
    assert activity.headers["Vary"] == "Authorization"
    assert int(activity.headers["X-Total-Count"]) >= 1
    activity_text = activity.text
    assert all(value not in activity_text for value in sensitive_values)


def test_relationship_options_are_private_tenant_scoped_active_and_readable(client: TestClient) -> None:
    suffix = str(uuid4())
    _, ops, viewer = _install(client)
    search_marker = f"LookupPrivacy{suffix}"

    visible = command(
        client,
        ops,
        "CreateContact",
        {
            "display_name": f"{search_marker} Visible",
            "email": f"visible-{suffix}@example.test",
            "visibility_scope": "organization",
        },
        f"lookup-visible-{suffix}",
    )
    assert visible.status_code == 200, visible.text
    visible_id = visible.json()["result"]["contact_id"]

    hidden = command(
        client,
        ops,
        "CreateContact",
        {
            "display_name": f"{search_marker} Hidden",
            "owner_user_id": user_id("ops"),
            "visibility_scope": "private",
        },
        f"lookup-hidden-{suffix}",
    )
    assert hidden.status_code == 200, hidden.text
    hidden_id = hidden.json()["result"]["contact_id"]

    archived = command(
        client,
        ops,
        "CreateContact",
        {
            "display_name": f"{search_marker} Archived",
            "visibility_scope": "organization",
        },
        f"lookup-archived-{suffix}",
    )
    assert archived.status_code == 200, archived.text
    archived_id = archived.json()["result"]["contact_id"]
    archived_result = command(
        client,
        ops,
        "ArchiveContact",
        {"party_id": archived_id},
        f"lookup-archive-{suffix}",
    )
    assert archived_result.status_code == 200, archived_result.text

    other_organization_id = str(uuid4())
    other_party_id = str(uuid4())
    with SessionLocal() as db:
        db.add(Organization(id=other_organization_id, name=f"Other tenant {suffix}"))
        db.add(
            Party(
                id=other_party_id,
                organization_id=other_organization_id,
                party_type="person",
                display_name=f"{search_marker} Other Tenant",
                status="active",
                review_state="ready",
                visibility_scope="organization",
                source="test",
                sync_state="server",
                attrs_json=dumps({"email": f"other-{suffix}@example.test"}),
            )
        )
        db.commit()

    options = client.get(
        "/api/contacts/relationship-options",
        headers=viewer,
        params={"query": search_marker},
    )

    assert options.status_code == 200, options.text
    assert options.headers["Cache-Control"] == "private, no-store"
    assert options.headers["Vary"] == "Authorization"
    option_ids = {row["id"] for row in options.json()}
    assert visible_id in option_ids
    assert hidden_id not in option_ids
    assert archived_id not in option_ids
    assert other_party_id not in option_ids

    cross_tenant_activity = client.get(f"/api/contacts/{other_party_id}/activity", headers=ops)
    assert cross_tenant_activity.status_code == 404, cross_tenant_activity.text

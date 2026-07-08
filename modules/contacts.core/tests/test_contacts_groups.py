from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command


def test_contact_groups_can_be_created_filtered_and_managed(client: TestClient) -> None:
    suffix = str(uuid4())
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    viewer = auth(client, "viewer", "viewer123")

    install = client.post("/api/modules/contacts.core/install", headers=admin)
    assert install.status_code == 200, install.text

    denied = command(
        client,
        viewer,
        "CreateContactGroup",
        {"name": f"Denied Group {suffix}"},
        f"uok-denied-contact-group-{suffix}",
    )
    assert denied.status_code == 403, denied.text

    person = command(
        client,
        ops,
        "CreateContact",
        {"display_name": f"Grouped Person {suffix}", "email": f"grouped-person-{suffix}@example.test"},
        f"uok-group-person-{suffix}",
    )
    assert person.status_code == 200, person.text
    person_id = person.json()["result"]["contact_id"]

    outside_person = command(
        client,
        ops,
        "CreateContact",
        {"display_name": f"Ungrouped Person {suffix}", "email": f"ungrouped-person-{suffix}@example.test"},
        f"uok-ungrouped-person-{suffix}",
    )
    assert outside_person.status_code == 200, outside_person.text
    outside_person_id = outside_person.json()["result"]["contact_id"]

    group = command(
        client,
        ops,
        "CreateContactGroup",
        {"name": f"Operations Group {suffix}", "description": "Contacts used in operations workflow tests."},
        f"uok-contact-group-{suffix}",
    )
    assert group.status_code == 200, group.text
    group_id = group.json()["result"]["id"]
    assert group.json()["result"]["member_count"] == 0

    duplicate_group = command(
        client,
        ops,
        "CreateContactGroup",
        {"name": f"Operations Group {suffix}"},
        f"uok-contact-group-duplicate-{suffix}",
    )
    assert duplicate_group.status_code == 400, duplicate_group.text

    added = command(
        client,
        ops,
        "AddContactsToGroup",
        {"group_id": group_id, "party_ids": [person_id, person_id]},
        f"uok-contact-group-add-{suffix}",
    )
    assert added.status_code == 200, added.text
    assert added.json()["result"]["added_count"] == 1
    assert added.json()["result"]["group"]["member_count"] == 1

    groups = client.get("/api/contacts/groups", headers=ops)
    assert groups.status_code == 200, groups.text
    matching_groups = [row for row in groups.json() if row["id"] == group_id]
    assert matching_groups
    assert matching_groups[0]["member_count"] == 1
    assert matching_groups[0]["active_member_count"] == 1

    grouped_contacts = client.get("/api/contacts", headers=ops, params={"status": "all", "group_id": group_id})
    assert grouped_contacts.status_code == 200, grouped_contacts.text
    grouped_ids = {row["id"] for row in grouped_contacts.json()}
    assert person_id in grouped_ids
    assert outside_person_id not in grouped_ids

    detail = client.get(f"/api/contacts/{person_id}", headers=ops)
    assert detail.status_code == 200, detail.text
    memberships = detail.json()["groups"]
    assert memberships[0]["id"] == group_id
    assert memberships[0]["name"] == f"Operations Group {suffix}"

    removed = command(
        client,
        ops,
        "RemoveContactFromGroup",
        {"group_id": group_id, "party_id": person_id},
        f"uok-contact-group-remove-{suffix}",
    )
    assert removed.status_code == 200, removed.text
    assert removed.json()["result"]["removed_count"] == 1

    empty_group = client.get("/api/contacts", headers=ops, params={"status": "all", "group_id": group_id})
    assert empty_group.status_code == 200, empty_group.text
    assert empty_group.json() == []

    restored_member = command(
        client,
        ops,
        "AddContactsToGroup",
        {"group_id": group_id, "party_ids": [person_id]},
        f"uok-contact-group-readd-{suffix}",
    )
    assert restored_member.status_code == 200, restored_member.text

    archived = command(
        client,
        ops,
        "ArchiveContactGroup",
        {"group_id": group_id},
        f"uok-contact-group-archive-{suffix}",
    )
    assert archived.status_code == 200, archived.text
    assert archived.json()["result"]["status"] == "archived"

    groups_after_archive = client.get("/api/contacts/groups", headers=ops)
    assert groups_after_archive.status_code == 200, groups_after_archive.text
    assert group_id not in {row["id"] for row in groups_after_archive.json()}

    archived_filter = client.get("/api/contacts", headers=ops, params={"status": "all", "group_id": group_id})
    assert archived_filter.status_code == 200, archived_filter.text
    assert archived_filter.json() == []

    restored_group = command(
        client,
        ops,
        "CreateContactGroup",
        {"name": f"Operations Group {suffix}"},
        f"uok-contact-group-restore-{suffix}",
    )
    assert restored_group.status_code == 200, restored_group.text
    assert restored_group.json()["result"]["id"] == group_id
    assert restored_group.json()["result"]["status"] == "active"

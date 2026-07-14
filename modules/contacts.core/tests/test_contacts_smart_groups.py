from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command


def test_contact_smart_groups_are_materialized_and_repeatable(client: TestClient) -> None:
    suffix = str(uuid4())
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")

    install = client.post("/api/modules/contacts.core/install", headers=admin)
    assert install.status_code == 200, install.text

    company_name = f"Smart Company {suffix}"
    country = f"Smart Country {suffix}"
    first = command(
        client,
        ops,
        "CreateContact",
        {
            "display_name": f"Smart Person One {suffix}",
            "email": f"smart-one-{suffix}@example.test",
            "company_name": company_name,
            "address": f"One Smart Street, {country}",
        },
        f"uok-smart-person-one-{suffix}",
    )
    assert first.status_code == 200, first.text
    first_id = first.json()["result"]["contact_id"]
    second = command(
        client,
        ops,
        "CreateContact",
        {
            "display_name": f"Smart Person Two {suffix}",
            "email": f"smart-two-{suffix}@example.test",
            "company_name": company_name,
            "address": f"Two Smart Street, {country}",
        },
        f"uok-smart-person-two-{suffix}",
    )
    assert second.status_code == 200, second.text
    second_id = second.json()["result"]["contact_id"]

    organization_groups = command(
        client,
        ops,
        "GroupContactsBySmartRule",
        {"rule": "organization", "minimum_members": 2},
        f"uok-smart-organization-groups-{suffix}",
    )
    assert organization_groups.status_code == 200, organization_groups.text
    group_result = _group_for_value(organization_groups.json()["result"], company_name)
    assert group_result["member_count"] >= 2
    assert group_result["added_count"] >= 2
    group = group_result["group"]
    assert group["kind"] == "smart_rule"
    assert group["name"] == f"Company: {company_name}"

    grouped_contacts = client.get("/api/contacts", headers=ops, params={"status": "all", "group_id": group["id"]})
    assert grouped_contacts.status_code == 200, grouped_contacts.text
    grouped_ids = {row["id"] for row in grouped_contacts.json()}
    assert {first_id, second_id}.issubset(grouped_ids)

    country_groups = command(
        client,
        ops,
        "GroupContactsBySmartRule",
        {"rule": "country", "minimum_members": 2},
        f"uok-smart-country-groups-{suffix}",
    )
    assert country_groups.status_code == 200, country_groups.text
    country_group = _group_for_value(country_groups.json()["result"], country)
    assert country_group["group"]["name"] == f"Country: {country}"

    rerun = command(
        client,
        ops,
        "GroupContactsBySmartRule",
        {"rule": "organization", "minimum_members": 2},
        f"uok-smart-organization-groups-rerun-{suffix}",
    )
    assert rerun.status_code == 200, rerun.text
    rerun_group = _group_for_value(rerun.json()["result"], company_name)
    assert rerun_group["added_count"] == 0
    assert rerun_group["removed_count"] == 0
    assert rerun_group["unchanged_count"] >= 2

    for command_type, payload in (
        ("UpdateContactGroup", {"group_id": group["id"], "name": f"Mutated Smart Group {suffix}"}),
        ("ArchiveContactGroup", {"group_id": group["id"]}),
        ("AddContactsToGroup", {"group_id": group["id"], "party_ids": [second_id]}),
        ("RemoveContactFromGroup", {"group_id": group["id"], "party_id": second_id}),
    ):
        rejected = command(
            client,
            ops,
            command_type,
            payload,
            f"uok-smart-generated-mutation-{command_type}-{suffix}",
        )
        assert rejected.status_code == 400, rejected.text
        assert "managed by their generator" in rejected.text

    archived = command(
        client,
        ops,
        "ArchiveContact",
        {"party_id": first_id},
        f"uok-smart-contact-archive-{suffix}",
    )
    assert archived.status_code == 200, archived.text
    reconciled = command(
        client,
        ops,
        "GroupContactsBySmartRule",
        {"rule": "organization", "minimum_members": 1},
        f"uok-smart-organization-reconcile-{suffix}",
    )
    assert reconciled.status_code == 200, reconciled.text
    reconciled_group = _group_for_value(reconciled.json()["result"], company_name)
    assert reconciled_group["removed_count"] == 1
    assert reconciled_group["unchanged_count"] >= 1
    reconciled_contacts = client.get("/api/contacts", headers=ops, params={"status": "all", "group_id": group["id"]})
    assert reconciled_contacts.status_code == 200, reconciled_contacts.text
    reconciled_ids = {row["id"] for row in reconciled_contacts.json()}
    assert first_id not in reconciled_ids
    assert second_id in reconciled_ids


def test_smart_organization_groups_prefer_deterministic_linked_organizations(client: TestClient) -> None:
    suffix = str(uuid4())
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    install = client.post("/api/modules/contacts.core/install", headers=admin)
    assert install.status_code == 200, install.text

    person = command(
        client,
        ops,
        "CreateContact",
        {"display_name": f"Priority Person {suffix}", "email": f"priority-{suffix}@example.test"},
        f"uok-smart-priority-person-{suffix}",
    )
    assert person.status_code == 200, person.text
    person_id = person.json()["result"]["contact_id"]
    inline_name = f"Inline Company {suffix}"
    updated = command(
        client,
        ops,
        "UpdateContact",
        {"party_id": person_id, "organization_name": inline_name},
        f"uok-smart-priority-inline-{suffix}",
    )
    assert updated.status_code == 200, updated.text

    customer_name = f"Customer Company {suffix}"
    priority_name = f"Priority Company {suffix}"
    customer_id = _create_organization(client, ops, suffix, "customer", customer_name)
    priority_id = _create_organization(client, ops, suffix, "priority", priority_name)
    customer_link = command(
        client,
        ops,
        "LinkContactRelationship",
        {"from_party_id": person_id, "to_party_id": customer_id, "relationship_type": "customer"},
        f"uok-smart-priority-customer-link-{suffix}",
    )
    assert customer_link.status_code == 200, customer_link.text
    works_for_link = command(
        client,
        ops,
        "LinkContactRelationship",
        {"from_party_id": person_id, "to_party_id": priority_id, "relationship_type": "works_for"},
        f"uok-smart-priority-works-for-link-{suffix}",
    )
    assert works_for_link.status_code == 200, works_for_link.text

    grouped = command(
        client,
        ops,
        "GroupContactsBySmartRule",
        {"rule": "organization", "minimum_members": 1},
        f"uok-smart-priority-group-{suffix}",
    )
    assert grouped.status_code == 200, grouped.text
    priority_group = _group_for_value(grouped.json()["result"], priority_name)
    grouped_contacts = client.get(
        "/api/contacts",
        headers=ops,
        params={"status": "all", "group_id": priority_group["group"]["id"]},
    )
    assert grouped_contacts.status_code == 200, grouped_contacts.text
    assert person_id in {row["id"] for row in grouped_contacts.json()}
    assert all(row["value"] != inline_name for row in grouped.json()["result"]["groups"])

    rerun = command(
        client,
        ops,
        "GroupContactsBySmartRule",
        {"rule": "organization", "minimum_members": 1},
        f"uok-smart-priority-group-rerun-{suffix}",
    )
    assert rerun.status_code == 200, rerun.text
    assert _group_for_value(rerun.json()["result"], priority_name)["group"]["id"] == priority_group["group"]["id"]


def _group_for_value(result: dict, value: str) -> dict:
    assert result["group_count"] >= 1
    return next(row for row in result["groups"] if row["value"] == value)


def _create_organization(
    client: TestClient,
    ops: dict[str, str],
    suffix: str,
    label: str,
    name: str,
) -> str:
    response = command(
        client,
        ops,
        "CreateContact",
        {"party_type": "organization", "organization_name": name},
        f"uok-smart-priority-organization-{label}-{suffix}",
    )
    assert response.status_code == 200, response.text
    return response.json()["result"]["contact_id"]

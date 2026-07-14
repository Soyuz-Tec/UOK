from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command


def test_business_email_domain_groups_are_created_idempotently(client: TestClient) -> None:
    suffix = str(uuid4())
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")

    install = client.post("/api/modules/contacts.core/install", headers=admin)
    assert install.status_code == 200, install.text

    first_id, second_id = _create_domain_group_contacts(client, ops, suffix)
    grouped = command(client, ops, "GroupContactsByBusinessEmailDomain", {}, f"uok-domain-grouping-{suffix}")
    assert grouped.status_code == 200, grouped.text

    group = _assert_domain_group_result(grouped.json()["result"], suffix)
    grouped_contacts = client.get("/api/contacts", headers=ops, params={"status": "all", "group_id": group["id"]})
    assert grouped_contacts.status_code == 200, grouped_contacts.text
    grouped_ids = {row["id"] for row in grouped_contacts.json()}
    assert first_id in grouped_ids
    assert second_id in grouped_ids

    rerun = command(client, ops, "GroupContactsByBusinessEmailDomain", {}, f"uok-domain-grouping-rerun-{suffix}")
    assert rerun.status_code == 200, rerun.text
    assert rerun.json()["result"]["domain_count"] == 1
    assert rerun.json()["result"]["added_count"] == 0
    rerun_group = next(row for row in rerun.json()["result"]["groups"] if row["group"]["id"] == group["id"])
    assert rerun_group["removed_count"] == 0
    assert rerun_group["unchanged_count"] == 2

    for command_type, payload in (
        ("UpdateContactGroup", {"group_id": group["id"], "name": f"Mutated Domain Group {suffix}"}),
        ("ArchiveContactGroup", {"group_id": group["id"]}),
        ("AddContactsToGroup", {"group_id": group["id"], "party_ids": [second_id]}),
        ("RemoveContactFromGroup", {"group_id": group["id"], "party_id": second_id}),
    ):
        rejected = command(
            client,
            ops,
            command_type,
            payload,
            f"uok-domain-generated-mutation-{command_type}-{suffix}",
        )
        assert rejected.status_code == 400, rejected.text
        assert "managed by their generator" in rejected.text

    archived_first = command(
        client,
        ops,
        "ArchiveContact",
        {"party_id": first_id},
        f"uok-domain-contact-archive-first-{suffix}",
    )
    assert archived_first.status_code == 200, archived_first.text
    reconciled = command(
        client,
        ops,
        "GroupContactsByBusinessEmailDomain",
        {"minimum_members": 1},
        f"uok-domain-grouping-reconcile-{suffix}",
    )
    assert reconciled.status_code == 200, reconciled.text
    reconciled_group = next(row for row in reconciled.json()["result"]["groups"] if row["group"]["id"] == group["id"])
    assert reconciled_group["removed_count"] == 1
    assert reconciled_group["unchanged_count"] == 1
    assert reconciled_group["group"]["member_count"] == 1
    reconciled_contacts = client.get("/api/contacts", headers=ops, params={"status": "all", "group_id": group["id"]})
    assert reconciled_contacts.status_code == 200, reconciled_contacts.text
    assert {row["id"] for row in reconciled_contacts.json()} == {second_id}

    archived_second = command(
        client,
        ops,
        "ArchiveContact",
        {"party_id": second_id},
        f"uok-domain-contact-archive-second-{suffix}",
    )
    assert archived_second.status_code == 200, archived_second.text
    retired = command(
        client,
        ops,
        "GroupContactsByBusinessEmailDomain",
        {},
        f"uok-domain-grouping-retire-{suffix}",
    )
    assert retired.status_code == 200, retired.text
    assert retired.json()["result"]["removed_count"] >= 1
    assert retired.json()["result"]["archived_count"] >= 1
    active_groups = client.get("/api/contacts/groups", headers=ops)
    assert active_groups.status_code == 200, active_groups.text
    assert group["id"] not in {row["id"] for row in active_groups.json()}


def _create_domain_group_contacts(client: TestClient, ops: dict[str, str], suffix: str) -> tuple[str, str]:
    business_domain = f"uok-{suffix}.business"
    first = _create_domain_contact(client, ops, suffix, "one", business_domain, f"Domain Person One {suffix}")
    second = _create_domain_contact(client, ops, suffix, "two", business_domain, f"Domain Person Two {suffix}")
    personal = command(
        client,
        ops,
        "CreateContact",
        {"display_name": f"Personal Mail {suffix}", "email": f"personal-{suffix}@gmail.com"},
        f"uok-domain-personal-{suffix}",
    )
    assert personal.status_code == 200, personal.text
    singleton = command(
        client,
        ops,
        "CreateContact",
        {"display_name": f"Solo Domain {suffix}", "email": f"solo@solo-{suffix}.business"},
        f"uok-domain-singleton-{suffix}",
    )
    assert singleton.status_code == 200, singleton.text
    return first, second


def _create_domain_contact(client: TestClient, ops: dict[str, str], suffix: str, local: str, domain: str, name: str) -> str:
    response = command(
        client,
        ops,
        "CreateContact",
        {"display_name": name, "email": f"{local}@{domain}", "company_name": f"Acme Shipping {suffix}"},
        f"uok-domain-person-{local}-{suffix}",
    )
    assert response.status_code == 200, response.text
    return response.json()["result"]["contact_id"]


def _assert_domain_group_result(result: dict, suffix: str) -> dict:
    assert result["domain_count"] == 1
    assert result["contacts_matched"] == 2
    assert result["added_count"] == 2
    assert result["minimum_members"] == 2
    assert result["skipped_domains_below_minimum"] >= 1
    assert result["groups"][0]["name_source"] == "relationship_company"
    group = result["groups"][0]["group"]
    assert group["name"] == f"Acme Shipping {suffix}"
    assert group["kind"] == "business_domain"
    return group

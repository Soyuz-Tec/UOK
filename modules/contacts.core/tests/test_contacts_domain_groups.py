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

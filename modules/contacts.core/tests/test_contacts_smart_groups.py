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


def _group_for_value(result: dict, value: str) -> dict:
    assert result["group_count"] >= 1
    return next(row for row in result["groups"] if row["value"] == value)

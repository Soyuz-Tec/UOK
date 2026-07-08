from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command


def test_contacts_list_supports_saved_view_filter_semantics(client: TestClient) -> None:
    suffix = str(uuid4())
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")

    install = client.post("/api/modules/contacts.core/install", headers=admin)
    assert install.status_code == 200, install.text

    no_company = command(
        client,
        ops,
        "CreateContact",
        {
            "display_name": f"No Company Person {suffix}",
            "email": f"person-{suffix}@supplier.example",
            "source": "gmail",
        },
        f"uok-saved-view-no-company-{suffix}",
    )
    assert no_company.status_code == 200, no_company.text
    no_company_id = no_company.json()["result"]["contact_id"]

    with_company = command(
        client,
        ops,
        "CreateContact",
        {
            "display_name": f"Company Person {suffix}",
            "email": f"company-person-{suffix}@supplier.example",
            "company_name": f"Company Account {suffix}",
            "source": "contacts",
        },
        f"uok-saved-view-with-company-{suffix}",
    )
    assert with_company.status_code == 200, with_company.text
    with_company_id = with_company.json()["result"]["contact_id"]

    duplicate = command(
        client,
        ops,
        "CreateContact",
        {
            "display_name": f"No Company Person Copy {suffix}",
            "email": f"person-{suffix}@supplier.example",
            "source": "gmail",
        },
        f"uok-saved-view-duplicate-{suffix}",
    )
    assert duplicate.status_code == 200, duplicate.text
    duplicate_id = duplicate.json()["result"]["contact_id"]

    no_company_rows = client.get("/api/contacts", headers=ops, params={"status": "all", "quality": "no_company"})
    assert no_company_rows.status_code == 200, no_company_rows.text
    no_company_ids = {row["id"] for row in no_company_rows.json()}
    assert no_company_id in no_company_ids
    assert duplicate_id in no_company_ids
    assert with_company_id not in no_company_ids

    gmail_rows = client.get("/api/contacts", headers=ops, params={"status": "all", "source": "gmail"})
    assert gmail_rows.status_code == 200, gmail_rows.text
    gmail_ids = {row["id"] for row in gmail_rows.json()}
    assert {no_company_id, duplicate_id}.issubset(gmail_ids)
    assert with_company_id not in gmail_ids

    duplicate_rows = client.get("/api/contacts", headers=ops, params={"status": "all", "quality": "duplicate_risk"})
    assert duplicate_rows.status_code == 200, duplicate_rows.text
    duplicate_ids = {row["id"] for row in duplicate_rows.json()}
    assert duplicate_id in duplicate_ids
    assert no_company_id not in duplicate_ids


def test_contacts_list_rejects_unknown_quality_filter(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    install = client.post("/api/modules/contacts.core/install", headers=admin)
    assert install.status_code == 200, install.text

    response = client.get("/api/contacts", headers=admin, params={"quality": "unknown"})

    assert response.status_code == 422, response.text

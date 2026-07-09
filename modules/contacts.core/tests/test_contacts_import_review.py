from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command


def test_csv_import_keeps_review_evidence_and_rejects_marketing_contacts(client: TestClient) -> None:
    suffix = str(uuid4())
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")

    install = client.post("/api/modules/contacts.core/install", headers=admin)
    assert install.status_code == 200, install.text

    imported = command(
        client,
        ops,
        "ImportContactsCsv",
        {
            "filename": f"source-{suffix}.csv",
            "csv_text": (
                "display_name,email,company,phone,note\n"
                f"Useful Supplier {suffix},supplier-{suffix}@example.test,Supplier Account,+1 555 0200,Known from supplier review\n"
                f"Newsletter {suffix},newsletter-{suffix}@marketing.example,Marketing List,,Unsubscribe footer\n"
            ),
        },
        f"uok-import-review-{suffix}",
    )
    assert imported.status_code == 200, imported.text
    result = imported.json()["result"]
    assert result["imported_count"] == 1
    assert result["failed_count"] == 1
    assert result["failures"][0]["error"] == "automated marketing contact rejected"

    contact_id = result["imported"][0]["party_id"]
    detail = client.get(f"/api/contacts/{contact_id}", headers=ops)
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert body["review_state"] == "needs_review"
    assert body["source"] == "csv_import"
    assert body["client_reference"].endswith(":row:2")
    assert body["attrs"]["source_evidence"]["filename"] == f"source-{suffix}.csv"
    assert body["attrs"]["source_evidence"]["row"] == 2
    assert body["notes"][0]["body"] == "Known from supplier review"

    review = client.get("/api/contacts/review-queue", headers=ops)
    assert review.status_code == 200, review.text
    assert any(row["id"] == contact_id for row in review.json())

    marketing_rows = client.get("/api/contacts", headers=ops, params={"status": "all", "query": f"newsletter-{suffix}"})
    assert marketing_rows.status_code == 200, marketing_rows.text
    assert marketing_rows.json() == []

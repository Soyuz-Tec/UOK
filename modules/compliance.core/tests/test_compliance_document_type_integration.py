from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command

from compliance_test_support import install_compliance


def test_document_type_create_update_and_history_contract(
    client: TestClient,
) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    viewer = auth(client, "viewer", "viewer123")
    install_compliance(client, admin)
    suffix = uuid4().hex[:8].upper()
    create_payload = {
        "code": f" bill__of_lading_{suffix} ",
        "canonical_name": f"Bill of Lading {suffix}",
        "description": "Tenant-reviewed transport document type",
        "category": "Transport",
    }
    create_key = f"compliance-create-{suffix}"

    created = command(
        client,
        ops,
        "CreateComplianceDocumentType",
        create_payload,
        create_key,
    )
    assert created.status_code == 200, created.text
    created_body = created.json()
    document_type = created_body["result"]
    document_type_id = document_type["id"]
    assert document_type["code"] == f"BILL-OF-LADING-{suffix}"
    assert document_type["status"] == "active"
    assert document_type["version"] == 1
    assert document_type["correlation_id"] == created_body["command_id"]
    assert "organization_id" not in document_type

    replay = command(
        client,
        ops,
        "CreateComplianceDocumentType",
        create_payload,
        create_key,
    )
    assert replay.status_code == 200, replay.text
    assert replay.json()["idempotent"] is True
    assert replay.json()["result"] == document_type

    duplicate = command(
        client,
        ops,
        "CreateComplianceDocumentType",
        create_payload,
        f"compliance-duplicate-{suffix}",
    )
    assert duplicate.status_code == 400, duplicate.text
    denied = command(
        client,
        viewer,
        "CreateComplianceDocumentType",
        create_payload,
        f"compliance-denied-{suffix}",
    )
    assert denied.status_code == 403, denied.text

    detail_path = f"/api/compliance/document-types/{document_type_id}"
    detail = client.get(detail_path, headers=viewer)
    assert detail.status_code == 200, detail.text
    assert detail.json()["id"] == document_type_id
    filtered = client.get(
        (
            "/api/compliance/document-types"
            f"?search={suffix}&category=Transport&status=active"
        ),
        headers=viewer,
    )
    assert [row["id"] for row in filtered.json()] == [document_type_id]

    updated = command(
        client,
        ops,
        "UpdateComplianceDocumentType",
        {
            "compliance_document_type_id": document_type_id,
            "expected_version": 1,
            "canonical_name": f"Ocean Bill of Lading {suffix}",
            "reason": "Align tenant operations vocabulary",
        },
        f"compliance-update-name-{suffix}",
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["result"]["version"] == 2
    history_path = f"{detail_path}/name-history"
    history = client.get(history_path, headers=viewer)
    assert history.status_code == 200, history.text
    assert history.json() == [
        {
            "id": history.json()[0]["id"],
            "compliance_document_type_id": document_type_id,
            "previous_name": f"Bill of Lading {suffix}",
            "new_name": f"Ocean Bill of Lading {suffix}",
            "reason": "Align tenant operations vocabulary",
            "changed_by_user_id": updated.json()["result"][
                "updated_by_user_id"
            ],
            "changed_at": history.json()[0]["changed_at"],
        }
    ]

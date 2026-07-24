from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command

from compliance_test_support import (
    create_document_type,
    install_compliance,
    transition_document_type,
)


def test_inactive_lifecycle_allows_update_and_requires_legal_transitions(
    client: TestClient,
) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    viewer = auth(client, "viewer", "viewer123")
    install_compliance(client, admin)
    suffix = uuid4().hex[:8].upper()
    document_type = create_document_type(
        client,
        ops,
        code=f"PACKING-LIST-{suffix}",
        name=f"Packing List {suffix}",
        category="Packing",
        idempotency_key=f"lifecycle-create-{suffix}",
    )
    document_type_id = str(document_type["id"])

    stale = transition_document_type(
        client,
        ops,
        "DeactivateComplianceDocumentType",
        document_type_id,
        2,
        "Should fail",
        f"lifecycle-stale-{suffix}",
    )
    assert stale.status_code == 400, stale.text
    assert "current version 1" in stale.text

    deactivated = transition_document_type(
        client,
        ops,
        "DeactivateComplianceDocumentType",
        document_type_id,
        1,
        "Temporarily not used",
        f"lifecycle-deactivate-{suffix}",
    )
    assert deactivated.status_code == 200, deactivated.text
    assert deactivated.json()["result"]["status"] == "inactive"
    assert deactivated.json()["result"]["version"] == 2
    rows = client.get(
        "/api/compliance/document-types?status=inactive",
        headers=viewer,
    ).json()
    assert any(row["id"] == document_type_id for row in rows)

    updated = command(
        client,
        ops,
        "UpdateComplianceDocumentType",
        {
            "compliance_document_type_id": document_type_id,
            "expected_version": 2,
            "description": "Reviewed while inactive",
            "reason": "Record lifecycle review",
        },
        f"lifecycle-update-{suffix}",
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["result"]["version"] == 3

    activated = transition_document_type(
        client,
        ops,
        "ActivateComplianceDocumentType",
        document_type_id,
        3,
        "Returned to the tenant workflow",
        f"lifecycle-activate-{suffix}",
    )
    assert activated.status_code == 200, activated.text
    assert activated.json()["result"]["status"] == "active"
    assert activated.json()["result"]["version"] == 4

    illegal = transition_document_type(
        client,
        ops,
        "ActivateComplianceDocumentType",
        document_type_id,
        4,
        "Should fail",
        f"lifecycle-illegal-{suffix}",
    )
    assert illegal.status_code == 400, illegal.text
    assert "from active to active" in illegal.text

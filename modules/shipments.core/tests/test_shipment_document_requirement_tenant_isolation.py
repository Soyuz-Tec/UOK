from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command

from shipment_test_support import (
    create_compliance_document_type,
    create_requirement_shipment,
    get_document_requirements,
    install_shipment_stack,
    other_shipment_tenant_headers,
)


def test_document_requirements_reject_foreign_shipments_types_and_links(
    client: TestClient,
) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    suffix = uuid4().hex[:8].upper()
    other = other_shipment_tenant_headers(suffix)
    install_shipment_stack(client, admin)
    install_shipment_stack(client, other)

    local_shipment_id = create_requirement_shipment(client, ops, f"L{suffix}")
    remote_shipment_id = create_requirement_shipment(client, other, f"R{suffix}")
    shared_code = f"CERTIFICATE-OF-ORIGIN-{suffix}"
    local_type = create_compliance_document_type(
        client,
        ops,
        shared_code,
        f"Local Certificate {suffix}",
        f"local-requirement-type-{suffix}",
    )
    remote_type = create_compliance_document_type(
        client,
        other,
        shared_code,
        f"Remote Certificate {suffix}",
        f"remote-requirement-type-{suffix}",
    )
    local_type_id = str(local_type["id"])
    remote_type_id = str(remote_type["id"])

    local_add = _add_requirement(
        client,
        ops,
        local_shipment_id,
        local_type_id,
        f"local-requirement-{suffix}",
    )
    remote_add = _add_requirement(
        client,
        other,
        remote_shipment_id,
        remote_type_id,
        f"remote-requirement-{suffix}",
    )
    assert local_add.status_code == 200, local_add.text
    assert remote_add.status_code == 200, remote_add.text
    local_requirement_id = local_add.json()["result"]["id"]
    remote_requirement_id = remote_add.json()["result"]["id"]

    assert client.get(
        f"/api/shipments/records/{remote_shipment_id}/document-requirements",
        headers=ops,
    ).status_code == 404
    assert client.get(
        (
            f"/api/shipments/records/{remote_shipment_id}/document-requirements/"
            f"{remote_requirement_id}/history"
        ),
        headers=ops,
    ).status_code == 404
    local_rows = get_document_requirements(client, ops, local_shipment_id)
    assert [row["id"] for row in local_rows["items"]] == [local_requirement_id]
    assert remote_requirement_id not in str(local_rows)
    assert remote_type_id not in str(local_rows)

    foreign_type = _add_requirement(
        client,
        ops,
        local_shipment_id,
        remote_type_id,
        f"foreign-type-requirement-{suffix}",
    )
    assert foreign_type.status_code == 400, foreign_type.text
    assert remote_type_id not in foreign_type.text
    foreign_shipment = _add_requirement(
        client,
        ops,
        remote_shipment_id,
        local_type_id,
        f"foreign-shipment-requirement-{suffix}",
    )
    assert foreign_shipment.status_code == 400, foreign_shipment.text
    assert remote_shipment_id not in foreign_shipment.text

    for command_name, payload in (
        (
            "UpdateShipmentDocumentRequirement",
            {
                "requirement_level": "optional",
                "notes": "Forbidden",
                "reason": "Cross-tenant update",
            },
        ),
        (
            "SetShipmentDocumentRequirementStatus",
            {
                "new_status": "waived",
                "reason": "Cross-tenant status",
            },
        ),
        (
            "RemoveShipmentDocumentRequirement",
            {"reason": "Cross-tenant remove"},
        ),
    ):
        result = command(
            client,
            ops,
            command_name,
            {
                "shipment_id": remote_shipment_id,
                "requirement_id": remote_requirement_id,
                "expected_version": 1,
                **payload,
            },
            f"{command_name.lower()}-{suffix}",
        )
        assert result.status_code == 400, result.text
        assert remote_shipment_id not in result.text
        assert remote_requirement_id not in result.text


def _add_requirement(
    client: TestClient,
    headers: dict[str, str],
    shipment_id: str,
    document_type_id: str,
    key: str,
):
    return command(
        client,
        headers,
        "AddShipmentDocumentRequirement",
        {
            "shipment_id": shipment_id,
            "compliance_document_type_id": document_type_id,
            "requirement_level": "required",
        },
        key,
    )

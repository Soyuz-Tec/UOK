from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command

from shipment_test_support import (
    create_compliance_document_type,
    create_requirement_shipment,
    get_document_instances,
    install_shipment_stack,
    other_shipment_tenant_headers,
)


def test_document_instances_reject_foreign_shipments_types_and_requirements(
    client: TestClient,
) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    suffix = uuid4().hex[:8].upper()
    other = other_shipment_tenant_headers(f"INSTANCE{suffix}")
    install_shipment_stack(client, admin)
    install_shipment_stack(client, other)

    local_shipment_id = create_requirement_shipment(client, ops, f"IL{suffix}")
    remote_shipment_id = create_requirement_shipment(client, other, f"IR{suffix}")
    local_type = create_compliance_document_type(
        client,
        ops,
        f"LOCAL-INVOICE-{suffix}",
        f"Local Invoice {suffix}",
        f"instance-local-type-{suffix}",
    )
    remote_type = create_compliance_document_type(
        client,
        other,
        f"REMOTE-INVOICE-{suffix}",
        f"Remote Invoice {suffix}",
        f"instance-remote-type-{suffix}",
    )
    local_type_id = str(local_type["id"])
    remote_type_id = str(remote_type["id"])
    local_requirement_id = _add_requirement(
        client,
        ops,
        local_shipment_id,
        local_type_id,
        f"instance-local-requirement-{suffix}",
    )
    remote_requirement_id = _add_requirement(
        client,
        other,
        remote_shipment_id,
        remote_type_id,
        f"instance-remote-requirement-{suffix}",
    )
    local_instance_id = _create_instance(
        client,
        ops,
        local_shipment_id,
        local_type_id,
        local_requirement_id,
        f"LOCAL-{suffix}",
        f"instance-local-create-{suffix}",
    )
    remote_instance_id = _create_instance(
        client,
        other,
        remote_shipment_id,
        remote_type_id,
        remote_requirement_id,
        f"REMOTE-{suffix}",
        f"instance-remote-create-{suffix}",
    )

    assert client.get(
        f"/api/shipments/records/{remote_shipment_id}/document-instances",
        headers=ops,
    ).status_code == 404
    assert client.get(
        (
            f"/api/shipments/records/{local_shipment_id}/document-instances/"
            f"{remote_instance_id}"
        ),
        headers=ops,
    ).status_code == 404
    local_rows = get_document_instances(client, ops, local_shipment_id)
    assert [row["id"] for row in local_rows] == [local_instance_id]
    assert remote_instance_id not in str(local_rows)
    assert remote_type_id not in str(local_rows)
    assert remote_requirement_id not in str(local_rows)

    foreign_type = command(
        client,
        ops,
        "CreateShipmentDocumentInstance",
        {
            "shipment_id": local_shipment_id,
            "compliance_document_type_id": remote_type_id,
            "document_number": "FOREIGN-TYPE",
        },
        f"instance-foreign-type-{suffix}",
    )
    assert foreign_type.status_code == 400, foreign_type.text
    assert remote_type_id not in foreign_type.text
    mismatched_requirement = command(
        client,
        ops,
        "CreateShipmentDocumentInstance",
        {
            "shipment_id": local_shipment_id,
            "compliance_document_type_id": local_type_id,
            "requirement_id": remote_requirement_id,
            "document_number": "FOREIGN-REQUIREMENT",
        },
        f"instance-foreign-requirement-{suffix}",
    )
    assert mismatched_requirement.status_code == 400, mismatched_requirement.text
    assert remote_requirement_id not in mismatched_requirement.text

    for command_name, payload in (
        (
            "UpdateShipmentDocumentInstance",
            {
                "document_number": "FORBIDDEN",
                "reason": "Cross-tenant update",
            },
        ),
        (
            "SetShipmentDocumentInstanceStatus",
            {
                "new_status": "recorded",
                "reason": "Cross-tenant status",
            },
        ),
    ):
        result = command(
            client,
            ops,
            command_name,
            {
                "shipment_id": remote_shipment_id,
                "instance_id": remote_instance_id,
                "expected_version": 1,
                **payload,
            },
            f"{command_name.lower()}-{suffix}",
        )
        assert result.status_code == 400, result.text
        assert remote_shipment_id not in result.text
        assert remote_instance_id not in result.text


def _add_requirement(
    client: TestClient,
    headers: dict[str, str],
    shipment_id: str,
    document_type_id: str,
    key: str,
) -> str:
    response = command(
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
    assert response.status_code == 200, response.text
    return str(response.json()["result"]["id"])


def _create_instance(
    client: TestClient,
    headers: dict[str, str],
    shipment_id: str,
    document_type_id: str,
    requirement_id: str,
    document_number: str,
    key: str,
) -> str:
    response = command(
        client,
        headers,
        "CreateShipmentDocumentInstance",
        {
            "shipment_id": shipment_id,
            "compliance_document_type_id": document_type_id,
            "requirement_id": requirement_id,
            "document_number": document_number,
        },
        key,
    )
    assert response.status_code == 200, response.text
    return str(response.json()["result"]["id"])

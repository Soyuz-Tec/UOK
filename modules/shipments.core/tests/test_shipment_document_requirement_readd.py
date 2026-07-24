from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command

from shipment_test_support import (
    create_compliance_document_type,
    create_requirement_shipment,
    install_shipment_stack,
)


def test_removed_active_type_can_be_readded_with_new_id_and_archived_type_cannot(
    client: TestClient,
) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    install_shipment_stack(client, admin)
    suffix = uuid4().hex[:8].upper()
    shipment_id = create_requirement_shipment(client, ops, f"READD{suffix}")
    document_type = create_compliance_document_type(
        client,
        ops,
        f"PACKING-LIST-{suffix}",
        f"Packing List {suffix}",
        f"readd-type-{suffix}",
    )
    document_type_id = str(document_type["id"])

    first = _add(
        client,
        ops,
        shipment_id,
        document_type_id,
        f"readd-first-{suffix}",
    )
    assert first.status_code == 200, first.text
    first_id = first.json()["result"]["id"]
    first_remove = _remove(
        client,
        ops,
        shipment_id,
        first_id,
        f"readd-first-remove-{suffix}",
    )
    assert first_remove.status_code == 200, first_remove.text

    second = _add(
        client,
        ops,
        shipment_id,
        document_type_id,
        f"readd-second-{suffix}",
    )
    assert second.status_code == 200, second.text
    second_id = second.json()["result"]["id"]
    assert second_id != first_id
    assert second.json()["result"]["version"] == 1
    second_remove = _remove(
        client,
        ops,
        shipment_id,
        second_id,
        f"readd-second-remove-{suffix}",
    )
    assert second_remove.status_code == 200, second_remove.text

    archived = command(
        client,
        ops,
        "ArchiveComplianceDocumentType",
        {
            "compliance_document_type_id": document_type_id,
            "expected_version": 1,
            "reason": "Superseded tenant vocabulary",
        },
        f"readd-type-archive-{suffix}",
    )
    assert archived.status_code == 200, archived.text
    assert archived.json()["result"]["status"] == "archived"
    rejected = _add(
        client,
        ops,
        shipment_id,
        document_type_id,
        f"readd-archived-rejected-{suffix}",
    )
    assert rejected.status_code == 400, rejected.text
    assert document_type_id not in rejected.text


def _add(
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


def _remove(
    client: TestClient,
    headers: dict[str, str],
    shipment_id: str,
    requirement_id: str,
    key: str,
):
    return command(
        client,
        headers,
        "RemoveShipmentDocumentRequirement",
        {
            "shipment_id": shipment_id,
            "requirement_id": requirement_id,
            "expected_version": 1,
            "reason": "Requirement removed for deterministic re-add proof",
        },
        key,
    )

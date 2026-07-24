from __future__ import annotations

from uuid import uuid4

from sqlalchemy import select
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.host.database import SessionLocal
from uok.kernel_models import EventRecord

from shipment_test_support import (
    create_compliance_document_type,
    create_requirement_shipment,
    get_document_requirements,
    install_shipment_stack,
)


def test_document_requirements_are_versioned_audited_and_non_blocking(
    client: TestClient,
) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    viewer = auth(client, "viewer", "viewer123")
    install_shipment_stack(client, admin)
    suffix = uuid4().hex[:8].upper()
    shipment_id = create_requirement_shipment(client, ops, suffix)
    document_type = create_compliance_document_type(
        client,
        ops,
        f"BILL-OF-LADING-{suffix}",
        f"Bill of Lading {suffix}",
        f"requirement-type-{suffix}",
    )
    document_type_id = str(document_type["id"])

    options = client.get(
        "/api/shipments/document-type-options",
        headers=viewer,
    )
    assert options.status_code == 200, options.text
    option = next(
        row
        for row in options.json()
        if row["compliance_document_type_id"] == document_type_id
    )
    assert option["code"] == f"BILL-OF-LADING-{suffix}"
    assert option["status"] == "ready"

    add_payload = {
        "shipment_id": shipment_id,
        "compliance_document_type_id": document_type_id,
        "requirement_level": "optional",
        "notes": "Original operator note",
    }
    add_key = f"requirement-add-{suffix}"
    added = command(
        client,
        ops,
        "AddShipmentDocumentRequirement",
        add_payload,
        add_key,
    )
    assert added.status_code == 200, added.text
    added_body = added.json()
    requirement = added_body["result"]
    requirement_id = requirement["id"]
    assert requirement["status"] == "missing"
    assert requirement["version"] == 1
    assert requirement["document_type"]["canonical_name"] == (
        f"Bill of Lading {suffix}"
    )
    assert "organization_id" not in requirement

    replay = command(
        client,
        ops,
        "AddShipmentDocumentRequirement",
        add_payload,
        add_key,
    )
    assert replay.status_code == 200, replay.text
    assert replay.json()["idempotent"] is True
    assert replay.json()["result"] == requirement
    duplicate = command(
        client,
        ops,
        "AddShipmentDocumentRequirement",
        add_payload,
        f"requirement-duplicate-{suffix}",
    )
    assert duplicate.status_code == 400, duplicate.text
    denied = command(
        client,
        viewer,
        "AddShipmentDocumentRequirement",
        add_payload,
        f"requirement-denied-{suffix}",
    )
    assert denied.status_code == 403, denied.text

    update_payload = {
        "shipment_id": shipment_id,
        "requirement_id": requirement_id,
        "expected_version": 1,
        "requirement_level": "required",
        "notes": "Carrier must present an original",
        "reason": "Required for operating handoff",
    }
    update_key = f"requirement-update-{suffix}"
    updated = command(
        client,
        ops,
        "UpdateShipmentDocumentRequirement",
        update_payload,
        update_key,
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["result"]["version"] == 2
    update_replay = command(
        client,
        ops,
        "UpdateShipmentDocumentRequirement",
        update_payload,
        update_key,
    )
    assert update_replay.status_code == 200, update_replay.text
    assert update_replay.json()["idempotent"] is True
    assert update_replay.json()["result"] == updated.json()["result"]
    stale = command(
        client,
        ops,
        "SetShipmentDocumentRequirementStatus",
        {
            "shipment_id": shipment_id,
            "requirement_id": requirement_id,
            "expected_version": 1,
            "new_status": "received",
            "reason": "Stale mutation",
        },
        f"requirement-stale-{suffix}",
    )
    assert stale.status_code == 400, stale.text
    assert "current version 2" in stale.text

    transition = command(
        client,
        ops,
        "TransitionShipmentStatus",
        {
            "shipment_id": shipment_id,
            "expected_version": 1,
            "new_status": "planned",
            "reason": "Requirements remain non-blocking",
        },
        f"requirement-non-blocking-{suffix}",
    )
    assert transition.status_code == 200, transition.text
    assert transition.json()["result"]["status"] == "planned"

    deactivated = command(
        client,
        ops,
        "DeactivateComplianceDocumentType",
        {
            "compliance_document_type_id": document_type_id,
            "expected_version": 1,
            "reason": "Temporary owner review",
        },
        f"requirement-type-deactivate-{suffix}",
    )
    assert deactivated.status_code == 200, deactivated.text
    listed = get_document_requirements(client, viewer, shipment_id)
    assert listed["items"][0]["document_type"]["status"] == "unavailable"
    assert listed["items"][0]["compliance_document_type_id"] == document_type_id
    assert listed["summary"]["required_missing"] == 1

    status_key = f"requirement-received-{suffix}"
    received = command(
        client,
        ops,
        "SetShipmentDocumentRequirementStatus",
        {
            "shipment_id": shipment_id,
            "requirement_id": requirement_id,
            "expected_version": 2,
            "new_status": "received",
            "reason": "Original received at destination",
        },
        status_key,
    )
    assert received.status_code == 200, received.text
    assert received.json()["result"]["version"] == 3
    assert received.json()["result"]["document_type"]["status"] == "unavailable"
    status_replay = command(
        client,
        ops,
        "SetShipmentDocumentRequirementStatus",
        {
            "shipment_id": shipment_id,
            "requirement_id": requirement_id,
            "expected_version": 2,
            "new_status": "received",
            "reason": "Original received at destination",
        },
        status_key,
    )
    assert status_replay.status_code == 200, status_replay.text
    assert status_replay.json()["idempotent"] is True

    after_received = get_document_requirements(client, viewer, shipment_id)
    assert after_received["summary"]["required_satisfied"] == 1
    assert after_received["summary"]["required_received"] == 1
    remove_payload = {
        "shipment_id": shipment_id,
        "requirement_id": requirement_id,
        "expected_version": 3,
        "reason": "Requirement no longer applies",
    }
    remove_key = f"requirement-remove-{suffix}"
    remove = command(
        client,
        ops,
        "RemoveShipmentDocumentRequirement",
        remove_payload,
        remove_key,
    )
    assert remove.status_code == 200, remove.text
    assert remove.json()["result"] == {
        "id": requirement_id,
        "shipment_id": shipment_id,
        "removed": True,
        "version": 4,
        "correlation_id": remove.json()["command_id"],
    }
    remove_replay = command(
        client,
        ops,
        "RemoveShipmentDocumentRequirement",
        remove_payload,
        remove_key,
    )
    assert remove_replay.status_code == 200, remove_replay.text
    assert remove_replay.json()["idempotent"] is True
    assert remove_replay.json()["result"] == remove.json()["result"]
    assert get_document_requirements(client, viewer, shipment_id)["items"] == []

    history = client.get(
        (
            f"/api/shipments/records/{shipment_id}/document-requirements/"
            f"{requirement_id}/history"
        ),
        headers=viewer,
    )
    assert history.status_code == 200, history.text
    assert [row["action"] for row in reversed(history.json())] == [
        "added",
        "updated",
        "status_changed",
        "removed",
    ]
    assert [row["version"] for row in reversed(history.json())] == [1, 2, 3, 4]

    rejected_readd = command(
        client,
        ops,
        "AddShipmentDocumentRequirement",
        add_payload,
        f"requirement-readd-inactive-{suffix}",
    )
    assert rejected_readd.status_code == 400, rejected_readd.text
    assert document_type_id not in rejected_readd.text

    with SessionLocal() as db:
        events = db.scalars(select(EventRecord).where(
            EventRecord.object_type == "ShipmentDocumentRequirement",
            EventRecord.object_id == requirement_id,
        )).all()
        assert {event.event_type for event in events} == {
            "ShipmentDocumentRequirementAdded",
            "ShipmentDocumentRequirementRemoved",
            "ShipmentDocumentRequirementStatusChanged",
            "ShipmentDocumentRequirementUpdated",
        }

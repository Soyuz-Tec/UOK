from __future__ import annotations

from uuid import uuid4

from sqlalchemy import select
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.host.database import SessionLocal
from uok.host.security import parse_token
from uok.kernel.security import Actor
from uok.kernel_models import EventRecord
from uok_shipments_core._internal.delivery.document_instance_read_service import (
    get_document_instance,
)
from uok_shipments_core._internal.persistence.models import Shipment

from shipment_test_support import (
    create_compliance_document_type,
    create_requirement_shipment,
    get_document_requirements,
    install_shipment_stack,
)


def test_supersession_preserves_readiness_and_linked_requirement_retention(
    client: TestClient,
) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    viewer = auth(client, "viewer", "viewer123")
    install_shipment_stack(client, admin)
    suffix = uuid4().hex[:8].upper()
    shipment_id = create_requirement_shipment(client, ops, f"SAFE{suffix}")
    document_type = create_compliance_document_type(
        client,
        ops,
        f"SAFE-INVOICE-{suffix}",
        f"Safe Invoice {suffix}",
        f"instance-safe-type-{suffix}",
    )
    document_type_id = str(document_type["id"])
    requirement = command(
        client,
        ops,
        "AddShipmentDocumentRequirement",
        {
            "shipment_id": shipment_id,
            "compliance_document_type_id": document_type_id,
            "requirement_level": "required",
        },
        f"instance-safe-requirement-{suffix}",
    )
    assert requirement.status_code == 200, requirement.text
    requirement_id = str(requirement.json()["result"]["id"])
    with SessionLocal() as db:
        header_version = db.scalar(select(Shipment.version).where(
            Shipment.id == shipment_id
        ))

    created = command(
        client,
        ops,
        "CreateShipmentDocumentInstance",
        {
            "shipment_id": shipment_id,
            "compliance_document_type_id": document_type_id,
            "requirement_id": requirement_id,
            "document_number": f"SAFE-{suffix}",
        },
        f"instance-safe-create-{suffix}",
    )
    assert created.status_code == 200, created.text
    instance_id = str(created.json()["result"]["id"])
    recorded = _status(
        client,
        ops,
        shipment_id,
        instance_id,
        1,
        "recorded",
        f"instance-safe-recorded-{suffix}",
    )
    assert recorded.status_code == 200, recorded.text
    verified = command(
        client,
        ops,
        "SetShipmentDocumentInstanceStatus",
        {
            "shipment_id": shipment_id,
            "instance_id": instance_id,
            "expected_version": 2,
            "new_status": "verified",
            "reason": "Evidence reviewed",
            "mark_requirement_received": True,
            "expected_requirement_version": 1,
        },
        f"instance-safe-verified-{suffix}",
    )
    assert verified.status_code == 200, verified.text
    assert verified.json()["result"]["requirement"]["status"] == "received"

    viewer_actor = parse_token(viewer["Authorization"].split(" ", 1)[1])
    denied_compliance_actor = Actor(
        viewer_actor.user_id,
        viewer_actor.username,
        viewer_actor.organization_id,
        "registered_user",
    )
    with SessionLocal() as db:
        redacted = get_document_instance(
            db,
            denied_compliance_actor,
            shipment_id,
            instance_id,
        )
    assert redacted["compliance_document_type_id"] is None
    assert redacted["document_type"]["status"] == "denied"
    assert document_type_id not in str(redacted)

    superseded = _status(
        client,
        ops,
        shipment_id,
        instance_id,
        3,
        "superseded",
        f"instance-safe-superseded-{suffix}",
    )
    assert superseded.status_code == 200, superseded.text
    assert superseded.json()["result"]["requirement"]["status"] == "received"
    summary = get_document_requirements(client, viewer, shipment_id)["summary"]
    assert summary["required_received"] == 1
    assert summary["required_satisfied"] == 1

    protected_remove = command(
        client,
        ops,
        "RemoveShipmentDocumentRequirement",
        {
            "shipment_id": shipment_id,
            "requirement_id": requirement_id,
            "expected_version": 2,
            "reason": "Must retain the linked requirement.",
        },
        f"instance-safe-protected-remove-{suffix}",
    )
    assert protected_remove.status_code == 400, protected_remove.text
    assert "linked to retained document metadata" in protected_remove.text
    history = client.get(
        (
            f"/api/shipments/records/{shipment_id}/document-instances/"
            f"{instance_id}/history"
        ),
        headers=viewer,
    )
    assert history.status_code == 200, history.text
    assert [row["version"] for row in reversed(history.json())] == [1, 2, 3, 4]

    with SessionLocal() as db:
        assert db.scalar(select(Shipment.version).where(Shipment.id == shipment_id)) == (
            header_version
        )
        events = db.scalars(select(EventRecord).where(
            EventRecord.object_type == "ShipmentDocumentInstance",
            EventRecord.object_id == instance_id,
        )).all()
    assert {event.event_type for event in events} == {
        "ShipmentDocumentInstanceCreated",
        "ShipmentDocumentInstanceStatusChanged",
    }


def _status(
    client: TestClient,
    headers: dict[str, str],
    shipment_id: str,
    instance_id: str,
    expected_version: int,
    new_status: str,
    key: str,
):
    return command(
        client,
        headers,
        "SetShipmentDocumentInstanceStatus",
        {
            "shipment_id": shipment_id,
            "instance_id": instance_id,
            "expected_version": expected_version,
            "new_status": new_status,
            "reason": f"Move instance to {new_status}",
        },
        key,
    )

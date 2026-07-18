from __future__ import annotations

from dataclasses import FrozenInstanceError
from datetime import datetime, timezone
from pathlib import Path

import pytest
from pydantic import ValidationError

from uok.module_manifest_loader import load_module_manifests
from uok_shipments_core._internal.delivery.schemas import (
    ShipmentCreateRequest,
    ShipmentResponse,
    ShipmentTransitionRequest,
    ShipmentUpdateRequest,
)
from uok_shipments_core._internal.persistence.models import (
    Shipment,
    ShipmentDocumentInstance,
    ShipmentDocumentInstanceHistory,
    ShipmentDocumentRequirement,
    ShipmentDocumentRequirementHistory,
    ShipmentStatusHistory,
    owned_models,
)
from uok_shipments_core.public_api import ShipmentReferenceDTO
from uok_shipments_core.public_api import __all__ as public_symbols


def test_create_contract_normalizes_code_dates_and_identifiers() -> None:
    request = ShipmentCreateRequest.model_validate({
        "code": "  rcn__africa_voc_001  ",
        "shipper_party_id": " shipper-1 ",
        "consignee_party_id": " consignee-1 ",
        "origin_location_id": " origin-1 ",
        "destination_location_id": " destination-1 ",
        "route_definition_id": " route-1 ",
        "planned_departure_on": "2026-08-01",
        "planned_arrival_on": "2026-08-21",
    })

    assert request.code == "RCN-AFRICA-VOC-001"
    assert request.shipper_party_id == "shipper-1"
    assert request.route_definition_id == "route-1"
    assert request.planned_departure_on.isoformat() == "2026-08-01"


@pytest.mark.parametrize(
    "change",
    [
        {"code": "***"},
        {"origin_location_id": "same", "destination_location_id": "same"},
        {"planned_departure_on": "2026-08-21", "planned_arrival_on": "2026-08-01"},
        {"unexpected": True},
    ],
)
def test_create_contract_rejects_invalid_fields(change: dict[str, object]) -> None:
    payload: dict[str, object] = {
        "code": "RCN-001",
        "shipper_party_id": "shipper-1",
        "consignee_party_id": "consignee-1",
        "origin_location_id": "origin-1",
        "destination_location_id": "destination-1",
    }
    payload.update(change)
    with pytest.raises(ValidationError):
        ShipmentCreateRequest.model_validate(payload)


def test_update_forbids_code_and_transition_requires_reason_and_version() -> None:
    with pytest.raises(ValidationError):
        ShipmentUpdateRequest.model_validate({
            "shipment_id": "shipment-1",
            "expected_version": 1,
            "code": "CHANGED",
        })
    with pytest.raises(ValidationError):
        ShipmentTransitionRequest.model_validate({
            "shipment_id": "shipment-1",
            "expected_version": 0,
            "new_status": "planned",
            "reason": "Ready",
        })
    with pytest.raises(ValidationError):
        ShipmentTransitionRequest.model_validate({
            "shipment_id": "shipment-1",
            "expected_version": 1,
            "new_status": "planned",
            "reason": " ",
        })


def test_response_and_public_reference_dtos_are_frozen_and_exclude_tenant_identity() -> None:
    now = datetime.now(timezone.utc)
    common_reference = {
        "status": "ready",
        "display_label": "Party",
        "status_summary": "Party is active.",
        "open_path": "/?view=contacts&party_id=party-1",
    }
    location = {
        "location_definition_id": "location-1",
        "status": "ready",
        "code": "PORT-1",
        "canonical_name": "Port 1",
        "location_type": "port",
        "country_code": "NG",
        "status_summary": "Location is active.",
    }
    response = ShipmentResponse(
        id="shipment-1",
        code="RCN-001",
        shipper_party_id="party-1",
        consignee_party_id="party-2",
        origin_location_id="location-1",
        destination_location_id="location-2",
        route_definition_id=None,
        planned_departure_on=None,
        planned_arrival_on=None,
        status="draft",
        version=1,
        created_by_user_id="user-1",
        updated_by_user_id="user-1",
        created_at=now,
        updated_at=now,
        shipper=common_reference,
        consignee=common_reference,
        origin=location,
        destination={**location, "location_definition_id": "location-2"},
        route=None,
    )
    assert "organization_id" not in response.model_dump()
    with pytest.raises(ValidationError, match="frozen"):
        response.status = "planned"  # type: ignore[misc]

    reference = ShipmentReferenceDTO(
        "shipment-1",
        "ready",
        "RCN-001",
        "draft",
        "RCN-001",
        "Shipment is draft.",
    )
    with pytest.raises(FrozenInstanceError):
        reference.code = "CHANGED"  # type: ignore[misc]


def test_shipment_owner_contract_manifest_and_migration_are_exact() -> None:
    assert owned_models() == {
        "Shipment": Shipment,
        "ShipmentDocumentInstance": ShipmentDocumentInstance,
        "ShipmentDocumentInstanceHistory": ShipmentDocumentInstanceHistory,
        "ShipmentDocumentRequirement": ShipmentDocumentRequirement,
        "ShipmentDocumentRequirementHistory": ShipmentDocumentRequirementHistory,
        "ShipmentStatusHistory": ShipmentStatusHistory,
    }
    assert public_symbols == [
        "ShipmentReferenceDTO",
        "api_router",
        "command_handlers",
        "command_permissions",
        "resolve_shipment_reference",
        "role_grants",
    ]
    root = Path(__file__).parents[1]
    migration = (root / "migrations" / "001_shipments_core.sql").read_text(encoding="utf-8")
    assert "CREATE TABLE IF NOT EXISTS shipments" in migration
    assert "CREATE TABLE IF NOT EXISTS shipment_status_history" in migration
    assert "UNIQUE (organization_id, code)" in migration
    assert "REFERENCES parties" not in migration
    assert "REFERENCES location_definitions" not in migration
    assert "REFERENCES route_definitions" not in migration
    requirement_migration = (
        root / "migrations" / "002_shipment_document_requirements.sql"
    ).read_text(encoding="utf-8")
    assert "CREATE TABLE IF NOT EXISTS shipment_document_requirements" in requirement_migration
    assert "CREATE TABLE IF NOT EXISTS shipment_document_requirement_history" in requirement_migration
    assert "REFERENCES shipments(id)" in requirement_migration
    assert "REFERENCES compliance_document_types" not in requirement_migration
    instance_migration = (
        root / "migrations" / "003_shipment_document_instances.sql"
    ).read_text(encoding="utf-8")
    assert "CREATE TABLE IF NOT EXISTS shipment_document_instances" in instance_migration
    assert "CREATE TABLE IF NOT EXISTS shipment_document_instance_history" in instance_migration
    assert "REFERENCES shipments(id)" in instance_migration
    assert "REFERENCES shipment_document_requirements(id)" in instance_migration
    assert "REFERENCES compliance_document_types" not in instance_migration
    assert "storage_key" not in instance_migration
    assert " BLOB" not in instance_migration.upper()
    assert " BYTEA" not in instance_migration.upper()

    manifest = load_module_manifests()["shipments.core"]
    assert manifest["kind"] == "business_module"
    assert manifest["dependencies"] == [
        "compliance.core",
        "contacts.core",
        "locations.core",
        "routes.core",
    ]
    assert manifest["api_prefixes"] == ["/api/shipments"]
    assert manifest["model_exports"] == "uok_shipments_core._internal.persistence.models:owned_models"
    assert set(manifest["commands"]) == {
        "AddShipmentDocumentRequirement",
        "CreateShipment",
        "CreateShipmentDocumentInstance",
        "RemoveShipmentDocumentRequirement",
        "SetShipmentDocumentInstanceStatus",
        "SetShipmentDocumentRequirementStatus",
        "TransitionShipmentStatus",
        "UpdateShipment",
        "UpdateShipmentDocumentInstance",
        "UpdateShipmentDocumentRequirement",
    }
    assert set(manifest["events"]) == {
        "ShipmentCreated",
        "ShipmentDocumentInstanceCreated",
        "ShipmentDocumentInstanceStatusChanged",
        "ShipmentDocumentInstanceUpdated",
        "ShipmentDocumentRequirementAdded",
        "ShipmentDocumentRequirementRemoved",
        "ShipmentDocumentRequirementStatusChanged",
        "ShipmentDocumentRequirementUpdated",
        "ShipmentStatusTransitioned",
        "ShipmentUpdated",
    }
    assert manifest["owned_tables"] == [
        "Shipment",
        "ShipmentDocumentInstance",
        "ShipmentDocumentInstanceHistory",
        "ShipmentDocumentRequirement",
        "ShipmentDocumentRequirementHistory",
        "ShipmentStatusHistory",
        "CommandLog:shipments.core",
        "EventRecord:Shipment",
        "EventRecord:ShipmentDocumentInstance",
        "EventRecord:ShipmentDocumentRequirement",
    ]
    assert set(manifest["permissions"]) == {"shipments.read", "shipments.manage"}

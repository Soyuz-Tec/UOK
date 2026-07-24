from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from uok.kernel.security import Actor
from uok.models_base import utcnow
from uok.module_events import emit_module_event

from uok_shipments_core._internal.persistence.models import Shipment, ShipmentStatusHistory

from .location_gateway import require_active_locations
from .party_gateway import require_active_parties
from .read_service import shipment_response
from .route_gateway import require_matching_active_route
from .schemas import ShipmentCreateRequest, ShipmentTransitionRequest, ShipmentUpdateRequest

_MUTABLE_FIELDS = frozenset({
    "shipper_party_id",
    "consignee_party_id",
    "origin_location_id",
    "destination_location_id",
    "route_definition_id",
    "planned_departure_on",
    "planned_arrival_on",
})
_ALLOWED_TRANSITIONS = {
    "draft": frozenset({"planned", "cancelled"}),
    "planned": frozenset({"in_transit", "cancelled"}),
    "in_transit": frozenset({"arrived"}),
    "arrived": frozenset({"closed"}),
    "closed": frozenset(),
    "cancelled": frozenset(),
}


def create_shipment(
    db: Session,
    actor: Actor,
    request: ShipmentCreateRequest,
    command_id: str,
) -> dict[str, Any]:
    if db.scalar(select(Shipment.id).where(
        Shipment.organization_id == actor.organization_id,
        Shipment.code == request.code,
    )) is not None:
        raise ValueError("shipment code already exists in this organization")
    require_active_parties(db, actor, (request.shipper_party_id, request.consignee_party_id))
    require_active_locations(db, actor, (request.origin_location_id, request.destination_location_id))
    if request.route_definition_id is not None:
        require_matching_active_route(
            db,
            actor,
            request.route_definition_id,
            request.origin_location_id,
            request.destination_location_id,
        )
    now = utcnow()
    row = Shipment(
        organization_id=actor.organization_id,
        code=request.code,
        shipper_party_id=request.shipper_party_id,
        consignee_party_id=request.consignee_party_id,
        origin_location_id=request.origin_location_id,
        destination_location_id=request.destination_location_id,
        route_definition_id=request.route_definition_id,
        planned_departure_on=request.planned_departure_on,
        planned_arrival_on=request.planned_arrival_on,
        created_by_user_id=actor.user_id,
        updated_by_user_id=actor.user_id,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    try:
        db.flush()
    except IntegrityError as exc:
        raise ValueError("shipment code already exists in this organization") from exc
    _emit_shipment_event(db, actor, "ShipmentCreated", row, command_id)
    return shipment_response(db, actor, row, command_id)


def update_shipment(
    db: Session,
    actor: Actor,
    request: ShipmentUpdateRequest,
    command_id: str,
) -> dict[str, Any]:
    row = _locked_shipment(db, actor, request.shipment_id)
    _assert_expected_version(row, request.expected_version)
    if row.status not in {"draft", "planned"}:
        raise ValueError("shipment header can only be updated while draft or planned")
    supplied = _MUTABLE_FIELDS.intersection(request.model_fields_set)
    if not supplied:
        raise ValueError("at least one shipment field is required")
    for field in supplied & {
        "shipper_party_id",
        "consignee_party_id",
        "origin_location_id",
        "destination_location_id",
    }:
        if getattr(request, field) is None:
            raise ValueError(f"{field} cannot be null")

    final = {
        field: getattr(request, field) if field in supplied else getattr(row, field)
        for field in _MUTABLE_FIELDS
    }
    if final["origin_location_id"] == final["destination_location_id"]:
        raise ValueError("origin and destination Locations must be different")
    departure = final["planned_departure_on"]
    arrival = final["planned_arrival_on"]
    if departure is not None and arrival is not None and arrival < departure:
        raise ValueError("planned_arrival_on cannot be earlier than planned_departure_on")

    party_fields = supplied & {"shipper_party_id", "consignee_party_id"}
    if party_fields:
        require_active_parties(
            db,
            actor,
            tuple(str(final[field]) for field in sorted(party_fields)),
        )
    if supplied & {"origin_location_id", "destination_location_id", "route_definition_id"}:
        origin_id = str(final["origin_location_id"])
        destination_id = str(final["destination_location_id"])
        require_active_locations(db, actor, (origin_id, destination_id))
        route_id = final["route_definition_id"]
        if route_id is not None:
            require_matching_active_route(db, actor, str(route_id), origin_id, destination_id)

    changes = {
        field: final[field]
        for field in supplied
        if getattr(row, field) != final[field]
    }
    if not changes:
        raise ValueError("shipment has no changes")
    for field, value in changes.items():
        setattr(row, field, value)
    _touch(row, actor)
    db.flush()
    _emit_shipment_event(
        db,
        actor,
        "ShipmentUpdated",
        row,
        command_id,
        {"changed_fields": sorted(changes)},
    )
    return shipment_response(db, actor, row, command_id)


def transition_shipment_status(
    db: Session,
    actor: Actor,
    request: ShipmentTransitionRequest,
    command_id: str,
) -> dict[str, Any]:
    row = _locked_shipment(db, actor, request.shipment_id)
    _assert_expected_version(row, request.expected_version)
    if request.new_status not in _ALLOWED_TRANSITIONS[row.status]:
        raise ValueError(f"shipment status cannot transition from {row.status} to {request.new_status}")
    previous_status = row.status
    row.status = request.new_status
    _touch(row, actor)
    db.add(ShipmentStatusHistory(
        organization_id=actor.organization_id,
        shipment_id=row.id,
        previous_status=previous_status,
        new_status=row.status,
        reason=request.reason,
        changed_by_user_id=actor.user_id,
        version=row.version,
    ))
    db.flush()
    _emit_shipment_event(
        db,
        actor,
        "ShipmentStatusTransitioned",
        row,
        command_id,
        {
            "previous_status": previous_status,
            "new_status": row.status,
            "reason": request.reason,
        },
    )
    return shipment_response(db, actor, row, command_id)


def _locked_shipment(db: Session, actor: Actor, shipment_id: str) -> Shipment:
    row = db.scalar(select(Shipment).where(
        Shipment.id == shipment_id,
        Shipment.organization_id == actor.organization_id,
    ).with_for_update())
    if row is None:
        raise ValueError("shipment not found")
    return row


def _assert_expected_version(row: Shipment, expected_version: int) -> None:
    if row.version != expected_version:
        raise ValueError(f"shipment changed; expected version {expected_version}, current version {row.version}")


def _touch(row: Shipment, actor: Actor) -> None:
    row.version += 1
    row.updated_by_user_id = actor.user_id
    row.updated_at = utcnow()


def _emit_shipment_event(
    db: Session,
    actor: Actor,
    event_type: str,
    row: Shipment,
    command_id: str,
    extra: dict[str, Any] | None = None,
) -> None:
    emit_module_event(db, actor, event_type, "Shipment", row.id, {
        "correlation_id": command_id,
        "code": row.code,
        "status": row.status,
        "version": row.version,
        "shipper_party_id": row.shipper_party_id,
        "consignee_party_id": row.consignee_party_id,
        "origin_location_id": row.origin_location_id,
        "destination_location_id": row.destination_location_id,
        "route_definition_id": row.route_definition_id,
        "planned_departure_on": (
            None if row.planned_departure_on is None else row.planned_departure_on.isoformat()
        ),
        "planned_arrival_on": (
            None if row.planned_arrival_on is None else row.planned_arrival_on.isoformat()
        ),
        **(extra or {}),
    })


__all__ = ["create_shipment", "transition_shipment_status", "update_shipment"]

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok.kernel.security import Actor

from uok_shipments_core._internal.persistence.models import Shipment, ShipmentStatusHistory

from .location_gateway import location_resolution_response, resolve_locations
from .party_gateway import party_resolution_response, resolve_party
from .route_gateway import resolve_route, route_resolution_response
from .schemas import ShipmentResponse, ShipmentStatusHistoryResponse


def list_shipments(
    db: Session,
    actor: Actor,
    status: str | None = None,
    search: str | None = None,
) -> list[dict[str, Any]]:
    statement = select(Shipment).where(Shipment.organization_id == actor.organization_id)
    if status:
        statement = statement.where(Shipment.status == status)
    if search and search.strip():
        statement = statement.where(Shipment.code.ilike(f"%{search.strip()}%"))
    rows = db.scalars(statement.order_by(Shipment.updated_at.desc(), Shipment.code)).all()
    return _shipment_responses(db, actor, rows)


def get_shipment(db: Session, actor: Actor, shipment_id: str) -> Shipment:
    row = db.scalar(select(Shipment).where(
        Shipment.id == shipment_id,
        Shipment.organization_id == actor.organization_id,
    ))
    if row is None:
        raise ValueError("shipment not found")
    return row


def list_status_history(
    db: Session,
    actor: Actor,
    shipment_id: str,
) -> list[dict[str, Any]]:
    get_shipment(db, actor, shipment_id)
    rows = db.scalars(select(ShipmentStatusHistory).where(
        ShipmentStatusHistory.organization_id == actor.organization_id,
        ShipmentStatusHistory.shipment_id == shipment_id,
    ).order_by(ShipmentStatusHistory.changed_at.desc(), ShipmentStatusHistory.id.desc())).all()
    return [
        ShipmentStatusHistoryResponse.model_validate(row, from_attributes=True).model_dump(mode="json")
        for row in rows
    ]


def shipment_response(
    db: Session,
    actor: Actor,
    row: Shipment,
    correlation_id: str | None = None,
) -> dict[str, Any]:
    result = _shipment_responses(db, actor, [row])[0]
    if correlation_id is not None:
        result["correlation_id"] = correlation_id
    return result


def _shipment_responses(
    db: Session,
    actor: Actor,
    rows: list[Shipment],
) -> list[dict[str, Any]]:
    if not rows:
        return []
    location_ids = list(dict.fromkeys(
        value
        for row in rows
        for value in (row.origin_location_id, row.destination_location_id)
    ))
    locations = resolve_locations(db, actor, location_ids)
    by_location = {value.location_definition_id: value for value in locations}
    return [
        _serialize_shipment(
            row,
            party_resolution_response(resolve_party(db, actor, row.shipper_party_id)),
            party_resolution_response(resolve_party(db, actor, row.consignee_party_id)),
            location_resolution_response(by_location[row.origin_location_id]),
            location_resolution_response(by_location[row.destination_location_id]),
            None if row.route_definition_id is None else route_resolution_response(
                resolve_route(db, actor, row.route_definition_id)
            ),
        )
        for row in rows
    ]


def _serialize_shipment(
    row: Shipment,
    shipper: dict[str, object],
    consignee: dict[str, object],
    origin: dict[str, object],
    destination: dict[str, object],
    route: dict[str, object] | None,
) -> dict[str, Any]:
    response = ShipmentResponse(
        id=row.id,
        code=row.code,
        shipper_party_id=row.shipper_party_id,
        consignee_party_id=row.consignee_party_id,
        origin_location_id=row.origin_location_id,
        destination_location_id=row.destination_location_id,
        route_definition_id=row.route_definition_id,
        planned_departure_on=row.planned_departure_on,
        planned_arrival_on=row.planned_arrival_on,
        status=row.status,
        version=row.version,
        created_by_user_id=row.created_by_user_id,
        updated_by_user_id=row.updated_by_user_id,
        created_at=row.created_at,
        updated_at=row.updated_at,
        shipper=shipper,
        consignee=consignee,
        origin=origin,
        destination=destination,
        route=route,
    )
    return response.model_dump(mode="json")


__all__ = [
    "get_shipment",
    "list_shipments",
    "list_status_history",
    "shipment_response",
]

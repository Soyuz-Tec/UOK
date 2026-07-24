from __future__ import annotations

from sqlalchemy.orm import Session

from uok.kernel.security import Actor
from uok_contacts_core.public_api import PartyReferenceResolution, resolve_party_reference

from .schemas import PartyReferenceResponse


def resolve_party(db: Session, actor: Actor, party_id: str) -> PartyReferenceResolution:
    return resolve_party_reference(db, actor, party_id)


def require_active_parties(
    db: Session,
    actor: Actor,
    party_ids: tuple[str, ...],
) -> tuple[PartyReferenceResolution, ...]:
    resolutions = tuple(resolve_party(db, actor, value) for value in party_ids)
    invalid = [
        (party_id, resolution)
        for party_id, resolution in zip(party_ids, resolutions, strict=True)
        if resolution.status != "ready"
    ]
    if invalid:
        states = ", ".join(f"{party_id}:{resolution.status}" for party_id, resolution in invalid)
        raise ValueError(f"shipment Parties must be active and visible ({states})")
    return resolutions


def party_resolution_response(value: PartyReferenceResolution) -> dict[str, object]:
    return PartyReferenceResponse.model_validate(value, from_attributes=True).model_dump(mode="json")


__all__ = ["party_resolution_response", "require_active_parties", "resolve_party"]

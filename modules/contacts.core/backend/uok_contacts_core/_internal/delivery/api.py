from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from uok.host.database import get_db
from uok.host.security import current_actor
from uok.kernel.security import Actor, require_permission

from uok_contacts_core._internal.delivery.api_schemas import (
    ContactCsvImportRequest,
    ContactNoteRequest,
    ContactRelationshipRequest,
    ContactRelationshipUpdateRequest,
    ContactWriteRequest,
)
from uok_contacts_core._internal.delivery.api_groups import register_group_routes
from uok_contacts_core._internal.delivery.api_system import register_system_routes
from uok_contacts_core._internal.delivery.api_support import require_contacts_module_operational, run_contact_command
from uok_contacts_core._internal.delivery.facade import count_parties, get_party_or_error, import_batch_rows, list_parties, note_rows, relationship_rows, review_queue, review_queue_count, serialize_party

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


@router.get("")
def contacts(
    response: Response,
    query: str = "",
    group_id: str = "",
    status: str = "active",
    review_state: str = "",
    party_type: str = "",
    source: str = Query(default="all", max_length=80),
    quality: str = Query(default="all", pattern="^(all|no_company|duplicate_risk)$"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    sort_by: str = Query(default="updated_at", pattern="^(display_name|updated_at|created_at|status|review_state|party_type|source)$"),
    sort_dir: str = Query(default="desc", pattern="^(asc|desc)$"),
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    require_permission(actor, "contacts.read")
    require_contacts_module_operational(db, actor)
    try:
        response.headers["X-Total-Count"] = str(count_parties(
            db,
            actor,
            query=query,
            group_id=group_id,
            status=status,
            review_state=review_state,
            party_type=party_type,
            source=source,
            quality=quality,
        ))
        return list_parties(
            db,
            actor,
            query=query,
            group_id=group_id,
            status=status,
            review_state=review_state,
            party_type=party_type,
            source=source,
            quality=quality,
            limit=limit,
            offset=offset,
            sort_by=sort_by,
            sort_dir=sort_dir,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc


@router.post("")
def create_contact(req: ContactWriteRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_contact_command(db, actor, "CreateContact", req.model_dump(exclude_none=True))


@router.get("/review-queue")
def contacts_review_queue(
    response: Response,
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    require_permission(actor, "contacts.read")
    require_contacts_module_operational(db, actor)
    response.headers["X-Total-Count"] = str(review_queue_count(db, actor))
    return review_queue(db, actor, limit=limit, offset=offset)


@router.get("/import-batches")
def contacts_import_batches(actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    require_permission(actor, "contacts.read")
    require_contacts_module_operational(db, actor)
    return import_batch_rows(db, actor)


@router.post("/import-csv")
def import_contacts_csv(req: ContactCsvImportRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_contact_command(db, actor, "ImportContactsCsv", req.model_dump(exclude_none=True))


register_group_routes(router)
register_system_routes(router)


@router.get("/{party_id}")
def contact_detail(party_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    require_permission(actor, "contacts.read")
    require_contacts_module_operational(db, actor)
    try:
        return serialize_party(db, get_party_or_error(db, actor, party_id), include_detail=True, actor=actor)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/{party_id}")
def update_contact(party_id: str, req: ContactWriteRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    payload = req.model_dump(exclude_none=True)
    payload["party_id"] = party_id
    return run_contact_command(db, actor, "UpdateContact", payload)


@router.post("/{party_id}/archive")
def archive_contact(party_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_contact_command(db, actor, "ArchiveContact", {"party_id": party_id})


@router.post("/{party_id}/restore")
def restore_contact(party_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_contact_command(db, actor, "RestoreContact", {"party_id": party_id})


@router.post("/{party_id}/purge")
def purge_contact(party_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_contact_command(db, actor, "PurgeContact", {"party_id": party_id})


@router.get("/{party_id}/notes")
def contact_notes(party_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    require_permission(actor, "contacts.read")
    require_contacts_module_operational(db, actor)
    get_party_or_error(db, actor, party_id)
    return note_rows(db, party_id, actor)


@router.post("/{party_id}/notes")
def add_contact_note(party_id: str, req: ContactNoteRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    payload = req.model_dump(exclude_none=True)
    payload["party_id"] = party_id
    return run_contact_command(db, actor, "AddContactNote", payload)


@router.get("/{party_id}/relationships")
def contact_relationships(party_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    require_permission(actor, "contacts.read")
    require_contacts_module_operational(db, actor)
    get_party_or_error(db, actor, party_id)
    return relationship_rows(db, actor.organization_id, party_id, actor)


@router.post("/relationships")
def add_contact_relationship(req: ContactRelationshipRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_contact_command(db, actor, "LinkContactRelationship", req.model_dump(exclude_none=True))


@router.patch("/relationships/{relationship_id}")
def update_contact_relationship(relationship_id: str, req: ContactRelationshipUpdateRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    payload = req.model_dump(exclude_none=True)
    payload["relationship_id"] = relationship_id
    return run_contact_command(db, actor, "UpdateContactRelationship", payload)


@router.delete("/relationships/{relationship_id}")
def remove_contact_relationship(relationship_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_contact_command(db, actor, "RemoveContactRelationship", {"relationship_id": relationship_id})

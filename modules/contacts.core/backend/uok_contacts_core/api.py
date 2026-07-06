from __future__ import annotations

from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from uok.commands import execute_command
from uok.db import get_db
from uok.module_ops import ensure_module_operational
from uok.security import Actor, current_actor, require_permission

from .api_schemas import ContactCsvImportRequest, ContactNoteRequest, ContactRelationshipRequest, ContactWriteRequest
from .facade import get_party_or_error, import_batch_rows, list_parties, note_rows, relationship_rows, review_queue, serialize_party

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


def run_contact_command(db: Session, actor: Actor, command_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    try:
        return execute_command(db, actor, command_type, payload, f"{command_type}:{uuid4()}")["result"]
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc


def require_contacts_module_operational(db: Session, actor: Actor) -> None:
    try:
        ensure_module_operational(db, actor.organization_id, "contacts.core")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc


@router.get("")
def contacts(
    query: str = "",
    status: str = "active",
    review_state: str = "",
    party_type: str = "",
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    require_permission(actor, "contacts.read")
    require_contacts_module_operational(db, actor)
    return list_parties(db, actor, query=query, status=status, review_state=review_state, party_type=party_type)


@router.post("")
def create_contact(req: ContactWriteRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_contact_command(db, actor, "CreateContact", req.model_dump(exclude_none=True))


@router.get("/review-queue")
def contacts_review_queue(actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    require_permission(actor, "contacts.read")
    require_contacts_module_operational(db, actor)
    return review_queue(db, actor)


@router.get("/import-batches")
def contacts_import_batches(actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    require_permission(actor, "contacts.read")
    require_contacts_module_operational(db, actor)
    return import_batch_rows(db, actor)


@router.post("/import-csv")
def import_contacts_csv(req: ContactCsvImportRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_contact_command(db, actor, "ImportContactsCsv", req.model_dump(exclude_none=True))


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

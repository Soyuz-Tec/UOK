from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, Query, Response
from sqlalchemy.orm import Session

from uok.db import get_db
from uok.security import Actor, current_actor, require_permission

from .api_schemas import ContactGroupMembersRequest, ContactGroupUpdateRequest, ContactGroupWriteRequest
from .api_support import require_contacts_module_operational, run_contact_command
from .group_read_model import contact_group_rows


def register_group_routes(router: APIRouter) -> None:
    router.add_api_route("/groups", contact_groups, methods=["GET"])
    router.add_api_route("/groups", create_contact_group, methods=["POST"])
    router.add_api_route("/groups/{group_id}", update_contact_group, methods=["PATCH"])
    router.add_api_route("/groups/{group_id}", archive_contact_group, methods=["DELETE"])
    router.add_api_route("/groups/{group_id}/restore", restore_contact_group, methods=["POST"])
    router.add_api_route("/groups/{group_id}/members", add_contacts_to_group, methods=["POST"])
    router.add_api_route("/groups/{group_id}/members/{party_id}", remove_contact_from_group, methods=["DELETE"])


def contact_groups(
    response: Response,
    kind: str | None = Query(default=None, pattern="^(manual|business_domain|smart_rule)$"),
    include_empty: bool = Query(default=True),
    include_archived: bool = Query(default=False),
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    require_permission(actor, "contacts.read")
    require_contacts_module_operational(db, actor)
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["Vary"] = "Authorization"
    return contact_group_rows(
        db,
        actor,
        kind=kind,
        include_empty=include_empty,
        include_archived=include_archived,
    )


def create_contact_group(
    req: ContactGroupWriteRequest,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return run_contact_command(db, actor, "CreateContactGroup", req.model_dump(exclude_none=True))


def update_contact_group(
    group_id: str,
    req: ContactGroupUpdateRequest,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    payload = req.model_dump(exclude_none=True)
    payload["group_id"] = group_id
    return run_contact_command(db, actor, "UpdateContactGroup", payload)


def archive_contact_group(
    group_id: str,
    response: Response,
    if_match: Annotated[str | None, Header(alias="If-Match")] = None,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    result = run_contact_command(db, actor, "ArchiveContactGroup", {"group_id": group_id}, if_match=if_match)
    response.headers["ETag"] = str(result["etag"])
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["Vary"] = "Authorization"
    return result


def restore_contact_group(
    group_id: str,
    response: Response,
    if_match: Annotated[str | None, Header(alias="If-Match")] = None,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    result = run_contact_command(db, actor, "RestoreContactGroup", {"group_id": group_id}, if_match=if_match)
    response.headers["ETag"] = str(result["etag"])
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["Vary"] = "Authorization"
    return result


def add_contacts_to_group(
    group_id: str,
    req: ContactGroupMembersRequest,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    payload = req.model_dump(exclude_none=True)
    payload["group_id"] = group_id
    return run_contact_command(db, actor, "AddContactsToGroup", payload)


def remove_contact_from_group(
    group_id: str,
    party_id: str,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return run_contact_command(db, actor, "RemoveContactFromGroup", {"group_id": group_id, "party_id": party_id})

from __future__ import annotations

from typing import Annotated, Any

from fastapi import Depends, Header, Response
from sqlalchemy.orm import Session

from uok.db import get_db
from uok.security import Actor, current_actor

from .api_support import run_contact_command
from .system_schemas import ContactLifecycleReasonRequest


def delete_team(
    team_id: str,
    req: ContactLifecycleReasonRequest,
    response: Response,
    if_match: Annotated[str | None, Header(alias="If-Match")] = None,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    result = run_contact_command(
        db,
        actor,
        "DeleteContactTeam",
        {"team_id": team_id, **req.model_dump()},
        if_match=if_match,
    )
    return _lifecycle_response(response, result)


def restore_team(
    team_id: str,
    response: Response,
    if_match: Annotated[str | None, Header(alias="If-Match")] = None,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    result = run_contact_command(db, actor, "RestoreContactTeam", {"team_id": team_id}, if_match=if_match)
    return _lifecycle_response(response, result)


def delete_custom_field(
    field_definition_id: str,
    req: ContactLifecycleReasonRequest,
    response: Response,
    if_match: Annotated[str | None, Header(alias="If-Match")] = None,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    result = run_contact_command(
        db,
        actor,
        "DeleteContactCustomField",
        {"field_definition_id": field_definition_id, **req.model_dump()},
        if_match=if_match,
    )
    return _lifecycle_response(response, result)


def restore_custom_field(
    field_definition_id: str,
    response: Response,
    if_match: Annotated[str | None, Header(alias="If-Match")] = None,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    result = run_contact_command(
        db,
        actor,
        "RestoreContactCustomField",
        {"field_definition_id": field_definition_id},
        if_match=if_match,
    )
    return _lifecycle_response(response, result)


def _lifecycle_response(response: Response, result: dict[str, Any]) -> dict[str, Any]:
    response.headers["ETag"] = str(result["etag"])
    apply_private_no_store_headers(response)
    return result


def apply_private_no_store_headers(response: Response) -> None:
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["Vary"] = "Authorization"

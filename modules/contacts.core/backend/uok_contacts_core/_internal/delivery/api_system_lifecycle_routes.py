from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, Response
from sqlalchemy.orm import Session

from uok.host.database import get_db
from uok.host.security import current_actor
from uok.kernel.security import Actor

from uok_contacts_core._internal.delivery.api_support import run_contact_command
from uok_contacts_core._internal.delivery.api_system_lifecycle import (
    contact_lifecycle_headers,
    contact_lifecycle_payload,
)
from uok_contacts_core._internal.governance.system_schemas import (
    ContactLifecycleReasonRequest,
)


def register_system_lifecycle_routes(router: APIRouter) -> None:
    router.add_api_route("/teams/{team_id}", delete_team, methods=["DELETE"])
    router.add_api_route("/teams/{team_id}/restore", restore_team, methods=["POST"])
    router.add_api_route(
        "/custom-fields/{field_definition_id}",
        delete_custom_field,
        methods=["DELETE"],
    )
    router.add_api_route(
        "/custom-fields/{field_definition_id}/restore",
        restore_custom_field,
        methods=["POST"],
    )


def _run_lifecycle(
    db: Session,
    actor: Actor,
    response: Response,
    command_type: str,
    identifier: str,
    value: str,
    if_match: str | None,
    reason: str | None = None,
) -> dict[str, Any]:
    result = run_contact_command(
        db,
        actor,
        command_type,
        contact_lifecycle_payload(identifier, value, reason=reason),
        if_match=if_match,
    )
    response.headers.update(contact_lifecycle_headers(result))
    return result


def delete_team(
    team_id: str,
    req: ContactLifecycleReasonRequest,
    response: Response,
    if_match: Annotated[str | None, Header(alias="If-Match")] = None,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return _run_lifecycle(
        db, actor, response, "DeleteContactTeam", "team_id", team_id, if_match, req.reason
    )


def restore_team(
    team_id: str,
    response: Response,
    if_match: Annotated[str | None, Header(alias="If-Match")] = None,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return _run_lifecycle(
        db, actor, response, "RestoreContactTeam", "team_id", team_id, if_match
    )


def delete_custom_field(
    field_definition_id: str,
    req: ContactLifecycleReasonRequest,
    response: Response,
    if_match: Annotated[str | None, Header(alias="If-Match")] = None,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return _run_lifecycle(
        db,
        actor,
        response,
        "DeleteContactCustomField",
        "field_definition_id",
        field_definition_id,
        if_match,
        req.reason,
    )


def restore_custom_field(
    field_definition_id: str,
    response: Response,
    if_match: Annotated[str | None, Header(alias="If-Match")] = None,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return _run_lifecycle(
        db,
        actor,
        response,
        "RestoreContactCustomField",
        "field_definition_id",
        field_definition_id,
        if_match,
    )

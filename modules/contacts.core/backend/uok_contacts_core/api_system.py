from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from uok.db import get_db
from uok.security import Actor, current_actor, require_permission

from .api_support import require_contacts_module_operational, run_contact_command
from .contact_exchange import contacts_csv_text, contacts_vcard_text, exportable_contact_rows
from .system_read_model import (
    contact_activity_rows,
    contact_consent_rows,
    contact_custom_field_rows,
    contact_external_identity_rows,
    contact_fact_rows,
    contact_import_row_results,
    contact_interoperability_status,
    contact_saved_view_rows,
    contact_team_rows,
    duplicate_candidate_rows,
    party_custom_value_rows,
    relationship_lookup_rows,
)
from .system_schemas import (
    ContactBulkActionRequest,
    ContactConsentWriteRequest,
    ContactCustomFieldDefinitionRequest,
    ContactCustomFieldValueRequest,
    ContactDuplicateResolutionRequest,
    ContactExternalIdentityWriteRequest,
    ContactFactWriteRequest,
    ContactSavedViewWriteRequest,
    ContactTeamMemberRequest,
    ContactTeamWriteRequest,
    ContactVCardImportRequest,
)


def register_system_routes(router: APIRouter) -> None:
    router.add_api_route("/relationship-options", relationship_options, methods=["GET"])
    router.add_api_route("/teams", teams, methods=["GET"])
    router.add_api_route("/teams", create_team, methods=["POST"])
    router.add_api_route("/teams/{team_id}", update_team, methods=["PATCH"])
    router.add_api_route("/teams/{team_id}/archive", archive_team, methods=["POST"])
    router.add_api_route("/teams/{team_id}/members", add_team_member, methods=["POST"])
    router.add_api_route("/teams/{team_id}/members/{user_id}", remove_team_member, methods=["DELETE"])
    router.add_api_route("/saved-views", saved_views, methods=["GET"])
    router.add_api_route("/saved-views", save_view, methods=["POST"])
    router.add_api_route("/saved-views/{view_id}", update_view, methods=["PATCH"])
    router.add_api_route("/saved-views/{view_id}", delete_view, methods=["DELETE"])
    router.add_api_route("/duplicate-candidates", duplicate_candidates, methods=["GET"])
    router.add_api_route("/duplicate-candidates/refresh", refresh_duplicate_candidates, methods=["POST"])
    router.add_api_route("/duplicate-candidates/{candidate_id}/resolve", resolve_duplicate_candidate, methods=["POST"])
    router.add_api_route("/bulk", bulk_contacts, methods=["POST"])
    router.add_api_route("/export.csv", export_contacts_csv, methods=["GET"])
    router.add_api_route("/export.vcf", export_contacts_vcard, methods=["GET"])
    router.add_api_route("/import-vcard", import_contacts_vcard, methods=["POST"])
    router.add_api_route("/import-batches/{batch_id}/rows", import_batch_rows, methods=["GET"])
    router.add_api_route("/import-batches/{batch_id}/rollback", rollback_import_batch, methods=["POST"])
    router.add_api_route("/interoperability", interoperability_status, methods=["GET"])
    router.add_api_route("/custom-fields", custom_fields, methods=["GET"])
    router.add_api_route("/custom-fields", define_custom_field, methods=["POST"])
    router.add_api_route("/{party_id}/facts", facts, methods=["GET"])
    router.add_api_route("/{party_id}/facts", save_fact, methods=["POST"])
    router.add_api_route("/{party_id}/facts/{fact_id}", update_fact, methods=["PATCH"])
    router.add_api_route("/{party_id}/facts/{fact_id}", remove_fact, methods=["DELETE"])
    router.add_api_route("/{party_id}/consents", consents, methods=["GET"])
    router.add_api_route("/{party_id}/consents", record_consent, methods=["POST"])
    router.add_api_route("/{party_id}/activity", activity, methods=["GET"])
    router.add_api_route("/{party_id}/external-identities", external_identities, methods=["GET"])
    router.add_api_route("/{party_id}/external-identities", link_external_identity, methods=["POST"])
    router.add_api_route("/{party_id}/custom-fields", custom_values, methods=["GET"])
    router.add_api_route("/{party_id}/custom-fields/{field_definition_id}", set_custom_value, methods=["PUT"])


def _ready(db: Session, actor: Actor, permission: str) -> None:
    require_permission(actor, permission)
    require_contacts_module_operational(db, actor)


def facts(party_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    _ready(db, actor, "contacts.read")
    return _read(lambda: contact_fact_rows(db, actor, party_id))


def save_fact(party_id: str, req: ContactFactWriteRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_contact_command(db, actor, "UpsertContactFact", {"party_id": party_id, **req.model_dump()})


def update_fact(party_id: str, fact_id: str, req: ContactFactWriteRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_contact_command(db, actor, "UpsertContactFact", {"party_id": party_id, "fact_id": fact_id, **req.model_dump()})


def remove_fact(party_id: str, fact_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_contact_command(db, actor, "RemoveContactFact", {"party_id": party_id, "fact_id": fact_id})


def consents(party_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    _ready(db, actor, "contacts.consent")
    return _read(lambda: contact_consent_rows(db, actor, party_id))


def record_consent(party_id: str, req: ContactConsentWriteRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_contact_command(db, actor, "RecordContactConsent", {"party_id": party_id, **req.model_dump()})


def teams(include_archived: bool = False, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    _ready(db, actor, "contacts.read")
    return contact_team_rows(db, actor, include_archived)


def create_team(req: ContactTeamWriteRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_contact_command(db, actor, "CreateContactTeam", req.model_dump())


def update_team(team_id: str, req: ContactTeamWriteRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_contact_command(db, actor, "UpdateContactTeam", {"team_id": team_id, **req.model_dump()})


def archive_team(team_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_contact_command(db, actor, "UpdateContactTeam", {"team_id": team_id, "status": "archived"})


def add_team_member(team_id: str, req: ContactTeamMemberRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_contact_command(db, actor, "AddContactTeamMember", {"team_id": team_id, **req.model_dump()})


def remove_team_member(team_id: str, user_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_contact_command(db, actor, "RemoveContactTeamMember", {"team_id": team_id, "user_id": user_id})


def saved_views(actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    _ready(db, actor, "contacts.read")
    return contact_saved_view_rows(db, actor)


def save_view(req: ContactSavedViewWriteRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_contact_command(db, actor, "SaveContactView", req.model_dump())


def update_view(view_id: str, req: ContactSavedViewWriteRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_contact_command(db, actor, "SaveContactView", {"view_id": view_id, **req.model_dump()})


def delete_view(view_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_contact_command(db, actor, "DeleteContactView", {"view_id": view_id})


def activity(party_id: str, response: Response, limit: int = Query(default=50, ge=1, le=200), offset: int = Query(default=0, ge=0), actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    _ready(db, actor, "contacts.read")
    rows, total = _read(lambda: contact_activity_rows(db, actor, party_id, limit=limit, offset=offset))
    response.headers["X-Total-Count"] = str(total)
    return rows


def relationship_options(query: str = Query(..., min_length=2, max_length=120), exclude_party_id: str = Query(default="", max_length=80), limit: int = Query(default=20, ge=1, le=50), actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    _ready(db, actor, "contacts.read")
    return relationship_lookup_rows(db, actor, query, exclude_party_id, limit)


def duplicate_candidates(response: Response, status: str = Query(default="open", pattern="^(open|ignored|merged|not_duplicate|stale)$"), limit: int = Query(default=100, ge=1, le=200), offset: int = Query(default=0, ge=0), actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    _ready(db, actor, "contacts.dedupe")
    rows, total = duplicate_candidate_rows(db, actor, status, limit, offset)
    response.headers["X-Total-Count"] = str(total)
    return rows


def refresh_duplicate_candidates(actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_contact_command(db, actor, "RefreshContactDuplicateCandidates", {})


def resolve_duplicate_candidate(candidate_id: str, req: ContactDuplicateResolutionRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_contact_command(db, actor, "ResolveContactDuplicateCandidate", {"candidate_id": candidate_id, **req.model_dump()})


def bulk_contacts(req: ContactBulkActionRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_contact_command(db, actor, "BulkUpdateContacts", req.model_dump())


def export_contacts_csv(party_id: list[str] = Query(default=[]), actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> Response:
    _ready(db, actor, "contacts.export")
    rows, restricted = exportable_contact_rows(db, actor, party_id or None)
    return Response(
        content=contacts_csv_text(rows),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="uok-contacts.csv"', "X-Consent-Restricted-Count": str(restricted)},
    )


def export_contacts_vcard(party_id: list[str] = Query(default=[]), actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> Response:
    _ready(db, actor, "contacts.export")
    rows, restricted = exportable_contact_rows(db, actor, party_id or None)
    return Response(
        content=contacts_vcard_text(rows),
        media_type="text/vcard; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="uok-contacts.vcf"', "X-Consent-Restricted-Count": str(restricted)},
    )


def import_contacts_vcard(req: ContactVCardImportRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_contact_command(db, actor, "ImportContactsVCard", req.model_dump())


def import_batch_rows(batch_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    _ready(db, actor, "contacts.import")
    return _read(lambda: contact_import_row_results(db, actor, batch_id))


def rollback_import_batch(batch_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_contact_command(db, actor, "RollbackContactImport", {"batch_id": batch_id})


def interoperability_status(actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    _ready(db, actor, "contacts.read")
    return contact_interoperability_status()


def external_identities(party_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    _ready(db, actor, "contacts.read")
    return _read(lambda: contact_external_identity_rows(db, actor, party_id))


def link_external_identity(party_id: str, req: ContactExternalIdentityWriteRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_contact_command(db, actor, "LinkContactExternalIdentity", {"party_id": party_id, **req.model_dump()})


def custom_fields(include_archived: bool = False, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    _ready(db, actor, "contacts.read")
    return contact_custom_field_rows(db, actor, include_archived)


def define_custom_field(req: ContactCustomFieldDefinitionRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_contact_command(db, actor, "DefineContactCustomField", req.model_dump())


def custom_values(party_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    _ready(db, actor, "contacts.read")
    return _read(lambda: party_custom_value_rows(db, actor, party_id))


def set_custom_value(party_id: str, field_definition_id: str, req: ContactCustomFieldValueRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_contact_command(db, actor, "SetContactCustomFieldValue", {"party_id": party_id, "field_definition_id": field_definition_id, **req.model_dump()})


def _read(operation):
    try:
        return operation()
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

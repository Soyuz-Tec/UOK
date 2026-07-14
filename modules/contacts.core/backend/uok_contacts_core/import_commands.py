from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from .facade import (
    clean_text,
)
from uok.security import Actor
from uok.util import dumps, loads


AUTOMATED_MARKETING_TERMS = ("no-reply", "noreply", "newsletter", "marketing", "promotion", "unsubscribe")


def _csv_payload(row: dict[str, Any], batch_id: str, filename: str, row_number: int) -> dict[str, Any]:
    payload = {key.strip().lower(): value for key, value in row.items() if key is not None}
    return {
        "party_type": clean_text(payload.get("party_type")),
        "display_name": clean_text(payload.get("display_name") or payload.get("name")),
        "given_name": clean_text(payload.get("given_name") or payload.get("first_name")),
        "family_name": clean_text(payload.get("family_name") or payload.get("last_name")),
        "organization_name": clean_text(payload.get("organization_name") or payload.get("company") or payload.get("company_name")),
        "email": clean_text(payload.get("email")),
        "phone": clean_text(payload.get("phone")),
        "website": clean_text(payload.get("website")),
        "address": clean_text(payload.get("address")),
        "title": clean_text(payload.get("title")),
        "note": clean_text(payload.get("note") or payload.get("notes")),
        "source": "csv_import",
        "client_reference": _csv_row_reference(filename, row_number),
        "import_batch_id": batch_id,
        "review_state": "needs_review",
    }


def cmd_import_contacts_csv(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    from .guided_import import guided_csv_import

    return guided_csv_import(db, actor, payload, command_id)


def _attach_import_evidence(party, batch_id: str, filename: str, row_number: int) -> None:
    attrs = loads(party.attrs_json, {})
    attrs["source_evidence"] = {"batch_id": batch_id, "filename": filename, "row": row_number}
    party.attrs_json = dumps(attrs)


def _csv_row_reference(filename: str, row_number: int) -> str:
    trimmed = filename[:90].rstrip()
    return f"csv:{trimmed}:row:{row_number}"


def _looks_like_automated_marketing(row: dict[str, Any]) -> bool:
    values = [clean_text(value).lower() for value in row.values()]
    haystack = " ".join(values)
    email = next((value for key, value in row.items() if str(key or "").strip().lower() == "email"), "")
    local_part = clean_text(email).split("@", 1)[0].lower()
    return any(term in local_part or term in haystack for term in AUTOMATED_MARKETING_TERMS)

from __future__ import annotations

import csv
from io import StringIO
from typing import Any

from sqlalchemy.orm import Session

from .facade import (
    MAX_CSV_IMPORT_BYTES,
    MAX_CSV_IMPORT_ROWS,
    MAX_IMPORT_RESULT_ITEMS,
    bounded_text,
    clean_text,
)
from .command_support import _create_party, _emit_event
from .models import ContactImportBatch
from uok.security import Actor
from uok.util import dumps


def _csv_payload(row: dict[str, Any], batch_id: str) -> dict[str, Any]:
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
        "import_batch_id": batch_id,
        "review_state": "needs_review",
    }


def cmd_import_contacts_csv(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    csv_text = clean_text(payload.get("csv_text"))
    if not csv_text:
        raise ValueError("csv_text is required")
    if len(csv_text.encode("utf-8")) > MAX_CSV_IMPORT_BYTES:
        raise ValueError(f"csv_text must be {MAX_CSV_IMPORT_BYTES} bytes or fewer")
    filename = bounded_text(payload.get("filename"), "filename") or "contacts.csv"
    batch = ContactImportBatch(
        organization_id=actor.organization_id,
        created_by_user_id=actor.user_id,
        source_filename=filename,
        status="completed",
        attrs_json=dumps({"filename": filename}),
    )
    db.add(batch)
    db.flush()
    imported: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    reader = csv.DictReader(StringIO(csv_text))
    for row_index, (row_number, row) in enumerate(enumerate(reader, start=2), start=1):
        if row_index > MAX_CSV_IMPORT_ROWS:
            raise ValueError(f"CSV import is limited to {MAX_CSV_IMPORT_ROWS} rows")
        try:
            party, duplicate_candidates = _create_party(db, actor, _csv_payload(row, batch.id), "csv_import")
            imported.append({"row": row_number, "party_id": party.id, "display_name": party.display_name, "duplicates": duplicate_candidates})
        except ValueError as exc:
            failures.append({"row": row_number, "error": str(exc)})
    imported_sample = imported[:MAX_IMPORT_RESULT_ITEMS]
    failure_sample = failures[:MAX_IMPORT_RESULT_ITEMS]
    result_truncated = len(imported) > MAX_IMPORT_RESULT_ITEMS or len(failures) > MAX_IMPORT_RESULT_ITEMS
    batch.imported_count = len(imported)
    batch.failed_count = len(failures)
    batch.attrs_json = dumps({"filename": filename, "imported": imported_sample, "failures": failure_sample, "result_truncated": result_truncated})
    db.flush()
    _emit_event(db, actor, "ContactsImported", "ContactImportBatch", batch.id, {
        "filename": filename,
        "imported_count": batch.imported_count,
        "failed_count": batch.failed_count,
    })
    return {
        "batch_id": batch.id,
        "filename": filename,
        "imported_count": batch.imported_count,
        "failed_count": batch.failed_count,
        "imported": imported_sample,
        "failures": failure_sample,
        "result_truncated": result_truncated,
    }

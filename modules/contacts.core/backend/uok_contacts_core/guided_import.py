from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok.data_exchange import csv_dict_rows
from uok.security import Actor
from uok.util import dumps, loads

from .command_support import _create_party, _emit_event
from .contact_exchange import parse_vcards
from .fact_commands import sync_legacy_payload_facts
from .guided_import_support import (
    IMPORT_MODES,
    add_vcard_facts,
    find_import_match,
    idempotent_import_party,
    import_error_code,
    mapped_row,
    new_batch,
    party_snapshot,
    party_snapshot_fingerprint,
    resolved_operation,
    restore_party_snapshot,
    update_imported_party,
    validated_mapping,
    vcard_contact_payload,
)
from .import_commands import _attach_import_evidence, _csv_payload, _looks_like_automated_marketing
from .models import ContactImportBatch, Party, utcnow
from .system_command_support import row_checksum
from .system_models import ContactImportRow
from .validation import MAX_CSV_IMPORT_BYTES, MAX_CSV_IMPORT_ROWS, clean_text


def guided_csv_import(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    csv_text = clean_text(payload.get("csv_text"))
    if not csv_text:
        raise ValueError("csv_text is required")
    mode = str(payload.get("mode") or "create").strip().lower()
    if mode not in IMPORT_MODES:
        raise ValueError("CSV import mode must be create, update, or upsert")
    mapping = validated_mapping(payload.get("mapping"))
    dry_run = bool(payload.get("dry_run"))
    filename = str(payload.get("filename") or "contacts.csv").strip()[:240]
    source_rows = csv_dict_rows(csv_text, MAX_CSV_IMPORT_BYTES, MAX_CSV_IMPORT_ROWS)
    batch = new_batch(db, actor, filename, "preview" if dry_run else "running", {
        "dry_run": dry_run, "mapping": mapping, "mode": mode,
    })
    imported: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    counts = {"skipped": 0, "updated": 0, "validated": 0}
    for row_number, raw_row in source_rows:
        _apply_csv_row(
            db, actor, batch, filename, mode, mapping, dry_run,
            row_number, raw_row, imported, failures, counts,
        )
    return _finalize_csv_batch(db, actor, batch, filename, mode, mapping, dry_run, imported, failures, counts)


def _apply_csv_row(
    db: Session,
    actor: Actor,
    batch: ContactImportBatch,
    filename: str,
    mode: str,
    mapping: dict[str, str],
    dry_run: bool,
    row_number: int,
    raw_row: dict[str, Any],
    imported: list[dict[str, Any]],
    failures: list[dict[str, Any]],
    counts: dict[str, int],
) -> None:
    mapped = mapped_row(raw_row, mapping)
    contact_payload = _csv_payload(mapped, batch.id, filename, row_number)
    result_row = ContactImportRow(
        organization_id=actor.organization_id,
        batch_id=batch.id,
        row_number=row_number,
        checksum=row_checksum(mapped),
        requested_operation=mode,
        status="pending",
        input_json=dumps(mapped),
        created_at=utcnow(),
        updated_at=utcnow(),
    )
    db.add(result_row)
    try:
        if _looks_like_automated_marketing(mapped):
            raise ValueError("automated marketing contact rejected")
        idempotent_party = idempotent_import_party(db, actor, result_row.checksum)
        if idempotent_party:
            _skip_idempotent_row(result_row, idempotent_party, dry_run, counts)
            return
        match = find_import_match(db, actor, contact_payload)
        result_row.matched_party_id = match.id if match else None
        operation = resolved_operation(mode, match)
        if dry_run:
            result_row.status, result_row.applied_operation = "validated", "none"
            result_row.result_json = dumps({"planned_operation": operation, "matched_party_id": result_row.matched_party_id})
            counts["validated"] += 1
            return
        _execute_csv_operation(
            db, actor, result_row, contact_payload, match, operation,
            batch.id, filename, row_number, imported, counts,
        )
    except ValueError as exc:
        result_row.status = "failed"
        result_row.error_code = import_error_code(str(exc))
        result_row.error_message = str(exc)[:2_000]
        failures.append({"row": row_number, "error": str(exc)})
    finally:
        result_row.updated_at = utcnow()


def _skip_idempotent_row(
    result_row: ContactImportRow,
    party: Party,
    dry_run: bool,
    counts: dict[str, int],
) -> None:
    result_row.matched_party_id = party.id
    result_row.status = "validated" if dry_run else "skipped"
    result_row.applied_operation = "none"
    result_row.result_json = dumps({"planned_operation": "skip", "idempotent_party_id": party.id})
    counts["validated" if dry_run else "skipped"] += 1


def _execute_csv_operation(
    db: Session,
    actor: Actor,
    result_row: ContactImportRow,
    payload: dict[str, Any],
    match: Party | None,
    operation: str,
    batch_id: str,
    filename: str,
    row_number: int,
    imported: list[dict[str, Any]],
    counts: dict[str, int],
) -> None:
    if operation == "create":
        party, duplicate_candidates = _create_party(db, actor, payload, "csv_import")
        sync_legacy_payload_facts(db, actor, party, payload)
        _attach_import_evidence(party, batch_id, filename, row_number)
        result_row.party_id, result_row.applied_operation, result_row.status = party.id, "create", "applied"
        result_row.result_json = dumps({
            "after_fingerprint": party_snapshot_fingerprint(party_snapshot(db, party)),
            "duplicates": duplicate_candidates,
        })
        imported.append({"row": row_number, "party_id": party.id, "display_name": party.display_name, "duplicates": duplicate_candidates})
        return
    assert match is not None
    before = party_snapshot(db, match)
    update_imported_party(db, actor, match, payload, batch_id, filename, row_number)
    result_row.party_id, result_row.applied_operation, result_row.status = match.id, "update", "applied"
    result_row.result_json = dumps({
        "after_fingerprint": party_snapshot_fingerprint(party_snapshot(db, match)),
        "before": before,
    })
    imported.append({"row": row_number, "party_id": match.id, "display_name": match.display_name, "updated": True})
    counts["updated"] += 1


def _finalize_csv_batch(
    db: Session,
    actor: Actor,
    batch: ContactImportBatch,
    filename: str,
    mode: str,
    mapping: dict[str, str],
    dry_run: bool,
    imported: list[dict[str, Any]],
    failures: list[dict[str, Any]],
    counts: dict[str, int],
) -> dict[str, Any]:
    batch.imported_count, batch.failed_count = len(imported), len(failures)
    batch.status = "preview" if dry_run else ("completed_with_errors" if failures else "completed")
    batch.attrs_json = dumps({"dry_run": dry_run, "mapping": mapping, "mode": mode, **{f"{key}_count": value for key, value in counts.items()}})
    db.flush()
    event_payload = {
        "filename": filename, "imported_count": len(imported), "failed_count": len(failures),
        **{f"{key}_count": value for key, value in counts.items()},
    }
    _emit_event(db, actor, "ContactsImportPreviewed" if dry_run else "ContactsImported", "ContactImportBatch", batch.id, event_payload)
    return {
        "batch_id": batch.id, "filename": filename, "mode": mode, "dry_run": dry_run,
        "imported_count": len(imported), "failed_count": len(failures),
        **{f"{key}_count": value for key, value in counts.items()},
        "imported": imported[:100], "failures": failures[:100],
        "result_truncated": len(imported) > 100 or len(failures) > 100,
    }


def guided_vcard_import(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    cards = parse_vcards(str(payload.get("vcard_text") or ""))
    dry_run = bool(payload.get("dry_run"))
    batch = new_batch(db, actor, "contacts.vcf", "preview" if dry_run else "running", {"dry_run": dry_run, "format": "vcard"})
    imported: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    for index, card in enumerate(cards, start=1):
        _apply_vcard_row(db, actor, batch, card, index, dry_run, imported, failures)
    batch.imported_count, batch.failed_count = len(imported), len(failures)
    batch.status = "preview" if dry_run else ("completed_with_errors" if failures else "completed")
    db.flush()
    validated_count = len(cards) if dry_run else 0
    _emit_event(db, actor, "ContactsVCardPreviewed" if dry_run else "ContactsVCardImported", "ContactImportBatch", batch.id, {
        "imported_count": len(imported), "failed_count": len(failures), "validated_count": validated_count,
    })
    return {"batch_id": batch.id, "dry_run": dry_run, "validated_count": validated_count, "imported_count": len(imported), "failed_count": len(failures), "imported": imported, "failures": failures}


def _apply_vcard_row(db: Session, actor: Actor, batch: ContactImportBatch, card: dict[str, Any], index: int, dry_run: bool, imported: list[dict[str, Any]], failures: list[dict[str, Any]]) -> None:
    payload_row = vcard_contact_payload(card, batch.id, index)
    row = ContactImportRow(
        organization_id=actor.organization_id, batch_id=batch.id, row_number=index,
        checksum=row_checksum(card), requested_operation="create",
        status="validated" if dry_run else "pending", input_json=dumps(card),
        created_at=utcnow(), updated_at=utcnow(),
    )
    db.add(row)
    if dry_run:
        return
    try:
        party, candidates = _create_party(db, actor, payload_row, "vcard")
        sync_legacy_payload_facts(db, actor, party, payload_row)
        add_vcard_facts(db, actor, party, card)
        row.party_id, row.applied_operation, row.status = party.id, "create", "applied"
        row.result_json = dumps({
            "after_fingerprint": party_snapshot_fingerprint(party_snapshot(db, party)),
            "duplicates": candidates,
        })
        imported.append({"row": index, "party_id": party.id, "display_name": party.display_name})
    except ValueError as exc:
        row.status, row.error_code, row.error_message = "failed", import_error_code(str(exc)), str(exc)[:2_000]
        failures.append({"row": index, "error": str(exc)})


def rollback_contact_import(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    batch = db.get(ContactImportBatch, str(payload.get("batch_id") or ""))
    if not batch or batch.organization_id != actor.organization_id:
        raise ValueError("contact import batch not found")
    if batch.status == "rolled_back":
        return {"batch_id": batch.id, "rolled_back_count": 0, "already_rolled_back": True}
    rows = db.scalars(select(ContactImportRow).where(
        ContactImportRow.organization_id == actor.organization_id,
        ContactImportRow.batch_id == batch.id,
        ContactImportRow.status == "applied",
    ).order_by(
        ContactImportRow.row_number.desc(),
        ContactImportRow.created_at.desc(),
        ContactImportRow.id.desc(),
    )).all()
    count = 0
    for row in rows:
        party = db.get(Party, row.party_id) if row.party_id else None
        if not party or party.organization_id != actor.organization_id:
            continue
        result = loads(row.result_json, {})
        expected_fingerprint = str(result.get("after_fingerprint") or "")
        current_fingerprint = party_snapshot_fingerprint(party_snapshot(db, party))
        if not expected_fingerprint or current_fingerprint != expected_fingerprint:
            raise ValueError("contact changed after import; rollback refused")
        if row.applied_operation == "create":
            party.status, party.archived_at = "archived", utcnow()
        elif row.applied_operation == "update":
            restore_party_snapshot(db, actor, party, result.get("before", {}))
        else:
            continue
        party.updated_at, row.status, row.updated_at = utcnow(), "rolled_back", utcnow()
        count += 1
    batch.status = "rolled_back"
    attrs = loads(batch.attrs_json, {})
    attrs.update({"rolled_back_count": count, "rolled_back_by": actor.user_id})
    batch.attrs_json = dumps(attrs)
    _emit_event(db, actor, "ContactsImportRolledBack", "ContactImportBatch", batch.id, {"rolled_back_count": count})
    return {"batch_id": batch.id, "rolled_back_count": count}

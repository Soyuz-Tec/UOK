from __future__ import annotations

import csv
from io import StringIO
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from uok.data_exchange import safe_spreadsheet_cell
from uok.security import Actor
from uok.util import loads

from uok_contacts_core._internal.registry.access import readable_party_filter
from uok_contacts_core._internal.persistence.models import Party, utcnow
from uok_contacts_core._internal.persistence.system_models import ContactConsentRecord, PartyFact

EXPORT_FIELDS = (
    "id", "party_type", "display_name", "email", "phone", "organization_name",
    "title", "website", "address", "tags", "source", "review_state",
)


def exportable_contact_rows(
    db: Session,
    actor: Actor,
    party_ids: list[str] | None = None,
) -> tuple[list[dict[str, Any]], int]:
    stmt = select(Party).where(
        Party.organization_id == actor.organization_id,
        Party.status == "active",
    )
    if party_ids:
        stmt = stmt.where(Party.id.in_(party_ids))
    allowed = readable_party_filter(actor, db)
    rows: list[dict[str, Any]] = []
    restricted = 0
    for party in db.scalars(stmt.order_by(Party.display_name.asc(), Party.id.asc())).all():
        if not allowed(party):
            continue
        exclude_contact, restricted_fact_types = _export_restrictions(db, party)
        if exclude_contact:
            restricted += 1
            continue
        if restricted_fact_types:
            restricted += 1
        attrs = loads(party.attrs_json, {})
        facts = [fact for fact in db.scalars(select(PartyFact).where(
            PartyFact.organization_id == actor.organization_id,
            PartyFact.party_id == party.id,
        ).order_by(PartyFact.is_primary.desc(), PartyFact.created_at.asc())).all()
            if fact.fact_type not in restricted_fact_types
        ]
        primary = _primary_facts(facts)
        rows.append({
            "id": party.id,
            "party_type": party.party_type,
            "display_name": party.display_name,
            "email": "" if "email" in restricted_fact_types else primary.get("email", attrs.get("email", "")),
            "phone": "" if "phone" in restricted_fact_types else primary.get("phone", attrs.get("phone", "")),
            "organization_name": attrs.get("organization_name", attrs.get("company_name", "")),
            "title": attrs.get("title", ""),
            "website": primary.get("url", attrs.get("website", "")),
            "address": "" if "address" in restricted_fact_types else primary.get("address", attrs.get("address", "")),
            "tags": ", ".join(fact.value_text for fact in facts if fact.fact_type == "tag") or attrs.get("tags", ""),
            "source": party.source,
            "review_state": party.review_state,
            "facts": facts,
        })
    return rows, restricted


def contacts_csv_text(rows: list[dict[str, Any]]) -> str:
    output = StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=EXPORT_FIELDS, lineterminator="\r\n")
    writer.writeheader()
    for row in rows:
        writer.writerow({field: safe_spreadsheet_cell(row.get(field, "")) for field in EXPORT_FIELDS})
    return output.getvalue()


def contacts_vcard_text(rows: list[dict[str, Any]]) -> str:
    cards: list[str] = []
    for row in rows:
        lines = ["BEGIN:VCARD", "VERSION:4.0", f"UID:{_vcard_escape(row['id'])}", f"FN:{_vcard_escape(row['display_name'])}"]
        if row.get("party_type") == "organization":
            lines.append("KIND:org")
            lines.append(f"ORG:{_vcard_escape(row['display_name'])}")
        elif row.get("organization_name"):
            lines.append(f"ORG:{_vcard_escape(row['organization_name'])}")
        if row.get("title"):
            lines.append(f"TITLE:{_vcard_escape(row['title'])}")
        facts: list[PartyFact] = row.get("facts", [])
        for fact in facts:
            value = _vcard_escape(fact.value_text)
            preferred = ";PREF=1" if fact.is_primary else ""
            label = _vcard_escape(fact.label.upper())
            if fact.fact_type == "email":
                lines.append(f"EMAIL;TYPE={label}{preferred}:{value}")
            elif fact.fact_type == "phone":
                lines.append(f"TEL;TYPE={label}{preferred}:{value}")
            elif fact.fact_type == "url":
                lines.append(f"URL;TYPE={label}{preferred}:{value}")
            elif fact.fact_type == "address":
                lines.append(f"ADR;TYPE={label}{preferred}:;;{value};;;;")
            elif fact.fact_type == "date" and fact.label == "birthday":
                lines.append(f"BDAY:{value}")
        if not any(fact.fact_type == "email" for fact in facts) and row.get("email"):
            lines.append(f"EMAIL;PREF=1:{_vcard_escape(row['email'])}")
        if not any(fact.fact_type == "phone" for fact in facts) and row.get("phone"):
            lines.append(f"TEL;PREF=1:{_vcard_escape(row['phone'])}")
        if not any(fact.fact_type == "url" for fact in facts) and row.get("website"):
            lines.append(f"URL;PREF=1:{_vcard_escape(row['website'])}")
        if row.get("tags"):
            lines.append(f"CATEGORIES:{_vcard_escape(row['tags'])}")
        lines.extend(["END:VCARD", ""])
        cards.extend(_fold_vcard_line(line) for line in lines)
    return "\r\n".join(cards)


def parse_vcards(text: str, max_cards: int = 1_000) -> list[dict[str, Any]]:
    if len(text.encode("utf-8")) > 2_000_000:
        raise ValueError("vCard import must be 2000000 bytes or fewer")
    unfolded: list[str] = []
    for raw in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        if raw.startswith((" ", "\t")) and unfolded:
            unfolded[-1] += raw[1:]
        else:
            unfolded.append(raw)
    cards: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    for line in unfolded:
        upper = line.upper()
        if upper == "BEGIN:VCARD":
            if current is not None:
                raise ValueError("nested vCard records are not supported")
            current = {"emails": [], "phones": [], "urls": [], "addresses": [], "tags": []}
            continue
        if upper == "END:VCARD":
            if current is None:
                raise ValueError("vCard END without BEGIN")
            if not current.get("display_name"):
                raise ValueError("each vCard requires FN")
            cards.append(current)
            current = None
            if len(cards) > max_cards:
                raise ValueError(f"vCard import is limited to {max_cards} records")
            continue
        if current is None or ":" not in line:
            continue
        head, raw_value = line.split(":", 1)
        parts = head.split(";")
        field = parts[0].upper()
        parameters = ";".join(parts[1:]).upper()
        label = _vcard_label(parameters)
        value = _vcard_unescape(raw_value).strip()
        preferred = "PREF=1" in parameters or ";PREF" in f";{parameters}"
        if field == "FN":
            current["display_name"] = value
        elif field == "ORG":
            current["organization_name"] = value.split(";", 1)[0]
        elif field == "KIND" and value.lower() == "org":
            current["party_type"] = "organization"
        elif field == "TITLE":
            current["title"] = value
        elif field == "EMAIL":
            current["emails"].append({"value": value, "label": label, "is_primary": preferred})
        elif field == "TEL":
            current["phones"].append({"value": value.removeprefix("tel:"), "label": label, "is_primary": preferred})
        elif field == "URL":
            current["urls"].append({"value": value, "label": label, "is_primary": preferred})
        elif field == "ADR":
            current["addresses"].append({"value": " ".join(part for part in value.split(";") if part), "label": label, "is_primary": preferred})
        elif field == "BDAY":
            current["birthday"] = value
        elif field == "NOTE":
            current["note"] = value
        elif field == "CATEGORIES":
            current["tags"].extend(part.strip() for part in value.split(",") if part.strip())
        elif field == "UID":
            current["external_id"] = value
    if current is not None:
        raise ValueError("vCard record is missing END:VCARD")
    if not cards:
        raise ValueError("no vCard records found")
    return cards


def _export_restrictions(db: Session, party: Party) -> tuple[bool, set[str]]:
    now = utcnow()
    records = db.scalars(select(ContactConsentRecord).where(
        ContactConsentRecord.organization_id == party.organization_id,
        ContactConsentRecord.party_id == party.id,
        ContactConsentRecord.purpose.in_(("directory_export", "all")),
        ContactConsentRecord.effective_at <= now,
        or_(ContactConsentRecord.expires_at.is_(None), ContactConsentRecord.expires_at > now),
    ).order_by(ContactConsentRecord.effective_at.desc(), ContactConsentRecord.created_at.desc())).all()
    latest_by_channel: dict[str, ContactConsentRecord] = {}
    for record in records:
        latest_by_channel.setdefault(record.channel, record)
    restrictive = {"denied", "revoked"}
    any_decision = latest_by_channel.get("any")
    if any_decision and any_decision.status in restrictive:
        return True, set()
    restricted_channels = {
        channel for channel, record in latest_by_channel.items()
        if channel != "any" and record.status in restrictive
    }
    if "in_person" in restricted_channels:
        return True, set()
    fact_types: set[str] = set()
    if "email" in restricted_channels:
        fact_types.add("email")
    if restricted_channels.intersection({"phone", "sms"}):
        fact_types.add("phone")
    if "post" in restricted_channels:
        fact_types.add("address")
    return False, fact_types


def _primary_facts(facts: list[PartyFact]) -> dict[str, str]:
    values: dict[str, str] = {}
    for fact in facts:
        if fact.fact_type not in values or fact.is_primary:
            values[fact.fact_type] = fact.value_text
    return values


def _vcard_escape(value: Any) -> str:
    return str(value or "").replace("\\", "\\\\").replace("\n", "\\n").replace(";", "\\;").replace(",", "\\,")


def _vcard_unescape(value: str) -> str:
    return value.replace("\\n", "\n").replace("\\N", "\n").replace("\\,", ",").replace("\\;", ";").replace("\\\\", "\\")


def _fold_vcard_line(line: str) -> str:
    if len(line.encode("utf-8")) <= 75:
        return line
    chunks: list[str] = []
    current = ""
    for char in line:
        if len((current + char).encode("utf-8")) > 73:
            chunks.append(current)
            current = char
        else:
            current += char
    chunks.append(current)
    return "\r\n ".join(chunks)


def _vcard_label(parameters: str) -> str:
    for parameter in parameters.split(";"):
        if parameter.startswith("TYPE="):
            return parameter.split("=", 1)[1].split(",", 1)[0].lower()
    return "work"

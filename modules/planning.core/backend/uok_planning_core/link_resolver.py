from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import PlanningLink
from uok.models import CalendarEvent, CommunicationThread, Party, ReportArtifact
from uok.module_dependencies import OPERATIONAL_STATUSES, module_record
from uok.security import Actor, has_permission

LINK_TARGET_KINDS = (
    "operation", "gate", "evidence", "party", "shipment", "document",
    "location", "asset", "agreement", "communication_thread", "calendar_event",
)
LINK_RELATIONSHIPS = (
    "implements", "blocks_on", "requires", "proves", "owned_by",
    "moves", "occurs_at", "discussed_in", "publishes_to",
)


@dataclass(frozen=True)
class ResolverSpec:
    name: str
    version: str
    module_name: str
    permission: str


@dataclass(frozen=True)
class LinkResolution:
    status: str
    display_label: str | None
    status_summary: str
    checked_at: str
    open_path: str | None = None

    def as_dict(self, checked_at: str | None = None) -> dict[str, Any]:
        return {
            "status": self.status,
            "display_label": self.display_label,
            "status_summary": self.status_summary,
            "checked_at": checked_at or self.checked_at,
            "open_path": self.open_path,
        }


_SPECS = {
    "party": ResolverSpec("contacts.party", "1", "contacts.core", "contacts.read"),
    "document": ResolverSpec("reports.artifact", "1", "reports.core", "reports.read"),
    "evidence": ResolverSpec("reports.artifact", "1", "reports.core", "reports.read"),
    "calendar_event": ResolverSpec("calendar.event", "1", "calendar.core", "calendar.read"),
    "operation": ResolverSpec("operation.provider", "1", "operations.core", "operations.read"),
    "gate": ResolverSpec("operation.provider", "1", "operations.core", "operations.read"),
    "shipment": ResolverSpec("shipment.provider", "1", "shipments.core", "shipments.read"),
    "location": ResolverSpec("location.provider", "1", "locations.core", "locations.read"),
    "asset": ResolverSpec("asset.provider", "1", "assets.core", "assets.read"),
    "agreement": ResolverSpec("agreement.provider", "1", "agreements.core", "agreements.read"),
    "communication_thread": ResolverSpec("kconnect.thread", "1", "communications.core", "communications.read"),
}


def resolver_spec(target_kind: str) -> ResolverSpec:
    try:
        return _SPECS[target_kind]
    except KeyError as exc:
        raise ValueError(f"target.kind must be {', '.join(LINK_TARGET_KINDS)}") from exc


def resolve_target(db: Session, actor: Actor, target_kind: str, target_id: str) -> LinkResolution:
    spec = resolver_spec(target_kind)
    checked_at = datetime.now(timezone.utc).isoformat()
    provider = module_record(db, actor.organization_id, spec.module_name)
    if provider is None or provider.status not in OPERATIONAL_STATUSES:
        return LinkResolution("unavailable", None, f"Resolver provider {spec.module_name} is not installed or enabled.", checked_at)
    if not has_permission(actor, spec.permission):
        return LinkResolution("denied", None, "The linked target is not visible to this actor.", checked_at)
    if target_kind == "party":
        return _resolve_party(db, actor, target_id, checked_at)
    if target_kind in {"document", "evidence"}:
        return _resolve_artifact(db, actor, target_id, checked_at)
    if target_kind == "calendar_event":
        return _resolve_calendar_event(db, actor, target_id, checked_at)
    if target_kind == "communication_thread":
        return _resolve_communication_thread(db, actor, target_id, checked_at)
    return LinkResolution("unavailable", None, f"Resolver {spec.name} has no active provider implementation.", checked_at)


def serialize_link(db: Session, actor: Actor, link: PlanningLink) -> dict[str, Any]:
    resolution = resolve_target(db, actor, link.target_kind, link.target_id)
    denied = resolution.status == "denied"
    stable_checked_at = _timestamp(link.last_resolved_at) if link.last_resolved_at is not None else resolution.checked_at
    return {
        "id": link.id,
        "project_id": link.project_id,
        "task_id": link.task_id,
        "scope_type": link.scope_type,
        "relationship": link.relationship,
        "blocking": bool(link.blocking),
        "target": {
            "kind": link.target_kind,
            "id": None if denied else link.target_id,
            "resolver": link.resolver,
            "resolver_version": link.resolver_version,
        },
        "resolution": resolution.as_dict(stable_checked_at),
        "created_at": _timestamp(link.created_at),
        "updated_at": _timestamp(link.updated_at),
    }


def _resolve_party(db: Session, actor: Actor, target_id: str, checked_at: str) -> LinkResolution:
    row = db.scalar(select(Party).where(Party.id == target_id, Party.organization_id == actor.organization_id))
    if row is None:
        return LinkResolution("missing", None, "The party target does not exist in this organization.", checked_at)
    try:
        from uok_contacts_core.facade import can_read_party
    except ImportError:
        return LinkResolution("unavailable", None, "The Party authorization provider is unavailable.", checked_at)
    if not can_read_party(actor, row):
        return LinkResolution("denied", None, "The linked target is not visible to this actor.", checked_at)
    if row.purged_at is not None or row.status != "active":
        return LinkResolution("unavailable", row.display_name, f"Party is {row.status}.", checked_at)
    return LinkResolution("ready", row.display_name, f"Party is {row.status}.", checked_at, f"/?view=contacts&party_id={row.id}")


def _resolve_artifact(db: Session, actor: Actor, target_id: str, checked_at: str) -> LinkResolution:
    row = db.scalar(select(ReportArtifact).where(ReportArtifact.id == target_id, ReportArtifact.organization_id == actor.organization_id))
    if row is None:
        return LinkResolution("missing", None, "The report artifact target does not exist in this organization.", checked_at)
    if row.deleted_at is not None or row.status == "deleted":
        return LinkResolution("unavailable", row.filename, "Report artifact is deleted.", checked_at)
    return LinkResolution("ready", row.filename, f"Report artifact is {row.status}.", checked_at, f"/api/reports/artifacts/{row.id}")


def _resolve_calendar_event(db: Session, actor: Actor, target_id: str, checked_at: str) -> LinkResolution:
    row = db.scalar(select(CalendarEvent).where(CalendarEvent.id == target_id, CalendarEvent.organization_id == actor.organization_id))
    if row is None:
        return LinkResolution("missing", None, "The calendar event target does not exist in this organization.", checked_at)
    try:
        from uok_calendar_core.facade import calendar_or_error
    except ImportError:
        return LinkResolution("unavailable", None, "The Calendar authorization provider is unavailable.", checked_at)
    try:
        calendar_or_error(db, actor, row.calendar_id)
    except ValueError:
        return LinkResolution("denied", None, "The linked target is not visible to this actor.", checked_at)
    if row.canceled_at is not None or row.status == "canceled":
        return LinkResolution("unavailable", row.title, "Calendar event is canceled.", checked_at)
    return LinkResolution("ready", row.title, f"Calendar event is {row.status}.", checked_at, f"/?view=calendar&event_id={row.id}")


def _resolve_communication_thread(db: Session, actor: Actor, target_id: str, checked_at: str) -> LinkResolution:
    row = db.scalar(select(CommunicationThread).where(
        CommunicationThread.id == target_id,
        CommunicationThread.organization_id == actor.organization_id,
    ))
    if row is None:
        return LinkResolution("missing", None, "The communication thread does not exist in this organization.", checked_at)
    if row.archived_at is not None or row.status == "archived":
        return LinkResolution("unavailable", row.title, "Communication thread is archived.", checked_at)
    return LinkResolution("ready", row.title, f"Communication thread is {row.status}.", checked_at, f"/?view=communications&thread_id={row.id}")


def _timestamp(value: datetime) -> str:
    if value.tzinfo is None or value.utcoffset() is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


__all__ = [
    "LINK_RELATIONSHIPS",
    "LINK_TARGET_KINDS",
    "LinkResolution",
    "resolve_target",
    "resolver_spec",
    "serialize_link",
]

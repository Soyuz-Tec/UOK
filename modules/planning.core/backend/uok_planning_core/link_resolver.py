from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Protocol

from sqlalchemy.orm import Session

from .models import PlanningLink
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


class _ReferenceResolution(Protocol):
    status: str
    display_label: str | None
    status_summary: str
    open_path: str | None


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
    try:
        from uok_contacts_core.public_api import resolve_party_reference
    except ImportError:
        return LinkResolution("unavailable", None, "The Party authorization provider is unavailable.", checked_at)
    return _from_reference_resolution(resolve_party_reference(db, actor, target_id), checked_at)


def _resolve_artifact(db: Session, actor: Actor, target_id: str, checked_at: str) -> LinkResolution:
    from uok_reports_core.public_api import resolve_report_artifact_reference

    return _from_reference_resolution(resolve_report_artifact_reference(db, actor, target_id), checked_at)


def _resolve_calendar_event(db: Session, actor: Actor, target_id: str, checked_at: str) -> LinkResolution:
    from uok_calendar_core.public_api import resolve_calendar_event_reference

    return _from_reference_resolution(resolve_calendar_event_reference(db, actor, target_id), checked_at)


def _resolve_communication_thread(db: Session, actor: Actor, target_id: str, checked_at: str) -> LinkResolution:
    from uok_communications_core.public_api import resolve_communication_thread_reference

    return _from_reference_resolution(resolve_communication_thread_reference(db, actor, target_id), checked_at)


def _from_reference_resolution(reference: _ReferenceResolution, checked_at: str) -> LinkResolution:
    return LinkResolution(
        reference.status,
        reference.display_label,
        reference.status_summary,
        checked_at,
        reference.open_path,
    )


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

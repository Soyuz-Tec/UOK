from __future__ import annotations

import re
from datetime import datetime, timezone
from hashlib import sha256
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok.command_context import (
    COMMAND_ETAG_RESULT_KEY,
    COMMAND_IF_MATCH_CONTEXT_KEY,
    CommandPreconditionError,
)
from uok.security import Actor, has_permission
from uok.util import dumps

from .models import Calendar


STRONG_CALENDAR_ETAG = re.compile(r'^"calendar-sha256-[a-f0-9]{64}"$')


def _iso_or_none(value: Any) -> str | None:
    normalized = _utc_naive(value)
    return normalized.isoformat(timespec="microseconds") if normalized else None


def _utc_naive(value: Any) -> datetime | None:
    if not isinstance(value, datetime):
        return None
    if value.tzinfo is not None and value.utcoffset() is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def is_user_managed_calendar(calendar: Calendar) -> bool:
    return bool(calendar.owner_user_id)


def calendar_lifecycle_capabilities(actor: Actor, calendar: Calendar) -> dict[str, bool]:
    manageable = has_permission(actor, "calendar.manage") and is_user_managed_calendar(calendar)
    return {
        "user_managed": is_user_managed_calendar(calendar),
        "can_delete": manageable and calendar.status == "active",
        "can_restore": manageable and calendar.status == "deleted",
    }


def strong_calendar_etag(calendar: Calendar) -> str:
    snapshot = {
        "id": calendar.id,
        "organization_id": calendar.organization_id,
        "owner_user_id": calendar.owner_user_id,
        "name": calendar.name,
        "color": calendar.color,
        "visibility_scope": calendar.visibility_scope,
        "timezone": calendar.timezone,
        "status": calendar.status,
        "attrs_json": calendar.attrs_json,
        "created_at": _iso_or_none(calendar.created_at),
        "updated_at": _iso_or_none(calendar.updated_at),
        "deleted_at": _iso_or_none(calendar.deleted_at),
    }
    digest = sha256(dumps(snapshot).encode("utf-8")).hexdigest()
    return f'"calendar-sha256-{digest}"'


def locked_user_managed_calendar(db: Session, actor: Actor, calendar_id: str) -> Calendar:
    calendar = db.scalar(
        select(Calendar)
        .where(
            Calendar.id == calendar_id,
            Calendar.organization_id == actor.organization_id,
        )
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if not calendar:
        raise ValueError("calendar not found")
    if not is_user_managed_calendar(calendar):
        raise ValueError("system-managed calendars cannot be deleted or restored")
    return calendar


def require_calendar_precondition(calendar: Calendar, payload: dict[str, Any], action: str) -> None:
    supplied = payload.get(COMMAND_IF_MATCH_CONTEXT_KEY)
    current_etag = strong_calendar_etag(calendar)
    updated_at = _utc_naive(calendar.updated_at or calendar.created_at)
    common = {
        "current_revision": max(1, int(updated_at.replace(tzinfo=timezone.utc).timestamp() * 1_000_000)) if updated_at else 1,
        "current_etag": current_etag,
        "object_ids": [calendar.id],
        "reload_url": "/api/calendar/calendars?include_deleted=true",
    }
    if supplied is None or not str(supplied).strip():
        raise CommandPreconditionError(
            code="precondition_required",
            message=f"A current strong Calendar ETag is required to {action} this calendar.",
            status_code=428,
            repair="Reload the Calendar list, review the latest lifecycle state, and confirm the action again.",
            **common,
        )
    if not STRONG_CALENDAR_ETAG.fullmatch(str(supplied)):
        raise CommandPreconditionError(
            code="invalid_precondition",
            message="If-Match must contain exactly one quoted strong Calendar ETag.",
            status_code=400,
            repair="Use the exact ETag projected on the latest Calendar record.",
            **common,
        )
    if str(supplied) != current_etag:
        raise CommandPreconditionError(
            code="stale_precondition",
            message="The Calendar changed after it was loaded.",
            status_code=412,
            repair=f"Reload the Calendar list, review the latest state, and explicitly confirm {action} again.",
            **common,
        )


def result_with_calendar_etag(calendar: Calendar, result: dict[str, Any]) -> dict[str, Any]:
    return {**result, COMMAND_ETAG_RESULT_KEY: strong_calendar_etag(calendar)}

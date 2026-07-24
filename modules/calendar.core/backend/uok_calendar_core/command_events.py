from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from uok.kernel_models import EventRecord
from uok.kernel.security import Actor
from uok.util import dumps


def emit_calendar_event(
    db: Session,
    actor: Actor,
    event_type: str,
    object_type: str,
    object_id: str,
    payload: dict[str, Any],
) -> None:
    last = db.scalar(
        select(func.max(EventRecord.sequence)).where(
            EventRecord.organization_id == actor.organization_id,
        )
    ) or 0
    db.add(
        EventRecord(
            organization_id=actor.organization_id,
            sequence=int(last) + 1,
            event_type=event_type,
            object_type=object_type,
            object_id=object_id,
            payload_json=dumps(payload),
        )
    )

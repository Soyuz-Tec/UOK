from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .kernel_models import EventRecord
from .security_types import ActorProtocol
from .util import dumps


def emit_module_event(
    db: Session,
    actor: ActorProtocol,
    event_type: str,
    object_type: str,
    object_id: str,
    payload: dict[str, Any] | None = None,
) -> None:
    last = db.scalar(select(func.max(EventRecord.sequence)).where(EventRecord.organization_id == actor.organization_id)) or 0
    event_payload = {
        "actor_user_id": actor.user_id,
        "actor_username": actor.username,
        **(payload or {}),
    }
    db.add(EventRecord(
        organization_id=actor.organization_id,
        sequence=int(last) + 1,
        event_type=event_type,
        object_type=object_type,
        object_id=object_id,
        payload_json=dumps(event_payload),
    ))

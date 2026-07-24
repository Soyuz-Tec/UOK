from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from uok.module_events import emit_module_event
from uok.kernel.security import Actor


def emit_communication_event(db: Session, actor: Actor, event_type: str, thread_id: str, payload: dict[str, Any]) -> None:
    emit_module_event(db, actor, event_type, "CommunicationThread", thread_id, payload)

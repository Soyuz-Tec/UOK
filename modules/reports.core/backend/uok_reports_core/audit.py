from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from uok.module_events import emit_module_event
from uok.security import Actor


def emit_report_event(db: Session, actor: Actor, event_type: str, artifact_id: str, payload: dict[str, Any]) -> None:
    emit_module_event(db, actor, event_type, "ReportArtifact", artifact_id, payload)

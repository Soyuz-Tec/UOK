from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from uok.models import EventRecord
from uok.security import Actor
from uok.util import dumps


def emit_report_event(db: Session, actor: Actor, event_type: str, artifact_id: str, payload: dict[str, Any]) -> None:
    last = db.scalar(select(func.max(EventRecord.sequence)).where(EventRecord.organization_id == actor.organization_id)) or 0
    db.add(EventRecord(
        organization_id=actor.organization_id,
        sequence=int(last) + 1,
        event_type=event_type,
        object_type="ReportArtifact",
        object_id=artifact_id,
        payload_json=dumps(payload),
    ))

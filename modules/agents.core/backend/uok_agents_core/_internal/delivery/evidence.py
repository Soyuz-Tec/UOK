from __future__ import annotations

from hashlib import sha256
from typing import Any

from sqlalchemy.orm import Session

from uok.kernel.security import Actor
from uok.util import dumps

from uok_agents_core._internal.persistence.models import AgentEvidence


MAX_EVIDENCE_BYTES = 64 * 1024


def record_evidence(
    db: Session,
    actor: Actor,
    run_id: str,
    evidence_type: str,
    summary: str,
    content: dict[str, Any],
) -> AgentEvidence:
    content_json = dumps(content)
    if len(content_json.encode("utf-8")) > MAX_EVIDENCE_BYTES:
        raise ValueError("agent evidence exceeds the 64 KiB limit")
    row = AgentEvidence(
        organization_id=actor.organization_id,
        run_id=run_id,
        evidence_type=evidence_type,
        summary=summary,
        content_json=content_json,
        content_sha256=sha256(content_json.encode("utf-8")).hexdigest(),
        recorded_by_user_id=actor.user_id,
    )
    db.add(row)
    db.flush()
    return row


__all__ = ["record_evidence"]

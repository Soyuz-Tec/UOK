from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok.kernel.security import Actor, has_permission

from .models import ReportArtifact as _ReportArtifact

ReferenceStatus = Literal["ready", "unavailable", "denied", "missing"]


@dataclass(frozen=True)
class ReportArtifactReferenceResolution:
    status: ReferenceStatus
    display_label: str | None
    status_summary: str
    open_path: str | None = None


def resolve_report_artifact_reference(
    db: Session,
    actor: Actor,
    artifact_id: str,
) -> ReportArtifactReferenceResolution:
    """Resolve an artifact reference without exposing the Reports ORM mapping."""
    if not has_permission(actor, "reports.read"):
        return ReportArtifactReferenceResolution("denied", None, "The linked target is not visible to this actor.")
    row = db.scalar(select(_ReportArtifact).where(
        _ReportArtifact.id == artifact_id,
        _ReportArtifact.organization_id == actor.organization_id,
    ))
    if row is None:
        return ReportArtifactReferenceResolution(
            "missing",
            None,
            "The report artifact target does not exist in this organization.",
        )
    if row.deleted_at is not None or row.status == "deleted":
        return ReportArtifactReferenceResolution("unavailable", row.filename, "Report artifact is deleted.")
    return ReportArtifactReferenceResolution(
        "ready",
        row.filename,
        f"Report artifact is {row.status}.",
        f"/api/reports/artifacts/{row.id}",
    )


__all__ = ["ReportArtifactReferenceResolution", "resolve_report_artifact_reference"]

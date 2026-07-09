from __future__ import annotations

from uok.models import ReportArtifact, utcnow

__all__ = ["ReportArtifact", "owned_models", "utcnow"]


def owned_models() -> dict[str, str]:
    return {"ReportArtifact": ReportArtifact.__tablename__}

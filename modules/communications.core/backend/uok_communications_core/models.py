from __future__ import annotations

from uok.models import CommunicationThread, utcnow

__all__ = ["CommunicationThread", "owned_models", "utcnow"]


def owned_models() -> dict[str, str]:
    return {"CommunicationThread": CommunicationThread.__tablename__}

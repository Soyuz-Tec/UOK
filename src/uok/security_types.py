from __future__ import annotations

from typing import Protocol


class ActorProtocol(Protocol):
    user_id: str
    username: str
    organization_id: str
    role: str

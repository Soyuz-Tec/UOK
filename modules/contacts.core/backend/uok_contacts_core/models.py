from __future__ import annotations

from uok.models import ContactImportBatch, Party, PartyNote, PartyRelationship, utcnow

__all__ = [
    "ContactImportBatch",
    "Party",
    "PartyNote",
    "PartyRelationship",
    "owned_models",
    "utcnow",
]


def owned_models() -> dict[str, str]:
    return {
        "Party": Party.__tablename__,
        "PartyNote": PartyNote.__tablename__,
        "PartyRelationship": PartyRelationship.__tablename__,
        "ContactImportBatch": ContactImportBatch.__tablename__,
    }

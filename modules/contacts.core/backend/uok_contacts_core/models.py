from __future__ import annotations

from uok.models import ContactGroup, ContactGroupMember, ContactImportBatch, Party, PartyNote, PartyRelationship, utcnow

__all__ = [
    "ContactGroup",
    "ContactGroupMember",
    "ContactImportBatch",
    "Party",
    "PartyNote",
    "PartyRelationship",
    "owned_models",
    "utcnow",
]


def owned_models() -> dict[str, str]:
    return {
        "ContactGroup": ContactGroup.__tablename__,
        "ContactGroupMember": ContactGroupMember.__tablename__,
        "Party": Party.__tablename__,
        "PartyNote": PartyNote.__tablename__,
        "PartyRelationship": PartyRelationship.__tablename__,
        "ContactImportBatch": ContactImportBatch.__tablename__,
    }

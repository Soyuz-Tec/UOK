from __future__ import annotations

from .module_paths import ensure_module_backend_paths

ensure_module_backend_paths()

from uok_contacts_core.access import (  # noqa: E402
    can_manage_contacts,
    can_read_note,
    can_read_party,
    get_party_or_error,
    readable_note_records,
    readable_party_filter,
    readable_relationship_records,
    relationship_is_readable,
)

__all__ = [
    "can_manage_contacts",
    "can_read_note",
    "can_read_party",
    "get_party_or_error",
    "readable_note_records",
    "readable_party_filter",
    "readable_relationship_records",
    "relationship_is_readable",
]

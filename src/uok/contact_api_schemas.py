from __future__ import annotations

from .module_paths import ensure_module_backend_paths

ensure_module_backend_paths()

from uok_contacts_core.api_schemas import (  # noqa: F401,E402
    ContactCsvImportRequest,
    ContactGroupMembersRequest,
    ContactGroupUpdateRequest,
    ContactGroupWriteRequest,
    ContactNoteRequest,
    ContactRelationshipRequest,
    ContactRelationshipUpdateRequest,
    ContactWriteRequest,
)

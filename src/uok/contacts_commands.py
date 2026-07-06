from __future__ import annotations

from .module_paths import ensure_module_backend_paths

ensure_module_backend_paths()

from uok_contacts_core.commands import (  # noqa: E402
    cmd_add_contact_note,
    cmd_archive_contact,
    cmd_create_contact,
    cmd_import_contacts_csv,
    cmd_link_contact_relationship,
    cmd_purge_contact,
    cmd_restore_contact,
    cmd_update_contact,
    command_handlers,
)

__all__ = [
    "cmd_add_contact_note",
    "cmd_archive_contact",
    "cmd_create_contact",
    "cmd_import_contacts_csv",
    "cmd_link_contact_relationship",
    "cmd_purge_contact",
    "cmd_restore_contact",
    "cmd_update_contact",
    "command_handlers",
]

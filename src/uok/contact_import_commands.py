from __future__ import annotations

from .module_paths import ensure_module_backend_paths

ensure_module_backend_paths()

from uok_contacts_core.import_commands import cmd_import_contacts_csv  # noqa: E402

__all__ = ["cmd_import_contacts_csv"]

from __future__ import annotations

from .module_paths import ensure_module_backend_paths

ensure_module_backend_paths()

from uok_contacts_core.validation import *  # noqa: F401,F403,E402

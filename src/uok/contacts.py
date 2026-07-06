from __future__ import annotations

from .module_paths import ensure_module_backend_paths

ensure_module_backend_paths()

from uok_contacts_core.facade import *  # noqa: F401,F403,E402
from uok_contacts_core.facade import __all__  # noqa: E402

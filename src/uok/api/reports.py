from __future__ import annotations

from ..module_paths import ensure_module_backend_paths

ensure_module_backend_paths()

from uok_reports_core.api import router  # noqa: E402

__all__ = ["router"]

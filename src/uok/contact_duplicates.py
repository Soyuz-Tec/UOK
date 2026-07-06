from __future__ import annotations

from .module_paths import ensure_module_backend_paths

ensure_module_backend_paths()

from uok_contacts_core.duplicates import find_duplicate_candidates  # noqa: E402

__all__ = ["find_duplicate_candidates"]

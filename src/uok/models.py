"""Compatibility facade for the kernel and validated module ORM registry.

New code should import shared mappings from :mod:`uok.kernel_models` and
module-owned mappings from the owning backend package.  This facade preserves
the historical import surface with the exact same class objects.
"""

from __future__ import annotations

from .db import Base
from .models_base import new_id, utcnow
from .module_model_registry import ensure_module_models_registered


_REGISTERED_MODELS = ensure_module_models_registered()
globals().update(_REGISTERED_MODELS)

__all__ = [
    "Base",
    "new_id",
    "utcnow",
    *_REGISTERED_MODELS,
]

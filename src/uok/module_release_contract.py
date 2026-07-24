from __future__ import annotations

from pathlib import Path
from typing import Any

from .module_contract_validation import validate_module_release_contracts


def validate_release_contract(root: Path | None = None) -> dict[str, Any]:
    """Compatibility facade for release-oriented callers."""

    return validate_module_release_contracts(root)


__all__ = ["validate_module_release_contracts", "validate_release_contract"]

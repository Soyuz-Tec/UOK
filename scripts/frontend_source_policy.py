from __future__ import annotations

from pathlib import Path


FORBIDDEN_DURABLE_JAVASCRIPT_SUFFIXES = frozenset({".js", ".jsx", ".mjs", ".cjs"})


def is_durable_javascript(path: Path) -> bool:
    return path.suffix.casefold() in FORBIDDEN_DURABLE_JAVASCRIPT_SUFFIXES

"""Supported Intelligence facade; implementation details remain private."""

from __future__ import annotations

from importlib import import_module as _import_module
from typing import Any as _Any

_EXPORTS = {
    "api_router": ("uok_intelligence_core._internal.delivery.api", "router"),
}

api_router: _Any


def role_grants() -> dict[str, set[str]]:
    from uok_intelligence_core._internal.delivery.policy import role_grants as _provider

    return _provider()


def __getattr__(name: str) -> _Any:
    try:
        module_name, symbol_name = _EXPORTS[name]
    except KeyError as exc:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}") from exc
    value = getattr(_import_module(module_name), symbol_name)
    globals()[name] = value
    return value


def __dir__() -> list[str]:
    return sorted(set(globals()) | set(__all__))


__all__ = [
    "api_router",
    "role_grants",
]

del annotations

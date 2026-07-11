from __future__ import annotations

from importlib import import_module as _import_module
from typing import Any as _Any


def __getattr__(name: str) -> _Any:
    facade = _import_module(f"{__name__}.facade")
    if name == "__all__":
        value = list(facade.__all__)
        globals()[name] = value
        return value
    if name not in facade.__all__:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    value = getattr(facade, name)
    globals()[name] = value
    return value


def __dir__() -> list[str]:
    facade = _import_module(f"{__name__}.facade")
    return sorted(set(globals()) | set(facade.__all__))

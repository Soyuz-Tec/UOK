from __future__ import annotations

from typing import Any

import pytest
from fastapi import APIRouter

import uok.host.module_routers as module_routers


def _manifest() -> dict[str, Any]:
    return {
        "api_router": "alpha_backend.api:router",
        "api_prefixes": ["/api/alpha"],
        "extension_points": ["api_router"],
    }


@pytest.mark.parametrize(
    "route_path",
    [
        "/api/alpha/../auth/login",
        "/api/alpha/./items",
        "/api/alpha//items",
        r"/api/alpha\items",
        "/api/alpha/%2e%2e/auth",
        "/api/alpha/items?mode=unsafe",
        "/api/alpha/items#fragment",
    ],
)
def test_module_router_rejects_noncanonical_route_paths(
    monkeypatch: pytest.MonkeyPatch,
    route_path: str,
) -> None:
    router = APIRouter()
    router.add_api_route(route_path, lambda: {"ok": True})
    monkeypatch.setattr(module_routers, "resolve_module_import", lambda *_args: router)

    with pytest.raises(ValueError, match="route .* is not canonical"):
        module_routers._resolve_module_router(
            "alpha.core",
            _manifest(),
            "alpha_backend.api:router",
        )


def test_module_router_accepts_canonical_parameterized_route(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    router = APIRouter()
    router.add_api_route("/api/alpha/items/{item_id}", lambda: {"ok": True})
    monkeypatch.setattr(module_routers, "resolve_module_import", lambda *_args: router)

    assert module_routers._resolve_module_router(
        "alpha.core",
        _manifest(),
        "alpha_backend.api:router",
    ) is router

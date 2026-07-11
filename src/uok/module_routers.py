from __future__ import annotations

from typing import Any

from fastapi import APIRouter, FastAPI

from .module_api_prefixes import is_canonical_api_route_path
from .module_imports import IMPORT_TARGET_SPEC_PATTERN, resolve_module_import
from .module_manifest_loader import load_module_manifests
from .module_paths import ensure_module_backend_paths


def load_module_routers() -> list[tuple[str, APIRouter]]:
    ensure_module_backend_paths()
    routers: list[tuple[str, APIRouter]] = []
    for module_name, manifest in load_module_manifests().items():
        spec = manifest.get("api_router")
        if spec is None:
            continue
        routers.append((module_name, _resolve_module_router(module_name, manifest, str(spec))))
    return routers


def mount_module_routers(app: FastAPI) -> list[str]:
    mounted: list[str] = []
    for module_name, module_router in load_module_routers():
        app.include_router(module_router)
        mounted.append(module_name)
    return mounted


def _resolve_module_router(module_name: str, manifest: dict[str, Any], spec: str) -> APIRouter:
    if "api_router" not in manifest.get("extension_points", []):
        raise ValueError(f"module {module_name} declares api_router without the api_router extension point")
    if not IMPORT_TARGET_SPEC_PATTERN.fullmatch(spec):
        raise ValueError(f"module {module_name} api_router must use <package.module>:<attribute>")
    module_router = resolve_module_import(module_name, manifest, "api_router")
    if not isinstance(module_router, APIRouter):
        raise ValueError(f"module {module_name} api_router {spec} is not an APIRouter")
    prefixes = [str(prefix) for prefix in manifest.get("api_prefixes", [])]
    for route in module_router.routes:
        path = getattr(route, "path", "")
        if not isinstance(path, str) or not is_canonical_api_route_path(path):
            raise ValueError(f"module {module_name} route {path} is not canonical")
        if not any(path == prefix or path.startswith(prefix + "/") for prefix in prefixes):
            raise ValueError(f"module {module_name} route {path} is outside declared api_prefixes")
    return module_router

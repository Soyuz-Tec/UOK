from __future__ import annotations

import re
import sys
from importlib import import_module
from pathlib import Path
from types import ModuleType
from typing import Any

from .module_paths import ensure_module_backend_paths, repo_root

IMPORT_TARGET_SPEC_PATTERN = re.compile(r"^[a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)+:[a-z_][a-z0-9_]*$")


def module_import_backend_package(spec: str) -> str:
    return spec.partition(":")[0].split(".")[0]


def module_import_backend_package_exists(manifest: dict[str, Any], spec: str) -> bool:
    backend_package = module_import_backend_package(spec)
    backend_path = Path(str(manifest.get("backend_path", "")))
    return (repo_root() / backend_path / backend_package / "__init__.py").is_file()


def resolve_module_import(module_name: str, manifest: dict[str, Any], field: str) -> Any:
    spec = manifest.get(field)
    if not isinstance(spec, str) or not IMPORT_TARGET_SPEC_PATTERN.fullmatch(spec):
        raise ValueError(f"module {module_name} {field} must use <package.module>:<attribute>")
    ensure_module_backend_paths()
    authoritative = _authoritative_provider_manifest(module_name, manifest, field, spec)
    if not module_import_backend_package_exists(authoritative, spec):
        raise ValueError(f"module {module_name} {field} must resolve from the module backend package")
    target, _, attribute = spec.partition(":")
    backend = (repo_root() / Path(str(authoritative["backend_path"]))).resolve()
    _validate_cached_module_origins(module_name, target, backend)
    imported = import_module(target)
    _validate_imported_module_origins(module_name, target, backend)
    resolved = getattr(imported, attribute, None)
    if resolved is None:
        raise ValueError(f"module {module_name} {field} target {spec} was not found")
    return resolved


def _authoritative_provider_manifest(
    module_name: str,
    manifest: dict[str, Any],
    field: str,
    spec: str,
) -> dict[str, Any]:
    # Import lazily because manifest validation imports this module's target
    # pattern while the catalog contract is initialized.
    from ..module_manifest_loader import load_module_manifests

    authoritative = load_module_manifests().get(module_name)
    if authoritative is None:
        raise ValueError(f"module {module_name} is not in the validated module catalog")
    if (
        manifest.get("name") != module_name
        or manifest.get("backend_path") != authoritative["backend_path"]
        or spec != authoritative.get(field)
    ):
        raise ValueError(
            f"module {module_name} {field} must match its validated module manifest"
        )
    return authoritative


def _validate_cached_module_origins(
    module_name: str,
    target: str,
    backend: Path,
) -> None:
    for import_name in _cached_package_modules(target):
        cached = sys.modules.get(import_name)
        if cached is not None:
            _validate_module_origin(module_name, import_name, cached, backend)


def _validate_imported_module_origins(
    module_name: str,
    target: str,
    backend: Path,
) -> None:
    if target not in sys.modules:
        raise ValueError(f"module {module_name} import {target} was not loaded")
    _validate_cached_module_origins(module_name, target, backend)


def _cached_package_modules(target: str) -> list[str]:
    package = target.split(".", 1)[0]
    return sorted(
        import_name
        for import_name in sys.modules
        if import_name == package or import_name.startswith(package + ".")
    )


def _validate_module_origin(
    module_name: str,
    import_name: str,
    imported: ModuleType,
    backend: Path,
) -> None:
    spec = getattr(imported, "__spec__", None)
    origin = getattr(spec, "origin", None) or getattr(imported, "__file__", None)
    if not isinstance(origin, (str, Path)) or str(origin) in {"built-in", "frozen"}:
        raise ValueError(
            f"module {module_name} import {import_name} has no file origin under its backend"
        )
    origin_path = Path(origin)
    if not origin_path.is_absolute():
        raise ValueError(
            f"module {module_name} import {import_name} has a non-absolute file origin"
        )
    resolved_origin = origin_path.resolve()
    if not resolved_origin.is_file():
        raise ValueError(
            f"module {module_name} import {import_name} file origin does not exist"
        )
    try:
        resolved_origin.relative_to(backend)
    except ValueError as error:
        raise ValueError(
            f"module {module_name} import {import_name} resolved outside its backend"
        ) from error

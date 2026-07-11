from __future__ import annotations

import os
import stat
import sys
from pathlib import Path
from typing import Any


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def modules_root() -> Path:
    return repo_root() / "modules"


def module_backend_paths(root: Path | None = None) -> list[Path]:
    requested_root = root or modules_root()
    _reject_link_or_junction(requested_root, "module catalog root")
    module_root = requested_root.resolve()
    if not module_root.exists():
        return []
    for module_dir in module_root.iterdir():
        if _is_link_or_junction(module_dir):
            raise ValueError(
                f"module catalog entry cannot be a link or junction: {module_dir.name}"
            )
    # Import lazily because the manifest loader uses modules_root() from this
    # module while it initializes. Raw paths are preflighted before semantic
    # validation can inspect backend source.
    from .module_contract_validation import validate_module_runtime_contracts
    from .module_manifest_loader import load_module_manifests

    manifests = load_module_manifests(module_root)
    backend_paths = [
        _validated_backend_path(module_root, module_name, manifest)
        for module_name, manifest in manifests.items()
    ]
    contract = validate_module_runtime_contracts(module_root)
    if not contract["ok"]:
        raise ValueError(f"module runtime contract is invalid: {contract['violations']}")
    return backend_paths


def _validated_backend_path(
    module_root: Path,
    module_name: str,
    manifest: dict[str, Any],
) -> Path:
    relative = Path(str(manifest["backend_path"]))
    expected_prefix = ("modules", module_name)
    if (
        relative.is_absolute()
        or ".." in relative.parts
        or len(relative.parts) < 3
        or relative.parts[:2] != expected_prefix
    ):
        raise ValueError(
            f"module {module_name} backend_path must stay under modules/{module_name}"
        )
    owner_path = module_root / module_name
    _reject_link_or_junction(owner_path, f"module {module_name} root")
    backend_path = module_root.parent
    for part in relative.parts:
        backend_path /= part
        if len(backend_path.parts) >= len(owner_path.parts):
            _reject_link_or_junction(backend_path, f"module {module_name} backend path")
    backend = backend_path.resolve()
    owner_root = owner_path.resolve()
    try:
        backend.relative_to(owner_root)
    except ValueError as exc:
        raise ValueError(
            f"module {module_name} backend_path escapes its module root"
        ) from exc
    if not backend.is_dir():
        raise ValueError(f"module {module_name} backend_path does not exist: {relative.as_posix()}")
    _reject_backend_tree_links(backend, module_name)
    return backend


def _reject_backend_tree_links(backend: Path, module_name: str) -> None:
    pending = [backend]
    while pending:
        directory = pending.pop()
        for candidate in directory.iterdir():
            _reject_link_or_junction(candidate, f"module {module_name} backend package")
            if candidate.is_dir():
                pending.append(candidate)


def _reject_link_or_junction(path: Path, label: str) -> None:
    if _is_link_or_junction(path):
        raise ValueError(f"{label} cannot be a link or junction: {path}")


def _is_link_or_junction(path: Path) -> bool:
    if path.is_symlink():
        return True
    is_junction = getattr(path, "is_junction", None)
    if callable(is_junction) and is_junction():
        return True
    if os.name != "nt":
        return False
    try:
        reparse_tag = getattr(path.lstat(), "st_reparse_tag", 0)
    except OSError:
        return False
    return reparse_tag == getattr(stat, "IO_REPARSE_TAG_MOUNT_POINT", -1)


def ensure_module_backend_paths(root: Path | None = None) -> None:
    for backend_path in reversed(module_backend_paths(root)):
        path = str(backend_path)
        if path not in sys.path:
            sys.path.insert(0, path)

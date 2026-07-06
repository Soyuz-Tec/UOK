from __future__ import annotations

import sys
from pathlib import Path


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def modules_root() -> Path:
    return repo_root() / "modules"


def module_backend_paths() -> list[Path]:
    root = modules_root()
    if not root.exists():
        return []
    return [
        module_dir / "backend"
        for module_dir in sorted(root.iterdir())
        if module_dir.is_dir() and (module_dir / "backend").is_dir()
    ]


def ensure_module_backend_paths() -> None:
    for backend_path in reversed(module_backend_paths()):
        path = str(backend_path)
        if path not in sys.path:
            sys.path.insert(0, path)

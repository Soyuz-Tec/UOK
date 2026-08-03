from __future__ import annotations

import json
import math
from pathlib import Path, PurePosixPath
from typing import Any

from engineering_inventory import InventoryDiscoveryError, tracked_coverage_paths


class MeasurementValidationError(ValueError):
    pass


def fail(message: str) -> None:
    raise MeasurementValidationError(message)


def strict_keys(value: Any, expected: set[str], label: str) -> dict[str, Any]:
    if type(value) is not dict:
        fail(f"{label} must be an object")
    actual = set(value)
    if actual != expected:
        fail(
            f"{label} keys must be exactly {sorted(expected)}; "
            f"received {sorted(actual)}"
        )
    return value


def _reject_nonfinite(value: Any, label: str) -> None:
    if isinstance(value, float) and not math.isfinite(value):
        fail(f"{label} contains a non-finite number")
    if isinstance(value, dict):
        for key, child in value.items():
            _reject_nonfinite(child, f"{label}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            _reject_nonfinite(child, f"{label}[{index}]")


def load_json(path: Path, label: str) -> tuple[Any, bytes]:
    try:
        raw = path.read_bytes()
        value = json.loads(
            raw.decode("utf-8"),
            parse_constant=lambda token: fail(
                f"{label} contains invalid JSON number {token}"
            ),
        )
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        fail(f"{label} is not valid UTF-8 JSON: {exc}")
    _reject_nonfinite(value, label)
    return value, raw


def repo_file(root: Path, relative_path: str, label: str) -> Path:
    pure = PurePosixPath(relative_path)
    if (
        not relative_path
        or "\\" in relative_path
        or pure.is_absolute()
        or ".." in pure.parts
        or pure.as_posix() != relative_path
    ):
        fail(f"{label} path must be normalized and repository-relative")
    candidate = root.joinpath(*pure.parts)
    cursor = root
    for part in pure.parts:
        cursor /= part
        if cursor.is_symlink():
            fail(f"{label} may not be a symlink or traverse one")
    if not candidate.is_file():
        fail(f"{label} file is missing")
    try:
        candidate.resolve(strict=True).relative_to(root.resolve(strict=True))
    except ValueError:
        fail(f"{label} escapes the repository")
    return candidate


def coverage_inventory_path(root: Path, raw_path: str, kind: str) -> str:
    if not isinstance(raw_path, str) or not raw_path:
        fail(f"{kind} coverage inventory contains an invalid path")
    candidate = Path(raw_path)
    if not candidate.is_absolute():
        pure = PurePosixPath(raw_path.replace("\\", "/"))
        if pure.is_absolute() or ".." in pure.parts:
            fail(f"{kind} coverage inventory path escapes the repository")
        candidate = root.joinpath(*pure.parts)
    try:
        relative = candidate.resolve(strict=True).relative_to(
            root.resolve(strict=True)
        )
    except (OSError, ValueError):
        fail(
            f"{kind} coverage inventory path is missing or outside the repository"
        )
    cursor = root
    for part in relative.parts:
        cursor /= part
        if cursor.is_symlink():
            fail(f"{kind} coverage inventory may not contain symlinks")
    normalized = relative.as_posix()
    if kind == "python":
        allowed = (
            normalized.startswith("src/uok/")
            or normalized.startswith("modules/") and "/backend/" in normalized
        ) and relative.suffix == ".py"
    else:
        allowed = (
            normalized.startswith("web/src/")
            or normalized.startswith("modules/") and "/web/src/" in normalized
        ) and relative.suffix in {".ts", ".tsx"}
    if not allowed:
        fail(f"{kind} coverage inventory contains an out-of-scope file")
    return normalized


def expected_coverage_inventory(root: Path, kind: str) -> list[str]:
    try:
        tracked = tracked_coverage_paths(root, kind)
    except InventoryDiscoveryError as exc:
        fail(str(exc))
    return sorted(
        coverage_inventory_path(root, path, kind)
        for path in tracked
    )


__all__ = [
    "MeasurementValidationError",
    "coverage_inventory_path",
    "expected_coverage_inventory",
    "fail",
    "load_json",
    "repo_file",
    "strict_keys",
]

from __future__ import annotations

import subprocess
from pathlib import Path, PurePosixPath


class InventoryDiscoveryError(RuntimeError):
    pass


def _git_bytes(root: Path, *arguments: str) -> bytes:
    result = subprocess.run(
        ["git", *arguments],
        cwd=root,
        capture_output=True,
        check=False,
    )
    if result.returncode:
        raise InventoryDiscoveryError(
            "unable to derive the tracked coverage inventory"
        )
    return result.stdout


def _decode_paths(raw: bytes, label: str) -> list[str]:
    try:
        return [
            path
            for path in raw.decode("utf-8").split("\0")
            if path
        ]
    except UnicodeDecodeError as exc:
        raise InventoryDiscoveryError(
            f"{label} is not valid UTF-8"
        ) from exc


def assert_no_hidden_index_entries(root: Path) -> None:
    sparse = subprocess.run(
        ["git", "config", "--bool", "core.sparseCheckout"],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    if sparse.returncode not in {0, 1}:
        raise InventoryDiscoveryError(
            "unable to inspect sparse-checkout configuration"
        )
    if sparse.returncode == 0 and sparse.stdout.strip() == "true":
        raise InventoryDiscoveryError(
            "engineering evidence requires a non-sparse checkout"
        )
    records = _decode_paths(
        _git_bytes(root, "ls-files", "-v", "-z", "--cached"),
        "tracked Git index",
    )
    hidden: list[str] = []
    for record in records:
        if len(record) < 3 or record[1] != " ":
            raise InventoryDiscoveryError(
                "tracked Git index has an invalid status record"
            )
        if record[0] != "H":
            hidden.append(record[2:])
    if hidden:
        raise InventoryDiscoveryError(
            "tracked Git index contains assume-unchanged, skip-worktree, "
            f"or nonstandard entries: {hidden[:5]}"
        )


def _is_coverage_source(path: str, kind: str) -> bool:
    pure = PurePosixPath(path)
    parts = pure.parts
    if kind == "python":
        in_kernel = len(parts) > 2 and parts[:2] == ("src", "uok")
        in_module = (
            len(parts) > 3
            and parts[0] == "modules"
            and parts[2] == "backend"
        )
        return pure.suffix == ".py" and (in_kernel or in_module)
    in_host = len(parts) > 2 and parts[:2] == ("web", "src")
    in_module = (
        len(parts) > 4
        and parts[0] == "modules"
        and parts[2:4] == ("web", "src")
    )
    excluded = (
        path.startswith("web/src/generated/")
        or path.startswith("web/src/test/")
        or pure.name.endswith((".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx"))
    )
    return pure.suffix in {".ts", ".tsx"} and (in_host or in_module) and not excluded


def tracked_coverage_paths(root: Path, kind: str) -> list[str]:
    if kind not in {"python", "frontend"}:
        raise InventoryDiscoveryError("coverage inventory kind is not registered")
    assert_no_hidden_index_entries(root)
    cached = _decode_paths(
        _git_bytes(
            root,
            "ls-files",
            "-z",
            "--cached",
            "--",
            "src/uok",
            "modules",
            "web/src",
        ),
        "tracked coverage inventory",
    )
    untracked = _decode_paths(
        _git_bytes(
            root,
            "ls-files",
            "-z",
            "--others",
            "--exclude-standard",
            "--",
            "src/uok",
            "modules",
            "web/src",
        ),
        "untracked coverage inventory",
    )
    tracked_sources = [
        path for path in cached if _is_coverage_source(path, kind)
    ]
    missing = [
        path
        for path in tracked_sources
        if not root.joinpath(*PurePosixPath(path).parts).is_file()
    ]
    if missing:
        raise InventoryDiscoveryError(
            f"{kind} tracked coverage sources are not materialized: {missing[:5]}"
        )
    inventory = sorted(
        path
        for path in (*tracked_sources, *untracked)
        if (
            path
            and root.joinpath(*PurePosixPath(path).parts).exists()
            and _is_coverage_source(path, kind)
        )
    )
    if not inventory or len(inventory) != len(set(inventory)):
        raise InventoryDiscoveryError(
            f"{kind} tracked coverage inventory is empty or ambiguous"
        )
    return inventory


__all__ = [
    "InventoryDiscoveryError",
    "assert_no_hidden_index_entries",
    "tracked_coverage_paths",
]

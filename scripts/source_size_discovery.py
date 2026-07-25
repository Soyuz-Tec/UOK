from __future__ import annotations

import os
from pathlib import Path

from source_size_models import (
    EXCLUDED_DIRECTORY_NAMES,
    SOURCE_ROOTS,
    SOURCE_SUFFIXES,
    SourceFinding,
    is_excluded_tree,
)


def hard_finding(
    identity: str,
    kind: str,
    path: str,
    rule: str,
    reason: str,
) -> SourceFinding:
    return SourceFinding(identity, kind, path, 0, 0, "hard", rule, reason)


def relative_source_path(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def symlink_finding(path: str) -> SourceFinding:
    return hard_finding(
        f"symlink:{path}",
        "symlink",
        path,
        "source_symlink",
        "source trees and scanned source files may not be symlinks",
    )


def _filter_directories(
    root: Path,
    current: Path,
    names: list[str],
    findings: list[SourceFinding],
) -> list[str]:
    kept = []
    for name in sorted(names):
        candidate = current / name
        relative = relative_source_path(candidate, root)
        if name in EXCLUDED_DIRECTORY_NAMES or is_excluded_tree(relative):
            continue
        if candidate.is_symlink():
            findings.append(symlink_finding(relative))
        else:
            kept.append(name)
    return kept


def _collect_directory_files(
    root: Path,
    current: Path,
    filenames: list[str],
    files: set[Path],
    findings: list[SourceFinding],
) -> None:
    for name in sorted(filenames):
        candidate = current / name
        relative = relative_source_path(candidate, root)
        if is_excluded_tree(relative) or candidate.suffix not in SOURCE_SUFFIXES:
            continue
        if candidate.is_symlink():
            findings.append(symlink_finding(relative))
        elif candidate.is_file():
            files.add(candidate)


def _collect_source_root(
    root: Path,
    source_root: Path,
    files: set[Path],
    findings: list[SourceFinding],
) -> None:
    relative_root = relative_source_path(source_root, root)
    if source_root.is_symlink():
        findings.append(symlink_finding(relative_root))
        return
    if not source_root.is_dir():
        return
    for directory, names, filenames in os.walk(source_root, followlinks=False):
        current = Path(directory)
        names[:] = _filter_directories(root, current, names, findings)
        _collect_directory_files(root, current, filenames, files, findings)


def _collect_repository_root(
    root: Path,
    files: set[Path],
    findings: list[SourceFinding],
) -> None:
    for candidate in sorted(root.iterdir()):
        if candidate.suffix not in SOURCE_SUFFIXES:
            continue
        if candidate.is_symlink():
            findings.append(symlink_finding(candidate.name))
        elif candidate.is_file():
            files.add(candidate)


def discover_source_files(
    root: Path,
) -> tuple[list[Path], list[SourceFinding]]:
    files: set[Path] = set()
    findings: list[SourceFinding] = []
    for root_name in SOURCE_ROOTS:
        _collect_source_root(root, root / root_name, files, findings)
    _collect_repository_root(root, files, findings)
    ordered = sorted(files, key=lambda item: relative_source_path(item, root))
    return ordered, findings

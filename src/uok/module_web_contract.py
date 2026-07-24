from __future__ import annotations

import re
import stat
from pathlib import Path
from typing import Any


WEB_SECTION_PATTERN = re.compile(r"^[a-z][a-z0-9-]*$")
RESERVED_SHELL_SECTIONS = {"overview", "evidence", "architecture"}


def validate_web_surface(
    module_name: str,
    manifest: dict[str, Any],
    module_root: Path,
    rows: list[dict[str, str]],
    *,
    require_entry_asset: bool,
) -> None:
    if "web_surface" not in manifest["extension_points"]:
        return
    workspace = module_root.parent.resolve()
    canonical_web_path = Path("modules") / module_name / "web"
    canonical_web_value = canonical_web_path.as_posix()
    if manifest["web_path"] != canonical_web_value:
        _violation(
            rows,
            module_name,
            "web_path",
            "web_surface requires web_path exactly modules/<module_name>/web",
        )

    canonical_entry = canonical_web_path / "src" / "moduleSurface.tsx"
    canonical_entry_value = canonical_entry.as_posix()
    raw_entry = str(manifest.get("web_entry", ""))
    entry = Path(raw_entry)
    if raw_entry != canonical_entry_value:
        _violation(
            rows,
            module_name,
            "web_entry",
            "web_entry must be exactly modules/<module_name>/web/src/moduleSurface.tsx",
        )
    elif require_entry_asset:
        _validate_web_entry(module_name, workspace, canonical_web_path, entry, rows)

    section = str(manifest.get("web_section", ""))
    if not WEB_SECTION_PATTERN.fullmatch(section):
        _violation(rows, module_name, "web_section", "web_section must be a lowercase section id")
    elif section in RESERVED_SHELL_SECTIONS:
        _violation(
            rows,
            module_name,
            "web_section",
            f"web_section {section} is reserved by the shell",
        )


def _validate_web_entry(
    module_name: str,
    workspace: Path,
    canonical_web_path: Path,
    entry: Path,
    rows: list[dict[str, str]],
) -> None:
    entry_path = workspace / entry
    try:
        resolved_entry = entry_path.resolve(strict=True)
    except (OSError, RuntimeError):
        _violation(rows, module_name, "web_entry", "declared web entry does not exist")
        return
    expected_root = (workspace / canonical_web_path).resolve()
    if not resolved_entry.is_relative_to(expected_root):
        _violation(rows, module_name, "web_entry", "web entry escapes the owning web root")
    elif _has_link_or_junction(entry_path, workspace):
        _violation(rows, module_name, "web_entry", "web entry path cannot contain a link or junction")
    elif not resolved_entry.is_file():
        _violation(rows, module_name, "web_entry", "declared web entry is not a file")


def validate_web_section_ownership(
    manifests: dict[str, dict[str, Any]], rows: list[dict[str, str]]
) -> None:
    owners: dict[str, str] = {}
    for module_name, manifest in manifests.items():
        if "web_surface" not in manifest["extension_points"]:
            continue
        section = manifest["web_section"]
        previous = owners.get(section)
        if previous is not None:
            _violation(
                rows,
                module_name,
                "web_section",
                f"web section {section} is already owned by {previous}",
            )
        owners[section] = module_name


def _has_link_or_junction(path: Path, workspace: Path) -> bool:
    candidate = path
    while candidate != workspace.parent:
        try:
            metadata = candidate.lstat()
        except OSError:
            return False
        attributes = getattr(metadata, "st_file_attributes", 0)
        reparse_flag = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0)
        if candidate.is_symlink() or attributes & reparse_flag:
            return True
        if candidate == workspace:
            return False
        candidate = candidate.parent
    return False


def _violation(
    rows: list[dict[str, str]], module: str, field: str, reason: str
) -> None:
    rows.append({"module": module, "field": field, "reason": reason})

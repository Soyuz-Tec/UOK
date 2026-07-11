from __future__ import annotations

from pathlib import Path
from typing import Any

from . import APP_VERSION
from .module_manifest_schema import validate_manifest_shape
from .module_paths import modules_root

DOUBLE_QUOTED_ESCAPES = {"\\": "\\", '"': '"'}


def load_module_manifests(root: Path | None = None) -> dict[str, dict[str, Any]]:
    module_root = root or modules_root()
    if not module_root.exists():
        return {}
    manifests: dict[str, dict[str, Any]] = {}
    for module_dir in sorted(module_root.iterdir()):
        if not module_dir.is_dir():
            continue
        manifest_path = module_dir / "manifest.yaml"
        if not manifest_path.exists():
            continue
        manifest = load_module_manifest(manifest_path)
        if manifest["name"] != module_dir.name:
            raise ValueError(f"{manifest_path} name must match directory {module_dir.name}")
        manifests[manifest["name"]] = manifest
    return manifests


def load_module_manifest(path: Path) -> dict[str, Any]:
    data = _parse_manifest_yaml(path.read_text(encoding="utf-8"), path)
    validate_manifest_shape(data, path)
    return data


def _parse_manifest_yaml(text: str, path: Path) -> dict[str, Any]:
    data: dict[str, Any] = {}
    current_list: str | None = None
    for line_number, raw_line in enumerate(text.splitlines(), start=1):
        if not raw_line.strip() or raw_line.lstrip().startswith("#"):
            continue
        if not raw_line.startswith((" ", "\t")) and ":" in raw_line:
            key, raw_value = raw_line.split(":", 1)
            key = key.strip()
            value = _strip_scalar_comment(raw_value, path, line_number).strip()
            if not key:
                raise ValueError(f"{path}:{line_number} has an empty manifest key")
            if key in data:
                raise ValueError(f"{path}:{line_number} repeats manifest key {key}")
            if not value:
                data[key] = []
                current_list = key
            else:
                data[key] = _parse_scalar(value, path, line_number)
                current_list = None
            continue
        stripped = raw_line.strip()
        if current_list and stripped.startswith("- "):
            value = _strip_scalar_comment(stripped[2:], path, line_number).strip()
            if not value:
                raise ValueError(f"{path}:{line_number} has an empty manifest list value")
            data[current_list].append(_parse_scalar(value, path, line_number))
            continue
        raise ValueError(f"{path}:{line_number} is not supported by the UOK manifest subset")
    return data


def _strip_scalar_comment(value: str, path: Path, line_number: int) -> str:
    stripped = value.lstrip()
    if not stripped or stripped[0] not in {"'", '"'}:
        for index, character in enumerate(value):
            if character == "#" and (index == 0 or value[index - 1].isspace()):
                return value[:index].rstrip()
        return value.rstrip()

    leading = len(value) - len(stripped)
    quote = stripped[0]
    index = 1
    escaped = False
    while index < len(stripped):
        character = stripped[index]
        if quote == '"' and escaped:
            escaped = False
        elif quote == '"' and character == "\\":
            escaped = True
        elif character == quote:
            if quote == "'" and index + 1 < len(stripped) and stripped[index + 1] == "'":
                index += 1
            else:
                remainder = stripped[index + 1 :]
                if remainder.strip() and not remainder.lstrip().startswith("#"):
                    raise ValueError(
                        f"{path}:{line_number} has unsupported content after a quoted manifest value"
                    )
                return value[: leading + index + 1]
        index += 1
    raise ValueError(f"{path}:{line_number} has an unbalanced quoted manifest value")


def _parse_scalar(value: str, path: Path, line_number: int) -> Any:
    if value == "APP_VERSION":
        return APP_VERSION
    if value == "[]":
        return []
    if value == "true":
        return True
    if value == "false":
        return False
    if len(value) >= 2 and value[0] == value[-1] == "'":
        return value[1:-1].replace("''", "'")
    if len(value) >= 2 and value[0] == value[-1] == '"':
        return _decode_double_quoted_scalar(value[1:-1], path, line_number)
    return value


def _decode_double_quoted_scalar(value: str, path: Path, line_number: int) -> str:
    decoded: list[str] = []
    index = 0
    while index < len(value):
        character = value[index]
        if character != "\\":
            decoded.append(character)
            index += 1
            continue
        index += 1
        if index >= len(value):
            raise ValueError(f"{path}:{line_number} has an incomplete double-quoted escape")
        escape = value[index]
        replacement = DOUBLE_QUOTED_ESCAPES.get(escape)
        if replacement is None:
            raise ValueError(
                f"{path}:{line_number} has unsupported double-quoted escape \\{escape}"
            )
        decoded.append(replacement)
        index += 1
    return "".join(decoded)

from __future__ import annotations

import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any


BINDING_SCHEMA = "uok.coverage_run_binding.v1"
TRUST_MODEL = "trusted_runner_no_malicious_artifact_injection_v1"
JSON_FIELD = "uok_run_binding"
LCOV_PREFIX = "TN:UOK_RUN_BINDING="
RUN_ID = re.compile(r"(?:python|frontend)-[A-Za-z0-9_-]+\Z")
XML_FIELDS = {
    "uok-run-binding-schema": "schema",
    "uok-run-binding-kind": "kind",
    "uok-run-binding-id": "run_id",
}


class CoverageRunBindingError(ValueError):
    pass


def bind_artifacts(kind: str, run_id: str, paths: list[Path]) -> None:
    binding = _binding(kind, run_id)
    for path in paths:
        _require_file(path)
        if path.suffix == ".json":
            _bind_json(path, binding)
        elif path.suffix == ".xml":
            _bind_xml(path, binding)
        elif path.name == "lcov.info":
            _bind_lcov(path, binding)
        else:
            raise CoverageRunBindingError(
                f"coverage run binding format is not registered: {path.name}"
            )


def validate_artifacts(kind: str, run_id: str, paths: list[Path]) -> None:
    binding = _binding(kind, run_id)
    for path in paths:
        _require_file(path)
        if path.suffix == ".json":
            observed = _read_json(path).get(JSON_FIELD)
        elif path.suffix == ".xml":
            observed = _xml_binding(path)
        elif path.name == "lcov.info":
            observed = _lcov_binding(path)
        else:
            raise CoverageRunBindingError(
                f"coverage run binding format is not registered: {path.name}"
            )
        if observed != binding:
            raise CoverageRunBindingError(
                f"coverage artifact is not bound to run {run_id}: {path.name}"
            )


def _binding(kind: str, run_id: str) -> dict[str, str]:
    if kind not in {"python", "frontend"} or RUN_ID.fullmatch(run_id) is None:
        raise CoverageRunBindingError("coverage run binding identity is invalid")
    return {"schema": BINDING_SCHEMA, "kind": kind, "run_id": run_id}


def _require_file(path: Path) -> None:
    if path.is_symlink() or not path.is_file():
        raise CoverageRunBindingError(
            "coverage run binding requires a regular non-symlink file"
        )


def _read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise CoverageRunBindingError(
            f"coverage JSON cannot be bound: {path.name}"
        ) from exc
    if type(value) is not dict:
        raise CoverageRunBindingError(
            f"coverage JSON must be an object: {path.name}"
        )
    return value


def _bind_json(path: Path, binding: dict[str, str]) -> None:
    payload = _read_json(path)
    if JSON_FIELD in payload:
        raise CoverageRunBindingError(
            f"coverage JSON already contains a run binding: {path.name}"
        )
    payload[JSON_FIELD] = binding
    path.write_text(
        json.dumps(payload, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
    )


def _xml_root(path: Path) -> tuple[ET.ElementTree, ET.Element]:
    try:
        tree = ET.parse(path)
    except (OSError, ET.ParseError) as exc:
        raise CoverageRunBindingError(
            f"coverage XML cannot be bound: {path.name}"
        ) from exc
    return tree, tree.getroot()


def _bind_xml(path: Path, binding: dict[str, str]) -> None:
    tree, root = _xml_root(path)
    if any(field in root.attrib for field in XML_FIELDS):
        raise CoverageRunBindingError(
            f"coverage XML already contains a run binding: {path.name}"
        )
    for field, binding_key in XML_FIELDS.items():
        root.set(field, binding[binding_key])
    tree.write(path, encoding="utf-8", xml_declaration=True)


def _xml_binding(path: Path) -> dict[str, str]:
    _, root = _xml_root(path)
    return {
        binding_key: root.get(field, "")
        for field, binding_key in XML_FIELDS.items()
    }


def _lcov_marker(binding: dict[str, str]) -> str:
    return LCOV_PREFIX + "|".join(
        binding[field] for field in ("schema", "kind", "run_id")
    )


def _bind_lcov(path: Path, binding: dict[str, str]) -> None:
    try:
        content = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        raise CoverageRunBindingError(
            "frontend LCOV cannot be bound"
        ) from exc
    if content.startswith(LCOV_PREFIX):
        raise CoverageRunBindingError(
            "frontend LCOV already contains a run binding"
        )
    path.write_text(_lcov_marker(binding) + "\n" + content, encoding="utf-8")


def _lcov_binding(path: Path) -> dict[str, str]:
    try:
        first = path.read_text(encoding="utf-8").splitlines()[0]
    except (OSError, UnicodeDecodeError, IndexError) as exc:
        raise CoverageRunBindingError(
            "frontend LCOV run binding is missing"
        ) from exc
    if not first.startswith(LCOV_PREFIX):
        return {}
    values = first.removeprefix(LCOV_PREFIX).split("|")
    if len(values) != 3:
        return {}
    return dict(zip(("schema", "kind", "run_id"), values, strict=True))


__all__ = [
    "BINDING_SCHEMA",
    "CoverageRunBindingError",
    "JSON_FIELD",
    "LCOV_PREFIX",
    "TRUST_MODEL",
    "XML_FIELDS",
    "bind_artifacts",
    "validate_artifacts",
]

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from collections.abc import Callable
from pathlib import Path
from typing import Any


CONDITION_COUNTS = re.compile(r"\((\d+)/(\d+)\)")


class CoverageCorroborationError(ValueError):
    pass


def python_xml_metrics(
    path: Path,
    repository_root: Path,
) -> dict[str, dict[str, dict[str, int]]]:
    try:
        root = ET.fromstring(path.read_bytes())
    except (OSError, ET.ParseError) as exc:
        raise CoverageCorroborationError(
            "python coverage XML is invalid"
        ) from exc
    source_nodes = root.findall("./sources/source")
    sources = [
        node.text.strip() if node.text else "."
        for node in source_nodes
    ]
    if (
        not sources
        or len(sources) != len(set(sources))
        or ("." in sources and len(sources) != 1)
    ):
        raise CoverageCorroborationError(
            "python coverage XML source roots are missing or duplicated"
        )
    metrics: dict[str, dict[str, dict[str, int]]] = {}
    for node in root.findall(".//class"):
        filename = node.get("filename")
        resolved = _resolve_xml_source(repository_root, sources, filename)
        if resolved in metrics:
            raise CoverageCorroborationError(
                "python coverage XML paths are missing or duplicated"
            )
        lines = {"covered": 0, "total": 0}
        branches = {"covered": 0, "total": 0}
        for line in node.findall("./lines/line"):
            hits = _nonnegative_integer(line.get("hits"), "line hits")
            lines["total"] += 1
            lines["covered"] += int(hits > 0)
            if line.get("branch") == "true":
                match = CONDITION_COUNTS.search(
                    line.get("condition-coverage", "")
                )
                if match is None:
                    raise CoverageCorroborationError(
                        "python coverage XML branch counts are missing"
                    )
                covered, total = (int(value) for value in match.groups())
                if covered > total:
                    raise CoverageCorroborationError(
                        "python coverage XML branch counts are inconsistent"
                    )
                branches["covered"] += covered
                branches["total"] += total
        metrics[resolved] = {"lines": lines, "branches": branches}
    if not metrics:
        raise CoverageCorroborationError(
            "python coverage XML inventory is empty"
        )
    return metrics


def _resolve_xml_source(
    repository_root: Path,
    sources: list[str],
    filename: str | None,
) -> str:
    if not filename or Path(filename).is_absolute() or ".." in Path(filename).parts:
        raise CoverageCorroborationError(
            "python coverage XML class path is invalid"
        )
    root = repository_root.resolve(strict=True)
    candidates: list[Path] = []
    for source in sources:
        source_path = Path(source)
        candidate = (
            source_path / filename
            if source_path.is_absolute()
            else root / source_path / filename
        )
        try:
            relative = candidate.resolve(strict=True).relative_to(root)
        except (OSError, ValueError):
            continue
        if candidate.is_file() and not candidate.is_symlink() and not any(
            parent.is_symlink()
            for parent in (root / relative).parents
            if parent != root
        ):
            candidates.append(relative)
    if len(candidates) != 1:
        raise CoverageCorroborationError(
            "python coverage XML class path is not uniquely source-bound"
        )
    return candidates[0].as_posix()


def frontend_lcov_metrics(path: Path) -> dict[str, dict[str, dict[str, int]]]:
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeDecodeError) as exc:
        raise CoverageCorroborationError("frontend LCOV is invalid") from exc
    metrics: dict[str, dict[str, dict[str, int]]] = {}
    current: dict[str, Any] | None = None
    for line in lines:
        if line.startswith("SF:"):
            if current is not None:
                raise CoverageCorroborationError(
                    "frontend LCOV record is incomplete"
                )
            current = {"path": line[3:], "values": {}}
        elif line == "end_of_record":
            _finish_lcov_record(current, metrics)
            current = None
        elif current is not None and ":" in line:
            key, raw = line.split(":", 1)
            if key in {"LF", "LH", "BRF", "BRH"}:
                if key in current["values"]:
                    raise CoverageCorroborationError(
                        "frontend LCOV summary is duplicated"
                    )
                current["values"][key] = _nonnegative_integer(
                    raw,
                    f"LCOV {key}",
                )
    if current is not None:
        raise CoverageCorroborationError(
            "frontend LCOV record is incomplete"
        )
    if not metrics:
        raise CoverageCorroborationError("frontend LCOV inventory is empty")
    return metrics


def require_corroboration(
    root: Path,
    kind: str,
    path: Path,
    normalize: Callable[[Path, str, str], str],
    expected: list[str],
    primary: dict[str, dict[str, dict[str, int]]],
) -> None:
    raw = (
        python_xml_metrics(path, root)
        if kind == "python"
        else frontend_lcov_metrics(path)
    )
    normalized: dict[str, dict[str, dict[str, int]]] = {}
    for raw_path, metrics in raw.items():
        source = normalize(root, raw_path, kind)
        if source in normalized:
            raise CoverageCorroborationError(
                f"{kind} corroboration contains duplicate repository paths"
            )
        normalized[source] = metrics
    if sorted(normalized) != expected:
        raise CoverageCorroborationError(
            f"{kind} corroboration does not match tracked production sources"
        )
    if normalized != primary:
        raise CoverageCorroborationError(
            f"{kind} coverage metrics do not match corroborating evidence"
        )


def _finish_lcov_record(
    current: dict[str, Any] | None,
    metrics: dict[str, dict[str, dict[str, int]]],
) -> None:
    if current is None or not current["path"]:
        raise CoverageCorroborationError(
            "frontend LCOV record has no source path"
        )
    path = str(current["path"])
    if path in metrics:
        raise CoverageCorroborationError(
            "frontend LCOV source path is duplicated"
        )
    values = current["values"]
    if set(values) != {"LF", "LH", "BRF", "BRH"}:
        raise CoverageCorroborationError(
            "frontend LCOV summary is incomplete"
        )
    if values["LH"] > values["LF"] or values["BRH"] > values["BRF"]:
        raise CoverageCorroborationError(
            "frontend LCOV summary is inconsistent"
        )
    metrics[path] = {
        "lines": {"covered": values["LH"], "total": values["LF"]},
        "branches": {"covered": values["BRH"], "total": values["BRF"]},
    }


def _nonnegative_integer(value: object, label: str) -> int:
    if not isinstance(value, str) or not value.isdigit():
        raise CoverageCorroborationError(f"{label} must be an integer")
    parsed = int(value)
    if parsed < 0:
        raise CoverageCorroborationError(
            f"{label} must be nonnegative"
        )
    return parsed


__all__ = [
    "CoverageCorroborationError",
    "frontend_lcov_metrics",
    "python_xml_metrics",
    "require_corroboration",
]

from __future__ import annotations

import hashlib
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Any

from coverage_corroboration import (
    CoverageCorroborationError,
    require_corroboration,
)
from engineering_artifact_validation import (
    MeasurementValidationError as MeasurementValidationError,
    coverage_inventory_path,
    expected_coverage_inventory,
    fail,
    load_json,
    repo_file,
    strict_keys,
)


JSON_MEDIA_TYPE = "application/json"
PYTHON_COVERAGE_PATH = "var/evidence/coverage/python/coverage.json"
FRONTEND_COVERAGE_PATH = (
    "var/evidence/coverage/frontend/coverage-summary.json"
)
CORROBORATION_PATHS = {
    "python": "var/evidence/coverage/python/coverage.xml",
    "frontend": "var/evidence/coverage/frontend/lcov.info",
}
SOURCE_SPECS = (
    ("python", PYTHON_COVERAGE_PATH),
    ("frontend", FRONTEND_COVERAGE_PATH),
)


def _metric(summary: Any, covered_key: str, total_key: str, label: str) -> dict[str, int]:
    if type(summary) is not dict:
        fail(f"{label} must be an object")
    covered = summary.get(covered_key)
    total = summary.get(total_key)
    if type(covered) is not int or type(total) is not int:
        fail(f"{label} totals must be integers")
    if total < 0 or covered < 0 or covered > total:
        fail(f"{label} totals are inconsistent")
    return {"covered": covered, "total": total}


def _language_metrics(
    root: Path,
    path: Path,
    kind: str,
    corroboration_path: Path,
) -> dict[str, Any]:
    payload, _ = load_json(path, f"{kind} coverage")
    if type(payload) is not dict:
        fail(f"{kind} coverage must be an object")
    if kind == "python":
        files = payload.get("files")
        total_summary = payload.get("totals")
        keys = (
            ("covered_lines", "num_statements"),
            ("covered_branches", "num_branches"),
        )
    else:
        files = {
            key: value
            for key, value in payload.items()
            if key not in {"total", "uok_run_binding"}
        }
        total_summary = payload.get("total")
        keys = (("covered", "total"), ("covered", "total"))
    if type(files) is not dict or not files:
        fail(f"{kind} coverage inventory must be a non-empty object")
    inventory: list[str] = []
    file_metrics: dict[str, dict[str, dict[str, int]]] = {}
    sums = [{"covered": 0, "total": 0}, {"covered": 0, "total": 0}]
    for raw_path, record in files.items():
        source = coverage_inventory_path(root, raw_path, kind)
        inventory.append(source)
        if type(record) is not dict:
            fail(f"{kind} coverage file record must be an object")
        summaries = [record.get("summary"), record.get("summary")]
        if kind == "frontend":
            summaries = [record.get("lines"), record.get("branches")]
        metrics = []
        for index, (covered_key, total_key) in enumerate(keys):
            value = _metric(
                summaries[index],
                covered_key,
                total_key,
                f"{kind} coverage file metric",
            )
            for field in ("covered", "total"):
                sums[index][field] += value[field]
            metrics.append(value)
        file_metrics[source] = {
            "lines": metrics[0],
            "branches": metrics[1],
        }
    inventory.sort()
    if len(inventory) != len(set(inventory)):
        fail(f"{kind} coverage inventory contains duplicate repository paths")
    if inventory != expected_coverage_inventory(root, kind):
        fail(f"{kind} coverage inventory does not match tracked production sources")
    try:
        require_corroboration(
            root,
            kind,
            corroboration_path,
            coverage_inventory_path,
            inventory,
            file_metrics,
        )
    except CoverageCorroborationError as exc:
        fail(str(exc))
    total_summaries = [total_summary, total_summary]
    if kind == "frontend" and type(total_summary) is dict:
        total_summaries = [total_summary.get("lines"), total_summary.get("branches")]
    totals = [
        _metric(
            total_summaries[index],
            covered_key,
            total_key,
            f"{kind} coverage total metric",
        )
        for index, (covered_key, total_key) in enumerate(keys)
    ]
    if totals != sums or any(metric["total"] <= 0 for metric in totals):
        fail(f"{kind} coverage totals do not match its complete inventory")
    return {
        "inventory": {"file_count": len(inventory), "files": inventory},
        "lines": totals[0],
        "branches": totals[1],
    }


def source_record(
    root: Path,
    name: str,
    relative_path: str,
    label: str = "coverage source",
) -> dict[str, Any]:
    path = repo_file(root, relative_path, f"{name} {label}")
    raw = path.read_bytes()
    return {
        "name": name,
        "path": relative_path,
        "sha256": hashlib.sha256(raw).hexdigest(),
        "bytes": len(raw),
        "media_type": JSON_MEDIA_TYPE,
    }


def language_coverage_metrics(
    root: Path,
    kind: str,
    relative_path: str,
    corroboration_relative_path: str | None = None,
) -> dict[str, Any]:
    if kind not in {"python", "frontend"}:
        fail("coverage source kind is not registered")
    path = repo_file(root, relative_path, f"{kind} coverage source")
    corroboration = repo_file(
        root,
        corroboration_relative_path or CORROBORATION_PATHS[kind],
        f"{kind} coverage corroboration",
    )
    return _language_metrics(root, path, kind, corroboration)


def coverage_metrics(root: Path) -> dict[str, Any]:
    paths = dict(SOURCE_SPECS)
    python = language_coverage_metrics(root, "python", paths["python"])
    frontend = language_coverage_metrics(root, "frontend", paths["frontend"])
    combined = {
        dimension: {
            field: python[dimension][field] + frontend[dimension][field]
            for field in ("covered", "total")
        }
        for dimension in ("lines", "branches")
    }
    return {"python": python, "frontend": frontend, "combined": combined}


def validate_metrics_shape(metrics: Any) -> None:
    metrics = strict_keys(metrics, {"python", "frontend", "combined"}, "coverage metrics")
    for kind in ("python", "frontend"):
        language = strict_keys(
            metrics[kind],
            {"inventory", "lines", "branches"},
            f"{kind} metrics",
        )
        inventory = strict_keys(
            language["inventory"],
            {"file_count", "files"},
            f"{kind} inventory",
        )
        if type(inventory["file_count"]) is not int or type(inventory["files"]) is not list:
            fail(f"{kind} inventory has invalid field types")
        if any(type(path) is not str for path in inventory["files"]):
            fail(f"{kind} inventory files must be strings")
    for kind in ("python", "frontend", "combined"):
        for dimension in ("lines", "branches"):
            metric = strict_keys(
                metrics[kind][dimension],
                {"covered", "total"},
                f"{kind} {dimension}",
            )
            if any(type(metric[field]) is not int for field in ("covered", "total")):
                fail(f"{kind} {dimension} totals must be integers")


def coverage_score(metrics: dict[str, Any]) -> int:
    line = metrics["combined"]["lines"]
    branch = metrics["combined"]["branches"]
    score = (
        Decimal(line["covered"]) / Decimal(line["total"])
        + Decimal(branch["covered"]) / Decimal(branch["total"])
    ) * Decimal(50)
    return int(score.quantize(Decimal("1"), rounding=ROUND_HALF_UP))

from __future__ import annotations

import re
import subprocess
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from coverage_provenance import PROVENANCE_SPECS, load_coverage_provenance
from engineering_coverage import (
    JSON_MEDIA_TYPE,
    SOURCE_SPECS,
    MeasurementValidationError,
    coverage_metrics,
    coverage_score,
    fail,
    load_json,
    source_record,
    strict_keys,
    validate_metrics_shape,
)
from engineering_inventory import (
    InventoryDiscoveryError,
    assert_no_hidden_index_entries,
)

__all__ = [
    "COVERAGE_METHOD",
    "MEASUREMENT_SCHEMA",
    "MeasurementValidationError",
    "PROVENANCE_SPECS",
    "build_measurements",
    "coverage_score",
    "load_measurements",
    "validate_measurements",
]


MEASUREMENT_SCHEMA = "uok.engineering_measurements.v2"
COVERAGE_METHOD = "coverage_combined_v2"
UNAVAILABLE_REASONS = {
    "runtime_efficiency": (
        "No registered local method verifies latency, throughput, and "
        "resource-consumption outcomes."
    ),
    "security_and_supply_chain": (
        "No registered local method verifies security and supply-chain outcomes."
    ),
    "ci_and_release_readiness": (
        "No registered local method verifies hosted CI and immutable release outcomes."
    ),
}
HEX_40 = re.compile(r"[0-9a-f]{40}\Z")
HEX_64 = re.compile(r"[0-9a-f]{64}\Z")


def _git(root: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode:
        fail(f"git {' '.join(args)} failed: {result.stderr.strip()}")
    return result.stdout.strip()


def _repository_state(root: Path) -> dict[str, str]:
    resolved_root = root.resolve(strict=True)
    git_root = Path(_git(root, "rev-parse", "--show-toplevel")).resolve(strict=True)
    if git_root != resolved_root:
        fail("measurement repository root does not match the current Git root")
    head = _git(root, "rev-parse", "--verify", "HEAD")
    if HEX_40.fullmatch(head) is None:
        fail("measurement repository HEAD must be a lowercase 40-hex commit")
    try:
        assert_no_hidden_index_entries(root)
    except InventoryDiscoveryError as exc:
        fail(str(exc))
    if _git(root, "status", "--porcelain=v1", "--untracked-files=all"):
        fail("measurement repository worktree must be clean")
    origin = _git(root, "remote", "get-url", "origin")
    if not origin:
        fail("measurement repository must have a non-empty origin")
    return {"origin": origin, "head": head, "worktree": "clean"}


def _parse_observed_at(value: Any) -> str:
    if not isinstance(value, str) or not value or value != value.strip():
        fail("observed_at must be a timezone-aware timestamp string")
    try:
        observed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        fail("observed_at must be a valid ISO-8601 timestamp")
    if observed.tzinfo is None or observed.utcoffset() is None:
        fail("observed_at must include a timezone offset")
    return value


def _validate_source_records(
    root: Path,
    sources: Any,
    specs: tuple[tuple[str, str], ...],
    label: str,
) -> list[dict[str, Any]]:
    if type(sources) is not list or len(sources) != len(specs):
        fail(f"{label} must contain exactly {len(specs)} registered sources")
    expected = [
        source_record(root, name, relative_path, f"{label} source")
        for name, relative_path in specs
    ]
    for source in sources:
        source = strict_keys(
            source,
            {"name", "path", "sha256", "bytes", "media_type"},
            f"{label} source",
        )
        if type(source["bytes"]) is not int or source["bytes"] <= 0:
            fail(f"{label} source bytes must be a positive integer")
        if source["media_type"] != JSON_MEDIA_TYPE:
            fail(f"{label} source media_type must be {JSON_MEDIA_TYPE}")
        if (
            not isinstance(source["sha256"], str)
            or HEX_64.fullmatch(source["sha256"]) is None
        ):
            fail(f"{label} source sha256 must be lowercase 64-hex")
    if sources != expected:
        fail(f"{label} source metadata does not match the registered artifacts")
    return sources


def validate_measurements(payload: Any, root: Path) -> dict[str, Any]:
    payload = strict_keys(
        payload,
        {"schema", "repository", "observed_at", "categories"},
        "measurement evidence",
    )
    if payload["schema"] != MEASUREMENT_SCHEMA:
        fail(f"measurement schema must be {MEASUREMENT_SCHEMA}")
    observed_at = _parse_observed_at(payload["observed_at"])
    repository = strict_keys(
        payload["repository"],
        {"origin", "head", "worktree"},
        "measurement repository",
    )
    if any(not isinstance(repository[field], str) for field in repository):
        fail("measurement repository fields must be strings")
    if repository != _repository_state(root):
        fail("measurement repository binding does not match the current clean HEAD")
    categories = strict_keys(
        payload["categories"],
        {"test_coverage", *UNAVAILABLE_REASONS},
        "measurement categories",
    )
    coverage = strict_keys(
        categories["test_coverage"],
        {"status", "method", "sources", "provenance", "metrics"},
        "test_coverage measurement",
    )
    if coverage["status"] != "measured" or coverage["method"] != COVERAGE_METHOD:
        fail(f"test_coverage must use registered method {COVERAGE_METHOD}")
    _validate_source_records(root, coverage["sources"], SOURCE_SPECS, "coverage")
    _validate_source_records(
        root,
        coverage["provenance"],
        PROVENANCE_SPECS,
        "coverage provenance",
    )
    for kind, _ in PROVENANCE_SPECS:
        load_coverage_provenance(
            root,
            kind,
            repository=repository,
            observed_at=observed_at,
        )
    expected_metrics = coverage_metrics(root)
    validate_metrics_shape(coverage["metrics"])
    if coverage["metrics"] != expected_metrics:
        fail("coverage metrics do not match the registered artifact contents")
    for name, reason in UNAVAILABLE_REASONS.items():
        category = strict_keys(
            categories[name],
            {"status", "reason"},
            f"{name} measurement",
        )
        if category != {"status": "unavailable", "reason": reason}:
            fail(f"{name} must remain unavailable for this local method")
    return payload


def build_measurements(root: Path, observed_at: str | None = None) -> dict[str, Any]:
    payload = {
        "schema": MEASUREMENT_SCHEMA,
        "repository": _repository_state(root),
        "observed_at": observed_at or datetime.now(UTC).isoformat(),
        "categories": {
            "test_coverage": {
                "status": "measured",
                "method": COVERAGE_METHOD,
                "sources": [
                    source_record(root, name, relative_path)
                    for name, relative_path in SOURCE_SPECS
                ],
                "provenance": [
                    source_record(
                        root,
                        name,
                        relative_path,
                        "coverage provenance source",
                    )
                    for name, relative_path in PROVENANCE_SPECS
                ],
                "metrics": coverage_metrics(root),
            },
            **{
                name: {"status": "unavailable", "reason": reason}
                for name, reason in UNAVAILABLE_REASONS.items()
            },
        },
    }
    return validate_measurements(payload, root)


def load_measurements(path: Path, root: Path) -> dict[str, Any]:
    if path.is_symlink():
        fail("measurement evidence file may not be a symlink")
    payload, _ = load_json(path, "measurement evidence")
    return validate_measurements(payload, root)

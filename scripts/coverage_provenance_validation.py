from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path
from typing import Any

from coverage_provenance import (
    HEX_64,
    PROVENANCE_SCHEMA,
    SPECS,
)
from coverage_provenance_artifacts import (
    artifact_record as _artifact_record,
    inventory_record as _inventory_record,
)
from coverage_run_binding import (
    TRUST_MODEL,
    CoverageRunBindingError,
    validate_artifacts,
)
from engineering_coverage import (
    fail,
    language_coverage_metrics,
    load_json,
    repo_file,
    strict_keys,
)


def load_coverage_provenance(
    root: Path,
    kind: str,
    *,
    repository: dict[str, str],
    observed_at: str,
) -> dict[str, Any]:
    spec = SPECS.get(kind)
    if spec is None:
        fail("coverage provenance kind is not registered")
    path = repo_file(root, spec.provenance_path, f"{kind} coverage provenance")
    payload, _ = load_json(path, f"{kind} coverage provenance")
    payload = strict_keys(
        payload,
        {
            "schema", "kind", "method", "trust_model", "run_id", "repository",
            "started_at", "completed_at", "artifacts", "inventory",
        },
        f"{kind} coverage provenance",
    )
    if (
        payload["schema"] != PROVENANCE_SCHEMA
        or payload["kind"] != kind
        or payload["method"] != spec.method
        or payload["trust_model"] != TRUST_MODEL
        or not isinstance(payload["run_id"], str)
        or re.fullmatch(rf"{kind}-[A-Za-z0-9_-]+", payload["run_id"])
        is None
    ):
        fail(f"{kind} coverage provenance contract is not registered")
    bound_repository = strict_keys(
        payload["repository"],
        {"origin", "head", "worktree"},
        f"{kind} provenance repository",
    )
    if bound_repository != repository:
        fail(f"{kind} coverage provenance does not match the current clean HEAD")
    started = _parse_time(payload["started_at"], f"{kind} coverage started_at")
    completed = _parse_time(payload["completed_at"], f"{kind} coverage completed_at")
    observed = _parse_time(observed_at, "measurement observed_at")
    if started > completed or completed > observed:
        fail(f"{kind} coverage provenance timestamps are inconsistent")
    if type(payload["artifacts"]) is not list:
        fail(f"{kind} provenance artifacts must be a list")
    artifacts = [
        strict_keys(
            artifact,
            {"path", "sha256", "bytes", "media_type"},
            f"{kind} provenance artifact",
        )
        for artifact in payload["artifacts"]
    ]
    expected_artifacts = [
        _artifact_record(root, artifact, f"{kind} coverage artifact")
        for artifact in spec.artifacts
    ]
    if artifacts != expected_artifacts:
        fail(f"{kind} coverage provenance does not match its report artifacts")
    try:
        validate_artifacts(
            kind,
            payload["run_id"],
            [
                repo_file(root, artifact.path, f"{kind} coverage artifact")
                for artifact in spec.artifacts
            ],
        )
    except CoverageRunBindingError as exc:
        fail(str(exc))
    inventory = strict_keys(
        payload["inventory"],
        {"file_count", "sha256"},
        f"{kind} provenance inventory",
    )
    if (
        type(inventory["file_count"]) is not int
        or inventory["file_count"] <= 0
        or not isinstance(inventory["sha256"], str)
        or HEX_64.fullmatch(inventory["sha256"]) is None
        or inventory != _inventory_record(root, kind)
    ):
        fail(f"{kind} coverage provenance inventory is invalid")
    language_coverage_metrics(root, kind, spec.report_path)
    return payload


def _parse_time(value: Any, label: str) -> datetime:
    if not isinstance(value, str) or not value or value != value.strip():
        fail(f"{label} must be a timezone-aware timestamp")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        fail(f"{label} must be a valid ISO-8601 timestamp")
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        fail(f"{label} must include a timezone offset")
    return parsed


__all__ = ["load_coverage_provenance"]

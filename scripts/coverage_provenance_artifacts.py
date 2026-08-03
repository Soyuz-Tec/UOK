from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

from coverage_run_binding import (
    CoverageRunBindingError,
    bind_artifacts,
    validate_artifacts,
)
from engineering_coverage import (
    expected_coverage_inventory,
    fail,
    repo_file,
)


def artifact_record(
    root: Path,
    artifact: Any,
    label: str,
) -> dict[str, Any]:
    path = repo_file(root, artifact.path, label)
    raw = path.read_bytes()
    return {
        "path": artifact.path,
        "sha256": hashlib.sha256(raw).hexdigest(),
        "bytes": len(raw),
        "media_type": artifact.media_type,
    }


def inventory_record(root: Path, kind: str) -> dict[str, Any]:
    inventory = expected_coverage_inventory(root, kind)
    payload = "\n".join(inventory).encode("utf-8")
    return {
        "file_count": len(inventory),
        "sha256": hashlib.sha256(payload).hexdigest(),
    }


def output_artifact(run: Any, artifact: Any) -> str:
    return (
        Path(run.output_directory) / Path(artifact.path).name
    ).as_posix()


def bind_coverage_run_artifacts(root: Path, run: Any) -> None:
    try:
        bind_artifacts(
            run.spec.kind,
            run.run_id,
            _artifact_paths(root, run, canonical=False),
        )
    except CoverageRunBindingError as exc:
        fail(str(exc))


def validate_coverage_run_artifacts(
    root: Path,
    run: Any,
    *,
    canonical: bool,
) -> None:
    try:
        validate_artifacts(
            run.spec.kind,
            run.run_id,
            _artifact_paths(root, run, canonical=canonical),
        )
    except CoverageRunBindingError as exc:
        fail(str(exc))


def _artifact_paths(
    root: Path,
    run: Any,
    *,
    canonical: bool,
) -> list[Path]:
    return [
        repo_file(
            root,
            artifact.path if canonical else output_artifact(run, artifact),
            f"{run.spec.kind} {'coverage' if canonical else 'run'} artifact",
        )
        for artifact in run.spec.artifacts
    ]


__all__ = [
    "artifact_record",
    "bind_coverage_run_artifacts",
    "inventory_record",
    "output_artifact",
    "validate_coverage_run_artifacts",
]

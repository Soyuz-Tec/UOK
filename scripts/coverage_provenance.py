from __future__ import annotations

import json
import os
import re
import subprocess
import tempfile
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from engineering_coverage import (
    JSON_MEDIA_TYPE,
    fail,
    language_coverage_metrics,
    repo_file,
)
from engineering_inventory import (
    InventoryDiscoveryError,
    assert_no_hidden_index_entries,
)
from coverage_provenance_artifacts import (
    artifact_record as _artifact_record,
    bind_coverage_run_artifacts as bind_coverage_run_artifacts,
    inventory_record as _inventory_record,
    output_artifact as _output_artifact,
    validate_coverage_run_artifacts,
)
from coverage_run_binding import TRUST_MODEL
from coverage_run_directory import remove_directory_with_retry

PROVENANCE_SCHEMA = "uok.coverage_provenance.v2"
HEX_40 = re.compile(r"[0-9a-f]{40}\Z")
HEX_64 = re.compile(r"[0-9a-f]{64}\Z")


@dataclass(frozen=True)
class CoverageArtifact:
    path: str
    media_type: str

@dataclass(frozen=True)
class CoverageSpec:
    kind: str
    method: str
    artifacts: tuple[CoverageArtifact, ...]
    provenance_path: str

    @property
    def report_path(self) -> str:
        return self.artifacts[0].path

    @property
    def corroboration_path(self) -> str:
        return self.artifacts[1].path

SPECS = {
    "python": CoverageSpec(
        kind="python",
        method="python_sequential_coverage_v1",
        artifacts=(
            CoverageArtifact(
                "var/evidence/coverage/python/coverage.json",
                JSON_MEDIA_TYPE,
            ),
            CoverageArtifact(
                "var/evidence/coverage/python/coverage.xml",
                "application/xml",
            ),
        ),
        provenance_path="var/evidence/coverage/python/provenance.json",
    ),
    "frontend": CoverageSpec(
        kind="frontend",
        method="frontend_vitest_v8_coverage_v1",
        artifacts=(
            CoverageArtifact(
                "var/evidence/coverage/frontend/coverage-summary.json",
                JSON_MEDIA_TYPE,
            ),
            CoverageArtifact(
                "var/evidence/coverage/frontend/lcov.info",
                "text/plain; charset=utf-8",
            ),
            CoverageArtifact(
                "var/evidence/coverage/frontend/cobertura-coverage.xml",
                "application/xml",
            ),
        ),
        provenance_path="var/evidence/coverage/frontend/provenance.json",
    ),
}
PROVENANCE_SPECS = tuple(
    (kind, spec.provenance_path)
    for kind, spec in SPECS.items()
)


@dataclass(frozen=True)
class RepositorySnapshot:
    repository: dict[str, str]
    status: str


@dataclass(frozen=True)
class CoverageRun:
    spec: CoverageSpec
    snapshot: RepositorySnapshot
    started_at: str
    output_directory: str
    run_id: str

def _git(root: Path, *arguments: str) -> str:
    result = subprocess.run(
        ["git", *arguments],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode:
        fail(f"git {' '.join(arguments)} failed while binding coverage provenance")
    return result.stdout.strip()


def repository_snapshot(root: Path) -> RepositorySnapshot:
    resolved_root = root.resolve(strict=True)
    git_root = Path(_git(root, "rev-parse", "--show-toplevel")).resolve(strict=True)
    if git_root != resolved_root:
        fail("coverage provenance root does not match the current Git root")
    head = _git(root, "rev-parse", "--verify", "HEAD")
    if HEX_40.fullmatch(head) is None:
        fail("coverage provenance HEAD must be lowercase 40-hex")
    try:
        assert_no_hidden_index_entries(root)
    except InventoryDiscoveryError as exc:
        fail(str(exc))
    status = _git(root, "status", "--porcelain=v1", "--untracked-files=all")
    origin = _git(root, "remote", "get-url", "origin")
    if not origin:
        fail("coverage provenance requires a non-empty origin")
    return RepositorySnapshot(
        repository={
            "origin": origin,
            "head": head,
            "worktree": "clean" if not status else "dirty",
        },
        status=status,
    )


def _utc_now() -> str:
    return datetime.now(UTC).isoformat()


def _invalidate_path(root: Path, relative_path: str) -> None:
    path = root.joinpath(*Path(relative_path).parts)
    if path.exists() and path.is_dir() and not path.is_symlink():
        fail("coverage artifact destination may not be a directory")
    path.unlink(missing_ok=True)


def begin_coverage_run(root: Path, kind: str) -> CoverageRun:
    spec = SPECS.get(kind)
    if spec is None:
        fail("coverage provenance kind is not registered")
    for relative_path in (
        spec.provenance_path,
        *(artifact.path for artifact in spec.artifacts),
    ):
        _invalidate_path(root, relative_path)
    run_parent = (
        root / "var" / "evidence" / "coverage" / kind / ".runs"
    )
    run_parent.mkdir(parents=True, exist_ok=True)
    output = Path(tempfile.mkdtemp(prefix=f"{kind}-", dir=run_parent))
    return CoverageRun(
        spec=spec,
        snapshot=repository_snapshot(root),
        started_at=_utc_now(),
        output_directory=output.relative_to(root).as_posix(),
        run_id=output.name,
    )


def discard_coverage_run(root: Path, run: CoverageRun) -> None:
    parent = (
        root / "var" / "evidence" / "coverage" / run.spec.kind / ".runs"
    ).resolve(strict=True)
    output = root.joinpath(*Path(run.output_directory).parts)
    try:
        resolved = output.resolve(strict=True)
    except FileNotFoundError:
        return
    if resolved.parent != parent or not resolved.name.startswith(
        f"{run.spec.kind}-"
    ):
        fail("coverage run output directory is outside the registered run root")
    remove_directory_with_retry(resolved)


def _publish_run_artifacts(root: Path, run: CoverageRun) -> None:
    for artifact in run.spec.artifacts:
        source = repo_file(
            root,
            _output_artifact(run, artifact),
            f"{run.spec.kind} run artifact",
        )
        destination = root.joinpath(*Path(artifact.path).parts)
        destination.parent.mkdir(parents=True, exist_ok=True)
        source.replace(destination)


def seal_coverage_run(root: Path, run: CoverageRun) -> Path | None:
    completed = repository_snapshot(root)
    if completed != run.snapshot:
        fail("repository identity changed while coverage was running")
    validate_coverage_run_artifacts(root, run, canonical=False)
    language_coverage_metrics(
        root,
        run.spec.kind,
        _output_artifact(run, run.spec.artifacts[0]),
        _output_artifact(run, run.spec.artifacts[1]),
    )
    for artifact in run.spec.artifacts[2:]:
        repo_file(
            root,
            _output_artifact(run, artifact),
            f"{run.spec.kind} supplemental coverage artifact",
        )
    _publish_run_artifacts(root, run)
    validate_coverage_run_artifacts(root, run, canonical=True)
    language_coverage_metrics(root, run.spec.kind, run.spec.report_path)
    if repository_snapshot(root) != completed:
        fail("repository identity changed while coverage was sealing")
    if completed.repository["worktree"] != "clean":
        return None
    payload = {
        "schema": PROVENANCE_SCHEMA,
        "kind": run.spec.kind,
        "method": run.spec.method,
        "trust_model": TRUST_MODEL,
        "run_id": run.run_id,
        "repository": completed.repository,
        "started_at": run.started_at,
        "completed_at": _utc_now(),
        "artifacts": [
            _artifact_record(
                root,
                artifact,
                f"{run.spec.kind} coverage artifact",
            )
            for artifact in run.spec.artifacts
        ],
        "inventory": _inventory_record(root, run.spec.kind),
    }
    destination = root.joinpath(*Path(run.spec.provenance_path).parts)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(f".{destination.name}.{os.getpid()}.tmp")
    try:
        temporary.write_text(
            json.dumps(payload, indent=2, allow_nan=False) + "\n",
            encoding="utf-8",
        )
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)
    return destination


def load_coverage_provenance(
    root: Path,
    kind: str,
    *,
    repository: dict[str, str],
    observed_at: str,
) -> dict[str, Any]:
    from coverage_provenance_validation import (
        load_coverage_provenance as validate,
    )

    return validate(
        root,
        kind,
        repository=repository,
        observed_at=observed_at,
    )

from __future__ import annotations

import sys
import json
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[1]
for import_root in (REPO_ROOT / "tests", REPO_ROOT / "scripts"):
    if str(import_root) not in sys.path:
        sys.path.insert(0, str(import_root))

import coverage_provenance  # noqa: E402
import engineering_measurements  # noqa: E402
from coverage_corroboration import python_xml_metrics  # noqa: E402
from coverage_run_binding import JSON_FIELD, LCOV_PREFIX, XML_FIELDS  # noqa: E402
from engineering_coverage import expected_coverage_inventory  # noqa: E402
from engineering_measurement_test_support import (  # noqa: E402
    create_measurement_repo,
    git,
    write,
)


@pytest.fixture
def measurement_repo(tmp_path: Path) -> Path:
    return create_measurement_repo(tmp_path, engineering_measurements.SOURCE_SPECS)


def _artifact_bytes(
    root: Path,
    spec: coverage_provenance.CoverageSpec,
) -> dict[str, bytes]:
    return {
        Path(artifact.path).name: (root / artifact.path).read_bytes()
        for artifact in spec.artifacts
    }


def _copy_fixture_artifacts_into_run_directory(
    root: Path,
    run: coverage_provenance.CoverageRun,
    artifacts: dict[str, bytes],
    *,
    bind: bool = True,
) -> None:
    output = root / run.output_directory
    for name, raw in artifacts.items():
        (output / name).write_bytes(raw)
    if bind:
        _strip_fixture_bindings(list(output.iterdir()))
        coverage_provenance.bind_coverage_run_artifacts(root, run)


def _strip_fixture_bindings(paths: list[Path]) -> None:
    for path in paths:
        if path.suffix == ".json":
            payload = json.loads(path.read_text(encoding="utf-8"))
            payload.pop(JSON_FIELD, None)
            path.write_text(json.dumps(payload), encoding="utf-8")
        elif path.suffix == ".xml":
            tree = ET.parse(path)
            for field in XML_FIELDS:
                tree.getroot().attrib.pop(field, None)
            tree.write(path, encoding="unicode")
        elif path.name == "lcov.info":
            lines = path.read_text(encoding="utf-8").splitlines()
            if lines and lines[0].startswith(LCOV_PREFIX):
                lines.pop(0)
            path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def test_seal_publishes_a_complete_supplied_run_directory(
    measurement_repo: Path,
) -> None:
    spec = coverage_provenance.SPECS["python"]
    provenance = measurement_repo / spec.provenance_path
    artifacts = _artifact_bytes(measurement_repo, spec)
    assert provenance.is_file()

    run = coverage_provenance.begin_coverage_run(measurement_repo, "python")
    assert not provenance.exists()
    assert all(not (measurement_repo / artifact.path).exists() for artifact in spec.artifacts)
    _copy_fixture_artifacts_into_run_directory(
        measurement_repo,
        run,
        artifacts,
    )
    try:
        sealed = coverage_provenance.seal_coverage_run(measurement_repo, run)
    finally:
        coverage_provenance.discard_coverage_run(measurement_repo, run)

    assert sealed == provenance
    payload = coverage_provenance.load_coverage_provenance(
        measurement_repo,
        "python",
        repository=run.snapshot.repository,
        observed_at="2099-01-01T00:00:00+00:00",
    )
    assert payload["repository"]["head"] == run.snapshot.repository["head"]


def test_dirty_coverage_run_passes_without_sealing_provenance(
    measurement_repo: Path,
) -> None:
    spec = coverage_provenance.SPECS["python"]
    artifacts = _artifact_bytes(measurement_repo, spec)
    write(measurement_repo / "untracked.txt", "development change\n")
    provenance = measurement_repo / spec.provenance_path

    run = coverage_provenance.begin_coverage_run(measurement_repo, "python")
    _copy_fixture_artifacts_into_run_directory(
        measurement_repo,
        run,
        artifacts,
    )
    try:
        assert coverage_provenance.seal_coverage_run(measurement_repo, run) is None
    finally:
        coverage_provenance.discard_coverage_run(measurement_repo, run)
    assert not provenance.exists()


def test_missing_new_run_outputs_cannot_seal_after_head_changes(
    measurement_repo: Path,
) -> None:
    write(measurement_repo / "README.md", "new clean head\n")
    git(measurement_repo, "add", "README.md")
    git(measurement_repo, "commit", "-m", "advance source head")
    run = coverage_provenance.begin_coverage_run(measurement_repo, "python")

    try:
        with pytest.raises(
            engineering_measurements.MeasurementValidationError,
            match="run artifact.*missing|coverage source.*missing",
        ):
            coverage_provenance.seal_coverage_run(measurement_repo, run)
    finally:
        coverage_provenance.discard_coverage_run(measurement_repo, run)


def test_repository_change_during_coverage_fails_without_provenance(
    measurement_repo: Path,
) -> None:
    spec = coverage_provenance.SPECS["python"]
    provenance = measurement_repo / spec.provenance_path
    artifacts = _artifact_bytes(measurement_repo, spec)
    run = coverage_provenance.begin_coverage_run(measurement_repo, "python")
    _copy_fixture_artifacts_into_run_directory(
        measurement_repo,
        run,
        artifacts,
    )
    write(measurement_repo / "src/uok/example.py", "value = 99\n")

    try:
        with pytest.raises(
            engineering_measurements.MeasurementValidationError,
            match="identity changed",
        ):
            coverage_provenance.seal_coverage_run(measurement_repo, run)
    finally:
        coverage_provenance.discard_coverage_run(measurement_repo, run)
    assert not provenance.exists()


def test_artifacts_bound_to_an_older_run_cannot_be_replayed(
    measurement_repo: Path,
) -> None:
    spec = coverage_provenance.SPECS["python"]
    artifacts = _artifact_bytes(measurement_repo, spec)
    write(measurement_repo / "src/uok/example.py", "value = 2\n")
    git(measurement_repo, "add", "src/uok/example.py")
    git(measurement_repo, "commit", "-m", "advance covered source")
    run = coverage_provenance.begin_coverage_run(measurement_repo, "python")
    _copy_fixture_artifacts_into_run_directory(
        measurement_repo,
        run,
        artifacts,
        bind=False,
    )

    try:
        with pytest.raises(
            engineering_measurements.MeasurementValidationError,
            match="not bound to run",
        ):
            coverage_provenance.seal_coverage_run(measurement_repo, run)
    finally:
        coverage_provenance.discard_coverage_run(measurement_repo, run)


def test_python_xml_accepts_coverage_repository_relative_source(
    tmp_path: Path,
) -> None:
    source = tmp_path / "src/uok/example.py"
    write(source, "value = 1\n")
    report = tmp_path / "coverage.xml"
    write(
        report,
        (
            "<coverage><sources><source></source></sources><packages>"
            '<package><classes><class filename="src/uok/example.py"><lines>'
            '<line number="1" hits="1"/>'
            "</lines></class></classes></package></packages></coverage>"
        ),
    )

    assert python_xml_metrics(report, tmp_path) == {
        "src/uok/example.py": {
            "lines": {"covered": 1, "total": 1},
            "branches": {"covered": 0, "total": 0},
        }
    }


def test_repository_snapshot_rejects_assume_unchanged_source(
    measurement_repo: Path,
) -> None:
    path = "src/uok/example.py"
    git(measurement_repo, "update-index", "--assume-unchanged", path)
    write(measurement_repo / path, "value = 99\n")
    assert git(
        measurement_repo,
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
    ) == ""

    with pytest.raises(
        engineering_measurements.MeasurementValidationError,
        match="assume-unchanged",
    ):
        coverage_provenance.repository_snapshot(measurement_repo)


def test_repository_snapshot_rejects_skip_worktree_missing_source(
    measurement_repo: Path,
) -> None:
    path = "src/uok/example.py"
    git(measurement_repo, "update-index", "--skip-worktree", path)
    (measurement_repo / path).unlink()
    assert git(
        measurement_repo,
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
    ) == ""

    with pytest.raises(
        engineering_measurements.MeasurementValidationError,
        match="skip-worktree",
    ):
        coverage_provenance.repository_snapshot(measurement_repo)


def test_repository_snapshot_rejects_sparse_checkout_configuration(
    measurement_repo: Path,
) -> None:
    git(measurement_repo, "config", "core.sparseCheckout", "true")

    with pytest.raises(
        engineering_measurements.MeasurementValidationError,
        match="non-sparse checkout",
    ):
        coverage_provenance.repository_snapshot(measurement_repo)


def test_inventory_rejects_missing_cached_source(
    measurement_repo: Path,
) -> None:
    (measurement_repo / "src/uok/example.py").unlink()

    with pytest.raises(
        engineering_measurements.MeasurementValidationError,
        match="not materialized",
    ):
        expected_coverage_inventory(measurement_repo, "python")


def test_inventory_includes_nonignored_untracked_source(
    measurement_repo: Path,
) -> None:
    write(measurement_repo / "src/uok/new_source.py", "value = 3\n")

    assert "src/uok/new_source.py" in expected_coverage_inventory(
        measurement_repo,
        "python",
    )

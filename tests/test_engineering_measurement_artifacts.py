from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[1]
for import_root in (REPO_ROOT / "tests", REPO_ROOT / "scripts"):
    if str(import_root) not in sys.path:
        sys.path.insert(0, str(import_root))

import build_engineering_measurements  # noqa: E402
import engineering_measurements  # noqa: E402
from engineering_measurement_test_support import (  # noqa: E402
    OBSERVED_AT,
    coverage_payloads,
    create_measurement_repo,
    git,
    write,
    write_coverage_provenance,
)


@pytest.fixture
def measurement_repo(tmp_path: Path) -> Path:
    return create_measurement_repo(tmp_path, engineering_measurements.SOURCE_SPECS)


def test_validator_rejects_dirty_repository(measurement_repo: Path) -> None:
    payload = engineering_measurements.build_measurements(
        measurement_repo, observed_at=OBSERVED_AT
    )
    write(measurement_repo / "src/uok/example.py", "value = 99\n")

    with pytest.raises(
        engineering_measurements.MeasurementValidationError,
        match="worktree must be clean",
    ):
        engineering_measurements.validate_measurements(payload, measurement_repo)


def test_validator_rejects_hidden_index_state(measurement_repo: Path) -> None:
    payload = engineering_measurements.build_measurements(
        measurement_repo,
        observed_at=OBSERVED_AT,
    )
    path = "src/uok/example.py"
    git(measurement_repo, "update-index", "--assume-unchanged", path)
    write(measurement_repo / path, "value = 99\n")
    assert git(
        measurement_repo, "status", "--porcelain=v1", "--untracked-files=all"
    ) == ""

    with pytest.raises(
        engineering_measurements.MeasurementValidationError,
        match="assume-unchanged",
    ):
        engineering_measurements.validate_measurements(payload, measurement_repo)


@pytest.mark.parametrize("invalid", ["{", '{"value": NaN}', '{"value": 1e999}'])
def test_loader_rejects_malformed_or_nonfinite_json(
    measurement_repo: Path,
    invalid: str,
) -> None:
    measurement_path = measurement_repo / "var/evidence/engineering/invalid.json"
    write(measurement_path, invalid)

    with pytest.raises(engineering_measurements.MeasurementValidationError):
        engineering_measurements.load_measurements(
            measurement_path,
            measurement_repo,
        )


def test_builder_rejects_incomplete_coverage_inventory(
    measurement_repo: Path,
) -> None:
    python_path = measurement_repo / engineering_measurements.SOURCE_SPECS[0][1]
    python, _ = coverage_payloads(measurement_repo)
    python["totals"]["covered_lines"] = 9  # type: ignore[index]
    write(python_path, json.dumps(python))

    with pytest.raises(
        engineering_measurements.MeasurementValidationError,
        match="complete inventory",
    ):
        engineering_measurements.build_measurements(
            measurement_repo,
            observed_at=OBSERVED_AT,
        )


def test_builder_rejects_omitted_tracked_source_with_recomputed_totals(
    measurement_repo: Path,
) -> None:
    python_path = measurement_repo / engineering_measurements.SOURCE_SPECS[0][1]
    payload = json.loads(python_path.read_text(encoding="utf-8"))
    payload["files"].pop("src/uok/example.py")
    remaining = list(payload["files"].values())
    payload["totals"].update({
        "covered_lines": sum(record["summary"]["covered_lines"] for record in remaining),
        "num_statements": sum(record["summary"]["num_statements"] for record in remaining),
        "covered_branches": sum(
            record["summary"]["covered_branches"] for record in remaining
        ),
        "num_branches": sum(record["summary"]["num_branches"] for record in remaining),
    })
    write(python_path, json.dumps(payload))
    write_coverage_provenance(measurement_repo)

    with pytest.raises(
        engineering_measurements.MeasurementValidationError,
        match="tracked production sources",
    ):
        engineering_measurements.build_measurements(
            measurement_repo,
            observed_at=OBSERVED_AT,
        )


def test_builder_rejects_zeroed_file_with_recomputed_totals(
    measurement_repo: Path,
) -> None:
    python_path = measurement_repo / engineering_measurements.SOURCE_SPECS[0][1]
    payload = json.loads(python_path.read_text(encoding="utf-8"))
    payload["files"]["src/uok/example.py"]["summary"].update({
        "covered_lines": 0,
        "num_statements": 0,
        "covered_branches": 0,
        "num_branches": 0,
    })
    records = list(payload["files"].values())
    payload["totals"].update({
        "covered_lines": sum(row["summary"]["covered_lines"] for row in records),
        "num_statements": sum(row["summary"]["num_statements"] for row in records),
        "covered_branches": sum(row["summary"]["covered_branches"] for row in records),
        "num_branches": sum(row["summary"]["num_branches"] for row in records),
    })
    write(python_path, json.dumps(payload))
    write_coverage_provenance(measurement_repo)

    with pytest.raises(
        engineering_measurements.MeasurementValidationError,
        match="corroborating evidence",
    ):
        engineering_measurements.build_measurements(
            measurement_repo,
            observed_at=OBSERVED_AT,
        )


def test_builder_rejects_missing_or_tampered_coverage_provenance(
    measurement_repo: Path,
) -> None:
    provenance_path = (
        measurement_repo
        / engineering_measurements.PROVENANCE_SPECS[0][1]
    )
    provenance_path.unlink()
    with pytest.raises(
        engineering_measurements.MeasurementValidationError,
        match="provenance.*missing",
    ):
        engineering_measurements.build_measurements(
            measurement_repo,
            observed_at=OBSERVED_AT,
        )

    write_coverage_provenance(measurement_repo)
    report_path = measurement_repo / engineering_measurements.SOURCE_SPECS[0][1]
    report_path.write_text(
        report_path.read_text(encoding="utf-8") + "\n",
        encoding="utf-8",
    )
    with pytest.raises(
        engineering_measurements.MeasurementValidationError,
        match="does not match its report",
    ):
        engineering_measurements.build_measurements(
            measurement_repo,
            observed_at=OBSERVED_AT,
        )


def test_builder_rejects_provenance_from_an_older_clean_head(
    measurement_repo: Path,
) -> None:
    write(measurement_repo / "README.md", "new clean commit\n")
    git(measurement_repo, "add", "README.md")
    git(measurement_repo, "commit", "-m", "advance clean head")

    with pytest.raises(
        engineering_measurements.MeasurementValidationError,
        match="current clean HEAD",
    ):
        engineering_measurements.build_measurements(
            measurement_repo,
            observed_at=OBSERVED_AT,
        )


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("started_at", "2026-07-24T19:45:00+00:00"),
        ("completed_at", "2026-07-24T20:30:00+00:00"),
    ],
)
def test_builder_rejects_inconsistent_provenance_timestamps(
    measurement_repo: Path,
    field: str,
    value: str,
) -> None:
    provenance_path = (
        measurement_repo
        / engineering_measurements.PROVENANCE_SPECS[0][1]
    )
    payload = json.loads(provenance_path.read_text(encoding="utf-8"))
    payload[field] = value
    write(provenance_path, json.dumps(payload))

    with pytest.raises(
        engineering_measurements.MeasurementValidationError,
        match="timestamps are inconsistent",
    ):
        engineering_measurements.build_measurements(
            measurement_repo,
            observed_at=OBSERVED_AT,
        )


def test_builder_rejects_symlinked_coverage_source(
    measurement_repo: Path,
) -> None:
    source = measurement_repo / engineering_measurements.SOURCE_SPECS[0][1]
    target = source.with_name("real-coverage.json")
    target.write_bytes(source.read_bytes())
    source.unlink()
    try:
        source.symlink_to(target)
    except OSError as exc:
        pytest.skip(f"symlink creation is unavailable: {exc}")

    with pytest.raises(
        engineering_measurements.MeasurementValidationError,
        match="symlink",
    ):
        engineering_measurements.build_measurements(
            measurement_repo,
            observed_at=OBSERVED_AT,
        )


def test_builder_rejects_path_reported_as_symlink(
    measurement_repo: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    source = measurement_repo / engineering_measurements.SOURCE_SPECS[0][1]
    original = Path.is_symlink
    monkeypatch.setattr(
        Path,
        "is_symlink",
        lambda path: path == source or original(path),
    )

    with pytest.raises(
        engineering_measurements.MeasurementValidationError,
        match="symlink",
    ):
        engineering_measurements.build_measurements(
            measurement_repo,
            observed_at=OBSERVED_AT,
        )


def test_builder_cli_emits_only_verified_payload(
    measurement_repo: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setattr(build_engineering_measurements, "REPO_ROOT", measurement_repo)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "build_engineering_measurements.py",
            "--observed-at",
            OBSERVED_AT,
            "--stdout",
        ],
    )

    assert build_engineering_measurements.main() == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["schema"] == engineering_measurements.MEASUREMENT_SCHEMA

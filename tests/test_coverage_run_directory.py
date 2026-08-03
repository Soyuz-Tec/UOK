from __future__ import annotations

import sys
from pathlib import Path

import pytest


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import coverage_run_directory  # noqa: E402


def test_cleanup_retries_transient_windows_directory_lock(
    tmp_path: Path,
    monkeypatch,
) -> None:
    target = tmp_path / "run"
    target.mkdir()
    attempts = 0

    def transient_rmtree(path: Path) -> None:
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            raise PermissionError("transient OneDrive lock")
        path.rmdir()

    monkeypatch.setattr(
        coverage_run_directory.shutil,
        "rmtree",
        transient_rmtree,
    )

    coverage_run_directory.remove_directory_with_retry(
        target,
        attempts=3,
        delay_seconds=0,
    )

    assert attempts == 3
    assert not target.exists()


def test_cleanup_accepts_only_an_empty_directory_after_retry_exhaustion(
    tmp_path: Path,
    monkeypatch,
) -> None:
    target = tmp_path / "run"
    target.mkdir()

    monkeypatch.setattr(
        coverage_run_directory.shutil,
        "rmtree",
        lambda _path: (_ for _ in ()).throw(PermissionError("directory lock")),
    )

    coverage_run_directory.remove_directory_with_retry(
        target,
        attempts=2,
        delay_seconds=0,
    )

    assert target.is_dir()


def test_cleanup_rejects_a_locked_directory_with_remaining_artifacts(
    tmp_path: Path,
    monkeypatch,
) -> None:
    target = tmp_path / "run"
    target.mkdir()
    (target / "coverage.json").write_text("{}", encoding="utf-8")

    monkeypatch.setattr(
        coverage_run_directory.shutil,
        "rmtree",
        lambda _path: (_ for _ in ()).throw(PermissionError("directory lock")),
    )

    with pytest.raises(PermissionError, match="directory lock"):
        coverage_run_directory.remove_directory_with_retry(
            target,
            attempts=2,
            delay_seconds=0,
        )

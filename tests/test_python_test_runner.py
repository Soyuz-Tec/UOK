from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest


SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import run_python_tests  # noqa: E402


def _create_repository_layout(repo_root: Path, modules: tuple[str, ...] = ("alpha.core",)) -> None:
    (repo_root / "tests").mkdir(parents=True)
    for module_name in modules:
        (repo_root / "modules" / module_name / "tests").mkdir(parents=True)


def _write(path: Path, content: str = "def test_example():\n    assert True\n") -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return path


def test_discovery_includes_root_and_every_module_test_in_stable_order(tmp_path: Path) -> None:
    _create_repository_layout(tmp_path, ("zulu.core", "alpha.core"))
    _write(tmp_path / "tests" / "test_root.py")
    _write(tmp_path / "modules" / "zulu.core" / "tests" / "nested" / "workflow_test.py")
    _write(tmp_path / "modules" / "alpha.core" / "tests" / "test_contract.py")

    files = run_python_tests.discover_test_files(tmp_path)

    assert [path.relative_to(tmp_path).as_posix() for path in files] == [
        "modules/alpha.core/tests/test_contract.py",
        "modules/zulu.core/tests/nested/workflow_test.py",
        "tests/test_root.py",
    ]


def test_discovery_rejects_missing_module_test_path(tmp_path: Path) -> None:
    _create_repository_layout(tmp_path)
    (tmp_path / "modules" / "missing-tests.core").mkdir()
    _write(tmp_path / "tests" / "test_root.py")

    with pytest.raises(
        run_python_tests.TestDiscoveryError,
        match=r"modules/missing-tests\.core/tests",
    ):
        run_python_tests.discover_test_files(tmp_path)


def test_discovery_allows_independent_modules_to_reuse_test_filenames(tmp_path: Path) -> None:
    _create_repository_layout(tmp_path, ("alpha.core", "beta.core"))
    _write(tmp_path / "tests" / "test_contract.py")
    _write(tmp_path / "modules" / "alpha.core" / "tests" / "test_contract.py")
    _write(tmp_path / "modules" / "beta.core" / "tests" / "test_contract.py")

    files = run_python_tests.discover_test_files(tmp_path)

    assert len(files) == 3


def test_duplicate_resolved_test_path_is_rejected(tmp_path: Path) -> None:
    _create_repository_layout(tmp_path)
    test_file = _write(tmp_path / "tests" / "test_contract.py")

    with pytest.raises(run_python_tests.TestDiscoveryError, match="Duplicate Python test file"):
        run_python_tests._validate_unique_files(tmp_path, [test_file, test_file])


def test_runner_environment_ignores_ambient_pytest_configuration(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("PYTEST_ADDOPTS", "--maxfail=99")

    environment = run_python_tests._test_environment(tmp_path)

    assert "PYTEST_ADDOPTS" not in environment
    assert environment["PYTEST_DISABLE_PLUGIN_AUTOLOAD"] == "1"


def test_database_cleanup_retries_a_transient_file_lock(monkeypatch: pytest.MonkeyPatch) -> None:
    attempts = 0
    sleeps: list[float] = []

    class TransientlyLockedPath:
        def unlink(self, *, missing_ok: bool) -> None:
            nonlocal attempts
            attempts += 1
            assert missing_ok is True
            if attempts < 3:
                raise PermissionError("transient Windows file lock")

    monkeypatch.setattr(run_python_tests.time, "sleep", sleeps.append)

    run_python_tests._unlink_with_retry(TransientlyLockedPath(), attempts=3, delay_seconds=0.25)

    assert attempts == 3
    assert sleeps == [0.25, 0.25]


def test_runner_invokes_each_file_in_its_own_sequential_subprocess(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _create_repository_layout(tmp_path)
    root_test = _write(tmp_path / "tests" / "test_root.py")
    module_test = _write(tmp_path / "modules" / "alpha.core" / "tests" / "test_module.py")
    calls: list[tuple[list[str], Path]] = []

    def fake_run(command: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
        calls.append((command, kwargs["cwd"]))
        return subprocess.CompletedProcess(command, 0)

    monkeypatch.setattr(run_python_tests.subprocess, "run", fake_run)

    result = run_python_tests.run_test_files(tmp_path, [module_test, root_test])

    assert result == 0
    assert calls == [
        ([sys.executable, "-m", "pytest", "-q", "modules/alpha.core/tests/test_module.py"], tmp_path),
        ([sys.executable, "-m", "pytest", "-q", "tests/test_root.py"], tmp_path),
    ]

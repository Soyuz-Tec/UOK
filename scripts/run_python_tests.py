from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
TEST_DATABASE_RELATIVE_PATH = Path("data/test_uok_baseline.db")


class TestDiscoveryError(RuntimeError):
    """Raised when repository test discovery is incomplete or ambiguous."""


def _test_roots(repo_root: Path) -> list[Path]:
    root_tests = repo_root / "tests"
    modules_root = repo_root / "modules"
    missing = [path for path in (root_tests, modules_root) if not path.is_dir()]
    if missing:
        raise TestDiscoveryError(_missing_message(repo_root, missing))

    module_roots = sorted(
        (path for path in modules_root.iterdir() if path.is_dir() and not path.name.startswith(".")),
        key=lambda path: path.name.casefold(),
    )
    if not module_roots:
        raise TestDiscoveryError("No module directories found under modules/.")

    module_test_roots = [module_root / "tests" for module_root in module_roots]
    missing = [path for path in module_test_roots if not path.is_dir()]
    if missing:
        raise TestDiscoveryError(_missing_message(repo_root, missing))
    return [root_tests, *module_test_roots]


def _missing_message(repo_root: Path, paths: list[Path]) -> str:
    relative_paths = sorted(path.relative_to(repo_root).as_posix() for path in paths)
    return "Missing expected Python test path(s): " + ", ".join(relative_paths)


def _is_test_file(path: Path) -> bool:
    return path.is_file() and path.suffix == ".py" and (
        path.name.startswith("test_") or path.name.endswith("_test.py")
    )


def _relative(repo_root: Path, path: Path) -> str:
    return path.relative_to(repo_root).as_posix()


def _validate_unique_files(repo_root: Path, files: list[Path]) -> None:
    resolved_paths: dict[Path, list[Path]] = {}
    for path in files:
        resolved = path.resolve()
        resolved_paths.setdefault(resolved, []).append(path)

    collisions = [paths for paths in resolved_paths.values() if len(paths) > 1]
    if not collisions:
        return

    formatted = sorted(
        {", ".join(sorted(_relative(repo_root, path) for path in paths)) for paths in collisions}
    )
    raise TestDiscoveryError("Duplicate Python test file(s): " + "; ".join(formatted))


def discover_test_files(repo_root: Path = REPO_ROOT) -> list[Path]:
    repo_root = repo_root.resolve()
    files = [
        path
        for test_root in _test_roots(repo_root)
        for path in test_root.rglob("*.py")
        if _is_test_file(path)
    ]
    files.sort(key=lambda path: _relative(repo_root, path).casefold())
    if not files:
        raise TestDiscoveryError("No Python test files found in expected repository test paths.")
    _validate_unique_files(repo_root, files)
    return files


def _test_environment(repo_root: Path) -> dict[str, str]:
    environment = os.environ.copy()
    environment.pop("PYTEST_ADDOPTS", None)
    environment["PYTEST_DISABLE_PLUGIN_AUTOLOAD"] = "1"
    source_root = str(repo_root / "src")
    existing = environment.get("PYTHONPATH")
    environment["PYTHONPATH"] = os.pathsep.join(filter(None, (source_root, existing)))
    return environment


def _unlink_with_retry(path: Path, *, attempts: int = 50, delay_seconds: float = 0.1) -> None:
    for attempt in range(attempts):
        try:
            path.unlink(missing_ok=True)
            return
        except PermissionError:
            if attempt + 1 >= attempts:
                raise
            time.sleep(delay_seconds)


def _prepare_test_database(repo_root: Path) -> None:
    database = repo_root / TEST_DATABASE_RELATIVE_PATH
    for suffix in ("", "-wal", "-shm"):
        _unlink_with_retry(Path(f"{database}{suffix}"))


def run_test_files(repo_root: Path, files: list[Path]) -> int:
    environment = _test_environment(repo_root)
    github_groups = environment.get("GITHUB_ACTIONS", "").lower() == "true"
    for index, path in enumerate(files, start=1):
        _prepare_test_database(repo_root)
        relative = _relative(repo_root, path)
        if github_groups:
            print(f"::group::{relative}", flush=True)
        else:
            print(f"[{index}/{len(files)}] {relative}", flush=True)
        result = subprocess.run(
            [sys.executable, "-m", "pytest", "-q", relative],
            cwd=repo_root,
            env=environment,
            check=False,
        )
        if github_groups:
            print("::endgroup::", flush=True)
        if result.returncode != 0:
            return result.returncode
    return 0


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Discover and run every UOK Python test file in an isolated sequential subprocess."
    )
    parser.add_argument("--check", action="store_true", help="Validate discovery without running tests.")
    parser.add_argument("--list", action="store_true", help="Print the validated test file list.")
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    try:
        files = discover_test_files(REPO_ROOT)
    except TestDiscoveryError as error:
        print(f"Python test discovery failed: {error}", file=sys.stderr)
        return 2

    if args.list:
        for path in files:
            print(_relative(REPO_ROOT, path))
    print(f"Validated {len(files)} unique Python test files.", flush=True)
    if args.check or args.list:
        return 0
    return run_test_files(REPO_ROOT, files)


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest


SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from validate_uok_release import (  # noqa: E402
    ReleaseValidationError,
    validate_release_identity,
)


def _git(repo: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", "-C", str(repo), *args],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    assert result.returncode == 0, result.stderr
    return result.stdout.strip()


def _write_version_sources(root: Path, *, version: str = "3.1.0-alpha.3") -> None:
    (root / "src" / "uok").mkdir(parents=True, exist_ok=True)
    (root / "src" / "uok" / "__init__.py").write_text(
        f'APP_VERSION = "{version}"\nTARGET_VERSION = "UOK-{version}"\n',
        encoding="utf-8",
    )
    pep440 = version.replace("-alpha.", "a").replace("-beta.", "b").replace("-rc.", "rc")
    (root / "pyproject.toml").write_text(
        f'[project]\nname = "uok"\nversion = "{pep440}"\n',
        encoding="utf-8",
    )
    (root / "README.md").write_text(f"# UOK\n\n**Version:** `{version}`\n", encoding="utf-8")


def _repo(tmp_path: Path) -> tuple[Path, str]:
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init", "--initial-branch=main")
    _git(repo, "config", "user.name", "UOK Release Test")
    _git(repo, "config", "user.email", "release@example.invalid")
    _git(repo, "config", "commit.gpgsign", "false")
    _write_version_sources(repo)
    _git(repo, "add", "--all")
    _git(repo, "commit", "-m", "release source")
    commit = _git(repo, "rev-parse", "HEAD")
    _git(repo, "tag", "UOK-3.1.0-alpha.3")
    _git(repo, "update-ref", "refs/remotes/origin/main", commit)
    return repo, commit


def test_exact_tag_binds_versions_commit_main_and_ghcr_path(tmp_path: Path) -> None:
    repo, commit = _repo(tmp_path)
    (repo / "after.txt").write_text("later\n", encoding="utf-8")
    _git(repo, "add", "after.txt")
    _git(repo, "commit", "-m", "later main commit")
    _git(repo, "update-ref", "refs/remotes/origin/main", "HEAD")

    identity = validate_release_identity(
        root=repo,
        tag="UOK-3.1.0-alpha.3",
        expected_commit=commit,
        require_ancestor_ref="origin/main",
        github_repository="Soyuz-Tec/UOK",
    )

    assert identity.version == "3.1.0-alpha.3"
    assert identity.pep440_version == "3.1.0a3"
    assert identity.source_commit == commit
    assert identity.image_repository == "ghcr.io/soyuz-tec/uok"
    assert identity.image_tag == "ghcr.io/soyuz-tec/uok:3.1.0-alpha.3"


@pytest.mark.parametrize(
    "tag",
    [
        "v3.1.0",
        "UOK-3.1.0",
        "UOK-3.1.0-alpha",
        "UOK-03.1.0-alpha.3",
        "UOK-3.1.0-alpha.3-extra",
    ],
)
def test_noncanonical_prerelease_tags_fail_closed(tmp_path: Path, tag: str) -> None:
    repo, _ = _repo(tmp_path)
    with pytest.raises(ReleaseValidationError, match="Release tag must use"):
        validate_release_identity(
            root=repo,
            tag=tag,
            github_repository="Soyuz-Tec/UOK",
        )


def test_version_drift_and_non_main_commit_fail_closed(tmp_path: Path) -> None:
    repo, commit = _repo(tmp_path)
    _write_version_sources(repo, version="3.1.0-alpha.4")
    _git(repo, "add", "--all")
    _git(repo, "commit", "-m", "side release")
    side_commit = _git(repo, "rev-parse", "HEAD")
    _git(repo, "tag", "UOK-3.1.0-alpha.4")
    _git(repo, "update-ref", "refs/remotes/origin/main", commit)

    with pytest.raises(ReleaseValidationError, match="not reachable"):
        validate_release_identity(
            root=repo,
            tag="UOK-3.1.0-alpha.4",
            expected_commit=side_commit,
            require_ancestor_ref="origin/main",
            github_repository="Soyuz-Tec/UOK",
        )

    with pytest.raises(ReleaseValidationError, match="version drift"):
        validate_release_identity(
            root=repo,
            tag="UOK-3.1.0-alpha.3",
            expected_commit=commit,
            github_repository="Soyuz-Tec/UOK",
        )

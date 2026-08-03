from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest


SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from verify_uok_remote_release_tag import (  # noqa: E402
    RemoteTagValidationError,
    TEMPORARY_REF,
    verify_remote_release_tag,
)


TAG = "UOK-3.1.0-alpha.3"


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


def _ref_exists(repo: Path, reference: str) -> bool:
    result = subprocess.run(
        ["git", "-C", str(repo), "show-ref", "--verify", "--quiet", reference],
        check=False,
    )
    assert result.returncode in {0, 1}
    return result.returncode == 0


def _fixture(tmp_path: Path) -> tuple[Path, Path, str]:
    remote = tmp_path / "remote.git"
    source = tmp_path / "source"
    checkout = tmp_path / "checkout"
    _git(tmp_path, "init", "--bare", str(remote))
    _git(tmp_path, "init", "--initial-branch=main", str(source))
    _git(source, "config", "user.name", "UOK Remote Tag Test")
    _git(source, "config", "user.email", "release@example.invalid")
    (source / "version.txt").write_text("reviewed\n", encoding="utf-8")
    _git(source, "add", "version.txt")
    _git(source, "commit", "-m", "reviewed")
    reviewed = _git(source, "rev-parse", "HEAD")
    _git(source, "tag", TAG)
    _git(source, "remote", "add", "origin", str(remote))
    _git(source, "push", "origin", "main", f"refs/tags/{TAG}")
    _git(tmp_path, "clone", str(remote), str(checkout))
    _git(checkout, "checkout", "--detach", reviewed)
    return source, checkout, reviewed


def test_remote_tag_is_fetched_and_must_still_name_reviewed_commit(tmp_path: Path) -> None:
    source, checkout, reviewed = _fixture(tmp_path)

    assert (
        verify_remote_release_tag(
            root=checkout,
            remote="origin",
            tag=TAG,
            expected_commit=reviewed,
        )
        == reviewed
    )
    assert not _ref_exists(checkout, TEMPORARY_REF)

    (source / "version.txt").write_text("moved\n", encoding="utf-8")
    _git(source, "add", "version.txt")
    _git(source, "commit", "-m", "moved")
    _git(source, "tag", "--force", TAG)
    _git(source, "push", "--force", "origin", f"refs/tags/{TAG}")

    with pytest.raises(RemoteTagValidationError, match="not reviewed commit"):
        verify_remote_release_tag(
            root=checkout,
            remote="origin",
            tag=TAG,
            expected_commit=reviewed,
        )
    assert not _ref_exists(checkout, TEMPORARY_REF)

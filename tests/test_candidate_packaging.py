from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import zipfile
from pathlib import Path

import pytest


SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import package_uok_candidate as packaging  # noqa: E402


def _git(repo: Path, *args: str, input_bytes: bytes | None = None) -> str:
    result = subprocess.run(
        ["git", "-C", str(repo), *args],
        check=False,
        input=input_bytes,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    assert result.returncode == 0, result.stderr.decode("utf-8", errors="replace")
    return result.stdout.decode("utf-8").strip()


def _repo(tmp_path: Path) -> Path:
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init", "--initial-branch=main")
    _git(repo, "config", "user.name", "UOK Packaging Test")
    _git(repo, "config", "user.email", "packaging@example.invalid")
    _git(repo, "config", "core.autocrlf", "false")
    _git(repo, "config", "commit.gpgsign", "false")
    return repo


def _commit(repo: Path, message: str) -> str:
    _git(repo, "add", "--all")
    _git(repo, "commit", "-m", message)
    return _git(repo, "rev-parse", "HEAD")


def _create_package(repo: Path, output: Path, source_ref: str = "HEAD") -> Path:
    return packaging.create_package(
        root=repo,
        version="test.1",
        output_directory=output,
        source_ref=source_ref,
        stamp="20000101-000000",
    )


def test_package_reads_head_objects_not_dirty_or_untracked_files(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    (repo / "app.txt").write_bytes(b"committed\n")
    commit = _commit(repo, "initial")

    (repo / "app.txt").write_bytes(b"dirty working tree\n")
    (repo / ".env.production").write_bytes(b"TOKEN=untracked-secret\n")
    (repo / "var").mkdir()
    (repo / "var" / "private.json").write_text('{"secret": true}', encoding="utf-8")

    package = _create_package(repo, tmp_path / "out")
    with zipfile.ZipFile(package) as archive:
        assert archive.read("app.txt") == b"committed\n"
        assert ".env.production" not in archive.namelist()
        assert "var/private.json" not in archive.namelist()
        manifest = json.loads(archive.read(packaging.MANIFEST_PATH))
    assert manifest["source_commit"] == commit


def test_explicit_source_commit_remains_pinned_after_new_commit(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    (repo / "version.txt").write_text("first", encoding="utf-8")
    first_commit = _commit(repo, "first")
    (repo / "version.txt").write_text("second", encoding="utf-8")
    _commit(repo, "second")

    package = _create_package(repo, tmp_path / "out", first_commit)
    with zipfile.ZipFile(package) as archive:
        assert archive.read("version.txt") == b"first"
        manifest = json.loads(archive.read(packaging.MANIFEST_PATH))
    assert manifest["source_commit"] == first_commit


def test_manifest_hashes_every_source_file_and_zip_is_deterministic(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    (repo / "README.md").write_text("UOK\n", encoding="utf-8")
    (repo / "src").mkdir()
    (repo / "src" / "binary.bin").write_bytes(bytes(range(64)))
    commit = _commit(repo, "source")

    first = _create_package(repo, tmp_path / "out-one", commit)
    second = _create_package(repo, tmp_path / "out-two", commit)
    assert first.read_bytes() == second.read_bytes()

    with zipfile.ZipFile(first) as archive:
        manifest_bytes = archive.read(packaging.MANIFEST_PATH)
        manifest = json.loads(manifest_bytes)
        source_names = set(archive.namelist()) - {packaging.MANIFEST_PATH}
        recorded_names = {record["path"] for record in manifest["files"]}
        assert recorded_names == source_names
        for record in manifest["files"]:
            content = archive.read(record["path"])
            assert record["size"] == len(content)
            assert record["sha256"] == hashlib.sha256(content).hexdigest()

    assert manifest["schema"] == "uok.source_package_manifest.v1"
    assert manifest["hash_algorithm"] == "sha256"
    assert manifest["source_commit"] == commit
    assert manifest["version"] == "test.1"
    assert manifest_bytes.endswith(b"\n")


def test_tracked_sensitive_path_fails_closed(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    (repo / ".env.production").write_text("TOKEN=tracked-secret", encoding="utf-8")
    _commit(repo, "unsafe source")

    with pytest.raises(packaging.PackagingError, match="Sensitive environment path"):
        _create_package(repo, tmp_path / "out")


def test_non_regular_git_entry_fails_closed(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    (repo / "README.md").write_text("source", encoding="utf-8")
    _commit(repo, "initial")
    target_blob = _git(repo, "hash-object", "-w", "--stdin", input_bytes=b"README.md")
    _git(repo, "update-index", "--add", "--cacheinfo", f"120000,{target_blob},source-link")
    _git(repo, "commit", "-m", "add symlink entry")

    with pytest.raises(packaging.PackagingError, match="Non-regular Git entry"):
        _create_package(repo, tmp_path / "out")


@pytest.mark.parametrize(
    "path",
    [
        "../secret",
        "/absolute",
        "folder\\escape",
        "C:/drive",
        "a//b",
        "NUL.txt",
        "COM¹.txt",
        "file. ",
        "bad?.txt",
        "bad|name.txt",
        "e\u0301.txt",
    ],
)
def test_unsafe_archive_paths_fail_closed(path: str) -> None:
    with pytest.raises(packaging.PackagingError):
        packaging.validate_archive_path(path)

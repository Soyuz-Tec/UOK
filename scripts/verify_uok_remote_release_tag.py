from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path


TAG_PATTERN = re.compile(
    r"UOK-(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)"
    r"-(?:alpha|beta|rc)\.(?:0|[1-9]\d*)\Z"
)
COMMIT_PATTERN = re.compile(r"[0-9a-f]{40,64}\Z")
REMOTE_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}\Z")
TEMPORARY_REF = "refs/uok-release-validation/remote-tag"


class RemoteTagValidationError(RuntimeError):
    """Raised when the current remote release tag no longer names the reviewed commit."""


def _git(root: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    try:
        result = subprocess.run(
            ["git", "--no-replace-objects", "-C", str(root), *args],
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
    except FileNotFoundError as exc:
        raise RemoteTagValidationError("Git is required to verify a remote release tag") from exc
    if check and result.returncode != 0:
        detail = result.stderr.strip() or "unknown Git error"
        raise RemoteTagValidationError(f"Git command failed ({' '.join(args)}): {detail}")
    return result


def _resolve_commit(root: Path, revision: str) -> str:
    if not revision or revision.startswith("-"):
        raise RemoteTagValidationError("Git revision must be a non-option value")
    commit = _git(
        root,
        "rev-parse",
        "--verify",
        "--end-of-options",
        f"{revision}^{{commit}}",
    ).stdout.strip().lower()
    if COMMIT_PATTERN.fullmatch(commit) is None:
        raise RemoteTagValidationError(f"Git returned an invalid commit id: {commit!r}")
    return commit


def _delete_temporary_ref(root: Path) -> None:
    result = _git(root, "update-ref", "-d", TEMPORARY_REF, check=False)
    if result.returncode != 0:
        detail = result.stderr.strip() or "unknown Git error"
        raise RemoteTagValidationError(f"Cannot clear temporary validation ref: {detail}")


def verify_remote_release_tag(
    *,
    root: Path,
    remote: str,
    tag: str,
    expected_commit: str,
) -> str:
    root = root.resolve()
    if REMOTE_PATTERN.fullmatch(remote) is None:
        raise RemoteTagValidationError("Remote must be a safe configured Git remote name")
    if TAG_PATTERN.fullmatch(tag) is None:
        raise RemoteTagValidationError("Remote tag is not a canonical UOK prerelease tag")
    reviewed_commit = _resolve_commit(root, expected_commit)
    _delete_temporary_ref(root)
    try:
        _git(
            root,
            "fetch",
            "--force",
            "--no-tags",
            "--no-recurse-submodules",
            remote,
            f"+refs/tags/{tag}:{TEMPORARY_REF}",
        )
        remote_commit = _resolve_commit(root, TEMPORARY_REF)
        if remote_commit != reviewed_commit:
            raise RemoteTagValidationError(
                f"Remote tag {tag} resolves to {remote_commit}, "
                f"not reviewed commit {reviewed_commit}"
            )
        return remote_commit
    finally:
        _delete_temporary_ref(root)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fetch a remote UOK release tag and prove its current commit identity."
    )
    parser.add_argument("--remote", default="origin")
    parser.add_argument("--tag", required=True)
    parser.add_argument("--expected-commit", required=True)
    args = parser.parse_args()
    try:
        commit = verify_remote_release_tag(
            root=Path(__file__).resolve().parents[1],
            remote=args.remote,
            tag=args.tag,
            expected_commit=args.expected_commit,
        )
    except RemoteTagValidationError as exc:
        parser.error(str(exc))
    print(json.dumps({"remote": args.remote, "source_commit": commit, "tag": args.tag}))


if __name__ == "__main__":
    main()

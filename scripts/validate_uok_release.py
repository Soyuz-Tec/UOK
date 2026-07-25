from __future__ import annotations

import argparse
import ast
import json
import os
import re
import subprocess
import tomllib
from dataclasses import asdict, dataclass
from pathlib import Path


TAG_PATTERN = re.compile(
    r"UOK-(?P<base>(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))"
    r"-(?P<phase>alpha|beta|rc)\.(?P<number>0|[1-9]\d*)\Z"
)
COMMIT_PATTERN = re.compile(r"[0-9a-f]{40,64}\Z")
REPOSITORY_PATTERN = re.compile(
    r"[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,99})/"
    r"[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,99})\Z"
)


class ReleaseValidationError(RuntimeError):
    """Raised when a Git ref cannot be promoted as an immutable UOK prerelease."""


@dataclass(frozen=True)
class ReleaseIdentity:
    tag: str
    version: str
    pep440_version: str
    source_commit: str
    source_ref: str
    image_repository: str
    image_tag: str


def _git(root: Path, *args: str) -> str:
    try:
        result = subprocess.run(
            ["git", "--no-replace-objects", "-C", str(root), *args],
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
        )
    except FileNotFoundError as exc:
        raise ReleaseValidationError("Git is required to validate a UOK release") from exc
    if result.returncode != 0:
        detail = result.stderr.strip() or "unknown Git error"
        raise ReleaseValidationError(f"Git command failed ({' '.join(args)}): {detail}")
    return result.stdout.strip()


def _is_ancestor(root: Path, ancestor: str, descendant: str) -> bool:
    result = subprocess.run(
        [
            "git",
            "--no-replace-objects",
            "-C",
            str(root),
            "merge-base",
            "--is-ancestor",
            ancestor,
            descendant,
        ],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
    )
    if result.returncode in {0, 1}:
        return result.returncode == 0
    detail = result.stderr.strip() or "unknown Git error"
    raise ReleaseValidationError(f"Cannot validate Git ancestry: {detail}")


def _resolve_commit(root: Path, revision: str) -> str:
    if not revision or revision.startswith("-"):
        raise ReleaseValidationError("Git revision must be a non-option value")
    commit = _git(
        root,
        "rev-parse",
        "--verify",
        "--end-of-options",
        f"{revision}^{{commit}}",
    ).lower()
    if not COMMIT_PATTERN.fullmatch(commit):
        raise ReleaseValidationError(f"Git returned an invalid commit id: {commit!r}")
    return commit


def _read_string_constants(path: Path, names: set[str]) -> dict[str, str]:
    try:
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    except (OSError, SyntaxError) as exc:
        raise ReleaseValidationError(f"Cannot parse version source {path}") from exc
    values: dict[str, str] = {}
    for node in tree.body:
        if not isinstance(node, (ast.Assign, ast.AnnAssign)):
            continue
        targets = node.targets if isinstance(node, ast.Assign) else [node.target]
        value = node.value
        if not isinstance(value, ast.Constant) or not isinstance(value.value, str):
            continue
        for target in targets:
            if isinstance(target, ast.Name) and target.id in names:
                values[target.id] = value.value
    missing = names - values.keys()
    if missing:
        raise ReleaseValidationError(
            f"Version source {path} is missing string constants: {sorted(missing)}"
        )
    return values


def _expected_pep440(match: re.Match[str]) -> str:
    phase = {"alpha": "a", "beta": "b", "rc": "rc"}[match.group("phase")]
    return f"{match.group('base')}{phase}{match.group('number')}"


def _read_readme_version(path: Path) -> str:
    try:
        content = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise ReleaseValidationError(f"Cannot read {path}") from exc
    match = re.search(r"^\*\*Version:\*\*\s+`([^`]+)`\s*$", content, re.MULTILINE)
    if match is None:
        raise ReleaseValidationError("README.md must declare one bold Version value")
    return match.group(1)


def validate_release_identity(
    *,
    root: Path,
    tag: str,
    expected_commit: str | None = None,
    require_ancestor_ref: str | None = None,
    github_repository: str,
) -> ReleaseIdentity:
    root = root.resolve()
    match = TAG_PATTERN.fullmatch(tag)
    if match is None:
        raise ReleaseValidationError(
            "Release tag must use UOK-X.Y.Z-alpha.N, UOK-X.Y.Z-beta.N, "
            "or UOK-X.Y.Z-rc.N"
        )
    if not REPOSITORY_PATTERN.fullmatch(github_repository):
        raise ReleaseValidationError("GitHub repository must use the owner/name form")

    source_ref = f"refs/tags/{tag}"
    source_commit = _resolve_commit(root, source_ref)
    if expected_commit is not None:
        resolved_expected = _resolve_commit(root, expected_commit)
        if source_commit != resolved_expected:
            raise ReleaseValidationError(
                f"Tag commit {source_commit} does not match expected commit {resolved_expected}"
            )
    if require_ancestor_ref is not None:
        _resolve_commit(root, require_ancestor_ref)
        if not _is_ancestor(root, source_commit, require_ancestor_ref):
            raise ReleaseValidationError(
                f"Tag commit {source_commit} is not reachable from {require_ancestor_ref}"
            )

    version = f"{match.group('base')}-{match.group('phase')}.{match.group('number')}"
    pep440_version = _expected_pep440(match)
    constants = _read_string_constants(
        root / "src" / "uok" / "__init__.py",
        {"APP_VERSION", "TARGET_VERSION"},
    )
    expected_values = {
        "APP_VERSION": version,
        "TARGET_VERSION": tag,
        "README.md Version": version,
    }
    actual_values = {
        "APP_VERSION": constants["APP_VERSION"],
        "TARGET_VERSION": constants["TARGET_VERSION"],
        "README.md Version": _read_readme_version(root / "README.md"),
    }
    try:
        project_version = tomllib.loads(
            (root / "pyproject.toml").read_text(encoding="utf-8")
        )["project"]["version"]
    except (OSError, KeyError, tomllib.TOMLDecodeError) as exc:
        raise ReleaseValidationError("Cannot read project.version from pyproject.toml") from exc
    if not isinstance(project_version, str):
        raise ReleaseValidationError("pyproject.toml project.version must be a string")
    expected_values["pyproject.toml project.version"] = pep440_version
    actual_values["pyproject.toml project.version"] = project_version
    mismatches = [
        f"{name}: expected {expected_values[name]!r}, found {actual!r}"
        for name, actual in actual_values.items()
        if actual != expected_values[name]
    ]
    if mismatches:
        raise ReleaseValidationError("Release version drift:\n" + "\n".join(mismatches))

    image_repository = f"ghcr.io/{github_repository.lower()}"
    return ReleaseIdentity(
        tag=tag,
        version=version,
        pep440_version=pep440_version,
        source_commit=source_commit,
        source_ref=source_ref,
        image_repository=image_repository,
        image_tag=f"{image_repository}:{version}",
    )


def _append_github_outputs(path: Path, identity: ReleaseIdentity) -> None:
    with path.open("a", encoding="utf-8", newline="\n") as output:
        for name, value in asdict(identity).items():
            output.write(f"{name}={value}\n")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Validate an exact UOK prerelease tag against source and Git history."
    )
    parser.add_argument("--tag", required=True)
    parser.add_argument("--expected-commit")
    parser.add_argument("--require-ancestor-ref")
    parser.add_argument(
        "--github-repository",
        default=os.environ.get("GITHUB_REPOSITORY", "Soyuz-Tec/UOK"),
    )
    parser.add_argument("--github-output", type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    try:
        identity = validate_release_identity(
            root=root,
            tag=args.tag,
            expected_commit=args.expected_commit,
            require_ancestor_ref=args.require_ancestor_ref,
            github_repository=args.github_repository,
        )
        if args.github_output is not None:
            _append_github_outputs(args.github_output, identity)
    except ReleaseValidationError as exc:
        parser.error(str(exc))
    print(json.dumps(asdict(identity), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()

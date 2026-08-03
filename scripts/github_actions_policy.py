from __future__ import annotations

import re
from pathlib import Path


FULL_COMMIT_SHA = re.compile(r"[0-9a-f]{40}\Z")
USES_KEY = re.compile(r"^\s*(?:-\s*)?uses\s*:")
USES_VALUE = re.compile(
    r"""^\s*(?:-\s*)?uses\s*:\s*(?:"(?P<double>[^"]*)"|'(?P<single>[^']*)'|"""
    r"(?P<bare>[^\s#]+))(?:\s+#.*)?\s*$"
)
BLOCK_SCALAR = re.compile(r"^\s*(?:-\s*)?[^#\n]+:\s*[>|][+-]?\s*(?:#.*)?$")
WORKFLOW_SUFFIXES = {".yml", ".yaml"}
POSTGRES_SERVICE_IMAGE = (
    "postgres:18-alpine@"
    "sha256:9a8afca54e7861fd90fab5fdf4c42477a6b1cb7d293595148e674e0a3181de15"
)


def github_actions_pin_problems(repo_root: Path) -> list[str]:
    workflow_root = repo_root / ".github" / "workflows"
    if not workflow_root.is_dir():
        return [".github/workflows is missing"]
    workflows = sorted(
        path
        for path in workflow_root.iterdir()
        if path.is_file() and path.suffix in WORKFLOW_SUFFIXES
    )
    if not workflows:
        return [".github/workflows has no YAML workflows"]

    problems: list[str] = []
    for workflow in workflows:
        try:
            text = workflow.read_text(encoding="utf-8")
        except OSError as exc:
            problems.append(f"{workflow.relative_to(repo_root).as_posix()}: cannot read: {exc}")
            continue
        problems.extend(_workflow_pin_problems(text, workflow.relative_to(repo_root).as_posix()))
    return problems


def _workflow_pin_problems(workflow: str, display_path: str) -> list[str]:
    problems: list[str] = []
    block_indent: int | None = None
    for line_number, line in enumerate(workflow.splitlines(), start=1):
        stripped = line.lstrip(" ")
        indent = len(line) - len(stripped)
        if block_indent is not None:
            if not stripped or stripped.startswith("#") or indent > block_indent:
                continue
            block_indent = None
        code = line.split("#", 1)[0].strip()
        if code.startswith("image:") and "postgres:18-alpine" in code:
            if code != f"image: {POSTGRES_SERVICE_IMAGE}":
                problems.append(
                    f"{display_path}:{line_number}: PostgreSQL service image "
                    "must use the reviewed OCI index digest"
                )
        if not USES_KEY.match(line):
            if BLOCK_SCALAR.match(line):
                block_indent = indent
            continue

        match = USES_VALUE.fullmatch(line)
        if match is None:
            problems.append(
                f"{display_path}:{line_number}: malformed uses reference; "
                "external actions require a lower-case 40-character commit SHA"
            )
            continue
        target = next(value for value in match.groupdict().values() if value is not None)
        if target.startswith("./"):
            continue
        action, separator, reference = target.rpartition("@")
        if not separator or not action or FULL_COMMIT_SHA.fullmatch(reference) is None:
            problems.append(
                f"{display_path}:{line_number}: external uses reference {target!r} "
                "must be pinned to a lower-case 40-character commit SHA"
            )
    return problems

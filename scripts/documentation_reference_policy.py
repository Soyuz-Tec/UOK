from __future__ import annotations

import re
import subprocess
import posixpath
from pathlib import Path, PurePosixPath
from urllib.parse import unquote


INLINE_CODE = re.compile(r"(?<!`)`([^`\r\n]+)`(?!`)")
MARKDOWN_LINK = re.compile(r"(?<!!)\[[^\]]+\]\(([^)]+)\)")
REPOSITORY_PREFIXES = (
    ".github/",
    "deploy/",
    "docs/",
    "migrations/",
    "modules/",
    "scripts/",
    "src/",
    "tests/",
    "web/",
)
ROOT_REFERENCES = frozenset(
    {
        ".dockerignore",
        ".gitignore",
        "AGENTS.md",
        "Dockerfile",
        "README.md",
        "conftest.py",
        "pyproject.toml",
        "requirements-dev.txt",
        "requirements.txt",
    }
)
TEMPLATE_MARKERS = frozenset("*?[]{}<>$")
HISTORICAL_DOCUMENT_NAMES = frozenset({"RC9_REFERENCE_TARGET.md"})
GENERATED_OUTPUT_REFERENCES = frozenset({"src/uok/static/app"})
RETIRED_FRONTEND_REFERENCES = (
    "src/app/contactDraft.ts",
    "src/app/useContactCommands.ts",
    "src/app/useContactWorkspaceState.ts",
    "src/features/apps",
    "src/features/calendar",
    "src/features/communications",
    "src/features/contacts",
    "src/features/planning",
    "src/shared/exporting/serverReports",
    "src/styles/apps-manager",
    "src/styles/calendar",
    "src/styles/communications",
    "src/styles/contacts",
    "src/styles/planning",
    "web/src/app/contactDraft.ts",
    "web/src/app/useContactCommands.ts",
    "web/src/app/useContactWorkspaceState.ts",
    "web/src/features/<feature>",
    "web/src/features/apps",
    "web/src/features/calendar",
    "web/src/features/communications",
    "web/src/features/contacts",
    "web/src/features/planning",
    "web/src/shared/exporting/serverReports",
    "web/src/styles/apps-manager",
    "web/src/styles/calendar",
    "web/src/styles/communications",
    "web/src/styles/contacts",
    "web/src/styles/planning",
)


def active_markdown_documents(repo_root: Path) -> list[Path]:
    documents = [
        repo_root / "AGENTS.md",
        repo_root / "README.md",
        repo_root / "web" / "README.md",
    ]
    for root in (repo_root / ".github", repo_root / "docs", repo_root / "modules"):
        if not root.exists():
            continue
        documents.extend(
            path
            for path in root.rglob("*.md")
            if path.name not in HISTORICAL_DOCUMENT_NAMES
        )
    return sorted({path for path in documents if path.is_file()})


def _repository_reference(token: str) -> str | None:
    reference = token.strip().removeprefix("./").rstrip("/")
    if not reference or any(marker in reference for marker in TEMPLATE_MARKERS):
        return None
    if " " in reference or "\\" in reference or ":" in reference or "#" in reference:
        return None
    if reference in ROOT_REFERENCES or reference.startswith(REPOSITORY_PREFIXES):
        return reference
    return None


def _retired_reference_matches(line: str) -> list[str]:
    matches: list[str] = []
    for reference in RETIRED_FRONTEND_REFERENCES:
        path_pattern = r"[\\/]".join(
            re.escape(part) for part in reference.split("/")
        )
        pattern = rf"(?<![A-Za-z0-9._/\\-])(?:\.[\\/])?{path_pattern}"
        if re.search(pattern, line):
            matches.append(reference)
    return matches


def _tracked_paths(repo_root: Path) -> frozenset[str] | None:
    try:
        result = subprocess.run(
            ["git", "-C", str(repo_root), "ls-files", "-z"],
            capture_output=True,
            check=False,
        )
    except OSError:
        return None
    if result.returncode != 0:
        return None
    return frozenset(
        path.decode("utf-8", errors="surrogateescape")
        for path in result.stdout.split(b"\0")
        if path
    )


def _exists_with_exact_case(
    repo_root: Path,
    reference: str,
    tracked_paths: frozenset[str] | None,
) -> bool:
    current = repo_root
    for part in PurePosixPath(reference).parts:
        if not current.is_dir():
            return False
        names = {child.name for child in current.iterdir()}
        if part not in names:
            return False
        current /= part
    if current.is_file():
        return True
    if not current.is_dir():
        return False
    prefix = f"{reference.rstrip('/')}/"
    tracked_descendant = tracked_paths is not None and any(
        path.startswith(prefix)
        and (repo_root / PurePosixPath(path)).is_file()
        for path in tracked_paths
    )
    return tracked_descendant or any(path.is_file() for path in current.rglob("*"))


def _internal_link_problem(
    repo_root: Path,
    document: Path,
    raw_target: str,
    tracked_paths: frozenset[str] | None,
) -> str | None:
    target = raw_target.strip().strip("<>")
    if not target or target.startswith(("#", "http://", "https://", "mailto:")):
        return None
    target = unquote(target.split("#", 1)[0].split("?", 1)[0])
    document_parent = document.parent.relative_to(repo_root).as_posix()
    base = "" if target.startswith("/") else document_parent
    relative = posixpath.normpath(posixpath.join(base, target.lstrip("/")))
    if relative == ".." or relative.startswith("../"):
        return f"link escapes repository: {raw_target}"
    candidate = repo_root / PurePosixPath(relative)
    try:
        candidate.resolve().relative_to(repo_root.resolve())
    except ValueError:
        return f"link escapes repository: {raw_target}"
    if _exists_with_exact_case(repo_root, relative, tracked_paths):
        return None
    return f"missing internal link target {raw_target}"


def documentation_reference_problems(repo_root: Path) -> list[str]:
    problems: list[str] = []
    tracked_paths = _tracked_paths(repo_root)
    for document in active_markdown_documents(repo_root):
        in_fence = False
        for line_number, line in enumerate(
            document.read_text(encoding="utf-8", errors="ignore").splitlines(),
            start=1,
        ):
            for retired_reference in _retired_reference_matches(line):
                relative_document = document.relative_to(repo_root).as_posix()
                problems.append(
                    f"{relative_document}:{line_number}: retired frontend reference "
                    f"{retired_reference}"
                )
            if line.lstrip().startswith("```"):
                in_fence = not in_fence
                continue
            if in_fence:
                continue
            for match in INLINE_CODE.finditer(line):
                reference = _repository_reference(match.group(1))
                if reference is None or reference in GENERATED_OUTPUT_REFERENCES or _exists_with_exact_case(
                    repo_root,
                    reference,
                    tracked_paths,
                ):
                    continue
                relative_document = document.relative_to(repo_root).as_posix()
                problems.append(
                    f"{relative_document}:{line_number}: missing repository reference "
                    f"{reference}"
                )
            for match in MARKDOWN_LINK.finditer(line):
                problem = _internal_link_problem(
                    repo_root,
                    document,
                    match.group(1),
                    tracked_paths,
                )
                if problem:
                    relative_document = document.relative_to(repo_root).as_posix()
                    problems.append(f"{relative_document}:{line_number}: {problem}")

    index_path = repo_root / "docs" / "DOCUMENTATION_INDEX.md"
    if index_path.is_file():
        index = index_path.read_text(encoding="utf-8", errors="ignore")
        for document in sorted((repo_root / "docs").rglob("*.md")):
            if document == index_path:
                continue
            relative = document.relative_to(repo_root).as_posix()
            if relative not in index:
                problems.append(
                    "docs/DOCUMENTATION_INDEX.md: missing documentation route "
                    f"{relative}"
                )
    return problems


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    failures = documentation_reference_problems(root)
    if failures:
        print(*failures, sep="\n")
    raise SystemExit(1 if failures else 0)

from __future__ import annotations

import re
import tomllib
from pathlib import Path


REQUIRED_RUNTIME_PINS = {
    "fastapi==0.139.0",
    "icalendar==7.2.0",
    "sqlalchemy==2.0.51",
    "pydantic==2.13.4",
    "psycopg[binary]==3.3.4",
}
REQUIRED_DEV_PINS = {
    "pytest==9.1.1",
    "httpx2==2.5.0",
    "pip-audit==2.10.0",
}
EXACT_REQUIREMENT_PATTERN = re.compile(
    r"^[A-Za-z0-9][A-Za-z0-9._-]*"
    r"(?:\[[A-Za-z0-9._-]+(?:,[A-Za-z0-9._-]+)*\])?"
    r"==[A-Za-z0-9][A-Za-z0-9._+!-]*$"
)


def _meaningful_lines(path: Path) -> list[str]:
    return [
        line.strip()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]


def _pin_problems(entries: set[str], label: str) -> list[str]:
    return [
        f"unpinned {label} dependency: {entry}"
        for entry in sorted(entries)
        if not EXACT_REQUIREMENT_PATTERN.fullmatch(entry)
    ]


def validate_dependency_policy(repo_root: Path) -> list[str]:
    runtime_path = repo_root / "requirements.txt"
    dev_path = repo_root / "requirements-dev.txt"
    if not runtime_path.exists() or not dev_path.exists():
        missing = [path.name for path in (runtime_path, dev_path) if not path.exists()]
        return [f"missing Python requirements layer: {name}" for name in missing]

    pyproject = tomllib.loads((repo_root / "pyproject.toml").read_text(encoding="utf-8"))
    project = pyproject["project"]
    runtime_entries = set(_meaningful_lines(runtime_path))
    dev_lines = _meaningful_lines(dev_path)
    dev_includes = [line for line in dev_lines if line.startswith(("-r ", "--requirement "))]
    dev_entries = set(dev_lines) - set(dev_includes)
    project_runtime = set(project.get("dependencies", []))
    project_dev = set(project.get("optional-dependencies", {}).get("dev", []))

    problems: list[str] = []
    if project.get("requires-python") != ">=3.14":
        problems.append("pyproject requires-python must be >=3.14")
    problems.extend(_pin_problems(project_runtime, "pyproject runtime"))
    problems.extend(_pin_problems(project_dev, "pyproject dev"))
    problems.extend(_pin_problems(runtime_entries, "runtime requirements"))
    problems.extend(_pin_problems(dev_entries, "dev requirements"))
    if dev_includes != ["-r requirements.txt"]:
        problems.append("requirements-dev.txt must include exactly -r requirements.txt")
    if runtime_entries != project_runtime:
        problems.append("requirements.txt must exactly match pyproject runtime dependencies")
    if dev_entries != project_dev:
        problems.append("requirements-dev.txt tools must exactly match pyproject optional dev dependencies")
    for pin in sorted(REQUIRED_RUNTIME_PINS - runtime_entries):
        problems.append(f"missing required runtime pin: {pin}")
    for pin in sorted(REQUIRED_DEV_PINS - dev_entries):
        problems.append(f"missing required dev pin: {pin}")
    return problems

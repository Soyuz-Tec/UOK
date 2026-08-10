from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from pathlib import Path


ADR_DIRECTORY = Path("docs/architecture")
ADR_INDEX = ADR_DIRECTORY / "ADR_INDEX.md"
ADR_FILE = re.compile(r"ADR-(\d{4})-[a-z0-9-]+\.md$")
ADR_HEADING = re.compile(r"^# ADR-(\d{4}):\s+\S", re.MULTILINE)
ADR_REFERENCE = re.compile(r"\bADR-(\d{4})\b")
INDEX_ROW = re.compile(
    r"^\| \[ADR-(\d{4})\]\((ADR-\d{4}-[a-z0-9-]+\.md)\) "
    r"\| ([^|]+) \| ([^|]+) \| (\d{4}-\d{2}-\d{2}) \| ([^|]+) "
    r"\| ([^|]+) \| ([^|]+) \| ([^|]+) \|$"
)
DECISION_STATUSES = frozenset({"Proposed", "Accepted", "Superseded", "Rejected"})
IMPLEMENTATION_STATUSES = frozenset(
    {"Planned", "Partial", "Implemented", "Inactive", "Historical", "Not applicable"}
)
NEW_ADR_REQUIRED_SECTIONS = (
    "Context",
    "Decision",
    "Consequences",
    "Alternatives",
    "Validation",
    "Rollback",
)


@dataclass(frozen=True)
class AdrEntry:
    identifier: str
    filename: str
    decision_status: str
    implementation_status: str


def _adr_files(repo_root: Path) -> list[Path]:
    directory = repo_root / ADR_DIRECTORY
    return sorted(path for path in directory.glob("ADR-*.md") if ADR_FILE.fullmatch(path.name))


def _index_entries(repo_root: Path, problems: list[str]) -> list[AdrEntry]:
    index_path = repo_root / ADR_INDEX
    if not index_path.is_file():
        problems.append(f"missing ADR registry: {ADR_INDEX.as_posix()}")
        return []
    entries: list[AdrEntry] = []
    for line_number, line in enumerate(index_path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.startswith("| [ADR-"):
            continue
        match = INDEX_ROW.fullmatch(line)
        if not match:
            problems.append(f"{ADR_INDEX.as_posix()}:{line_number}: malformed ADR registry row")
            continue
        identifier, filename, decision, implementation, *_ = (
            value.strip() for value in match.groups()
        )
        if decision not in DECISION_STATUSES:
            problems.append(f"ADR-{identifier}: invalid decision status {decision}")
        if implementation not in IMPLEMENTATION_STATUSES:
            problems.append(f"ADR-{identifier}: invalid implementation status {implementation}")
        entries.append(AdrEntry(identifier, filename, decision, implementation))
    return entries


def adr_policy_problems(repo_root: Path) -> list[str]:
    problems: list[str] = []
    files = _adr_files(repo_root)
    file_ids: list[str] = []
    known_ids: set[str] = set()
    for path in files:
        filename_match = ADR_FILE.fullmatch(path.name)
        assert filename_match is not None
        identifier = filename_match.group(1)
        text = path.read_text(encoding="utf-8")
        heading_match = ADR_HEADING.search(text)
        if not heading_match or heading_match.group(1) != identifier:
            problems.append(f"{path.relative_to(repo_root).as_posix()}: heading ID must match filename")
        if identifier in known_ids:
            problems.append(f"duplicate ADR ID: ADR-{identifier}")
        known_ids.add(identifier)
        file_ids.append(identifier)
        if int(identifier) >= 36:
            for field in ("Status", "Implementation status", "Date", "Owners"):
                if not re.search(rf"^\*\*{re.escape(field)}:\*\*\s+\S", text, re.MULTILINE):
                    problems.append(f"ADR-{identifier}: missing metadata field {field}")
            for section in NEW_ADR_REQUIRED_SECTIONS:
                if f"## {section}" not in text:
                    problems.append(f"ADR-{identifier}: missing section {section}")

    entries = _index_entries(repo_root, problems)
    registry_ids = [entry.identifier for entry in entries]
    registry_files = [entry.filename for entry in entries]
    if registry_ids != sorted(registry_ids):
        problems.append("ADR registry rows must be sorted by ID")
    if len(registry_ids) != len(set(registry_ids)):
        problems.append("ADR registry contains duplicate IDs")
    if len(registry_files) != len(set(registry_files)):
        problems.append("ADR registry contains duplicate filenames")
    if set(registry_ids) != set(file_ids):
        missing = sorted(set(file_ids) - set(registry_ids))
        stale = sorted(set(registry_ids) - set(file_ids))
        if missing:
            problems.append("ADR registry missing IDs: " + ", ".join(f"ADR-{item}" for item in missing))
        if stale:
            problems.append("ADR registry has stale IDs: " + ", ".join(f"ADR-{item}" for item in stale))
    actual_filenames = {path.name for path in files}
    for entry in entries:
        if entry.filename not in actual_filenames:
            problems.append(f"ADR-{entry.identifier}: registry filename does not exist: {entry.filename}")
        elif not entry.filename.startswith(f"ADR-{entry.identifier}-"):
            problems.append(f"ADR-{entry.identifier}: registry filename ID does not match")

    for path in files:
        text = path.read_text(encoding="utf-8")
        for referenced_id in sorted(set(ADR_REFERENCE.findall(text))):
            if referenced_id not in known_ids:
                problems.append(
                    f"{path.relative_to(repo_root).as_posix()}: unknown ADR reference ADR-{referenced_id}"
                )
    return problems


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate the UOK ADR registry and decision files.")
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[1])
    arguments = parser.parse_args(argv)
    problems = adr_policy_problems(arguments.repo_root.resolve())
    if problems:
        print(*problems, sep="\n")
    else:
        print("ADR registry, identifiers, lifecycle states, and references are valid.")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())

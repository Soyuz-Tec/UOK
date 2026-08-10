from __future__ import annotations

import hashlib
import json
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

import coverage_provenance
from coverage_run_binding import (
    JSON_FIELD,
    LCOV_PREFIX,
    TRUST_MODEL,
    XML_FIELDS,
    bind_artifacts,
)
from engineering_coverage import expected_coverage_inventory


OBSERVED_AT = "2026-07-24T20:00:00+00:00"
STARTED_AT = "2026-07-24T19:00:00+00:00"
COMPLETED_AT = "2026-07-24T19:30:00+00:00"


def git(root: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=root,
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def coverage_payloads(root: Path) -> tuple[dict[str, object], dict[str, object]]:
    python = {
        "meta": {"version": "test"},
        "files": {
            "src/uok/example.py": {
                "summary": {
                    "covered_lines": 5,
                    "num_statements": 6,
                    "covered_branches": 2,
                    "num_branches": 2,
                }
            },
            "modules/example.core/backend/example.py": {
                "summary": {
                    "covered_lines": 3,
                    "num_statements": 4,
                    "covered_branches": 1,
                    "num_branches": 2,
                }
            },
        },
        "totals": {
            "covered_lines": 8,
            "num_statements": 10,
            "covered_branches": 3,
            "num_branches": 4,
        },
    }
    frontend = {
        "total": {
            "lines": {"covered": 9, "total": 10},
            "branches": {"covered": 4, "total": 6},
        },
        str((root / "web/src/example.ts").resolve()): {
            "lines": {"covered": 5, "total": 5},
            "branches": {"covered": 2, "total": 2},
        },
        str((root / "modules/example.core/web/src/module.ts").resolve()): {
            "lines": {"covered": 4, "total": 5},
            "branches": {"covered": 2, "total": 4},
        },
    }
    return python, frontend


def write_coverage_provenance(root: Path) -> None:
    repository = {
        "origin": git(root, "remote", "get-url", "origin"),
        "head": git(root, "rev-parse", "--verify", "HEAD"),
        "worktree": "clean",
    }
    for kind, spec in coverage_provenance.SPECS.items():
        run_id = f"{kind}-fixture"
        artifact_paths = [
            root / artifact.path for artifact in spec.artifacts
        ]
        _strip_fixture_bindings(artifact_paths)
        bind_artifacts(kind, run_id, artifact_paths)
        inventory = expected_coverage_inventory(root, kind)
        inventory_raw = "\n".join(inventory).encode("utf-8")
        payload = {
            "schema": coverage_provenance.PROVENANCE_SCHEMA,
            "kind": kind,
            "method": spec.method,
            "trust_model": TRUST_MODEL,
            "run_id": run_id,
            "repository": repository,
            "started_at": STARTED_AT,
            "completed_at": COMPLETED_AT,
            "artifacts": [
                _artifact_record(root, artifact)
                for artifact in spec.artifacts
            ],
            "inventory": {
                "file_count": len(inventory),
                "sha256": hashlib.sha256(inventory_raw).hexdigest(),
            },
        }
        write(root / spec.provenance_path, json.dumps(payload))


def _strip_fixture_bindings(paths: list[Path]) -> None:
    for path in paths:
        if path.suffix == ".json":
            payload = json.loads(path.read_text(encoding="utf-8"))
            payload.pop(JSON_FIELD, None)
            write(path, json.dumps(payload))
        elif path.suffix == ".xml":
            tree = ET.parse(path)
            for field in XML_FIELDS:
                tree.getroot().attrib.pop(field, None)
            tree.write(path, encoding="unicode")
        elif path.name == "lcov.info":
            lines = path.read_text(encoding="utf-8").splitlines()
            if lines and lines[0].startswith(LCOV_PREFIX):
                lines.pop(0)
            write(path, "\n".join(lines) + "\n")


def _artifact_record(
    root: Path,
    artifact: coverage_provenance.CoverageArtifact,
) -> dict[str, object]:
    raw = (root / artifact.path).read_bytes()
    return {
        "path": artifact.path,
        "sha256": hashlib.sha256(raw).hexdigest(),
        "bytes": len(raw),
        "media_type": artifact.media_type,
    }


def write_coverage_corroboration(
    root: Path,
    python: dict[str, object],
    frontend: dict[str, object],
) -> None:
    files = python["files"]
    assert isinstance(files, dict)
    classes = []
    for filename, record in files.items():
        xml_filename = (
            filename.removeprefix("src/uok/")
            if filename.startswith("src/uok/")
            else filename.removeprefix("modules/")
        )
        summary = record["summary"]
        statements = int(summary["num_statements"])
        covered = int(summary["covered_lines"])
        branches = int(summary["num_branches"])
        covered_branches = int(summary["covered_branches"])
        line_nodes = []
        for index in range(statements):
            attributes = [
                f'number="{index + 1}"',
                f'hits="{int(index < covered)}"',
            ]
            if index == 0 and branches:
                attributes.extend([
                    'branch="true"',
                    (
                        'condition-coverage="0% '
                        f'({covered_branches}/{branches})"'
                    ),
                ])
            line_nodes.append(f"<line {' '.join(attributes)} />")
        classes.append(
            f'<class filename="{xml_filename}"><lines>'
            + "".join(line_nodes)
            + "</lines></class>"
        )
    write(
        root / coverage_provenance.SPECS["python"].corroboration_path,
        "<coverage><sources><source>src/uok</source><source>modules</source>"
        "</sources><packages><package><classes>"
        + "".join(classes)
        + "</classes></package></packages></coverage>",
    )

    records = []
    for filename, record in frontend.items():
        if filename == "total":
            continue
        records.append(
            "\n".join([
                "TN:",
                f"SF:{filename}",
                f"LF:{record['lines']['total']}",
                f"LH:{record['lines']['covered']}",
                f"BRF:{record['branches']['total']}",
                f"BRH:{record['branches']['covered']}",
                "end_of_record",
            ])
        )
    frontend_spec = coverage_provenance.SPECS["frontend"]
    write(root / frontend_spec.corroboration_path, "\n".join(records) + "\n")
    write(
        root / frontend_spec.artifacts[2].path,
        "<coverage />\n",
    )


def create_measurement_repo(root: Path, source_specs: tuple[tuple[str, str], ...]) -> Path:
    write(root / ".gitignore", "/var/\n")
    write(root / "src/uok/example.py", "value = 1\n")
    write(root / "modules/example.core/backend/example.py", "value = 2\n")
    write(root / "web/src/example.ts", "export const value = 1;\n")
    write(
        root / "modules/example.core/web/src/module.ts",
        "export const value = 2;\n",
    )
    git(root, "init", "-b", "main")
    git(root, "config", "user.name", "UOK Test")
    git(root, "config", "user.email", "uok-test@example.invalid")
    git(root, "remote", "add", "origin", "https://example.invalid/UOK.git")
    git(root, "add", ".")
    git(root, "commit", "-m", "measurement fixture")
    python, frontend = coverage_payloads(root)
    write(root / source_specs[0][1], json.dumps(python))
    write(root / source_specs[1][1], json.dumps(frontend))
    write_coverage_corroboration(root, python, frontend)
    write_coverage_provenance(root)
    assert git(root, "status", "--porcelain=v1", "--untracked-files=all") == ""
    return root

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import quality_audit


REPO_ROOT = Path(__file__).resolve().parents[1]


def run_git(args: list[str]) -> str:
    completed = subprocess.run(
        ["git", *args],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return completed.stdout.strip()


def file_sha256(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def file_record(relative_path: str) -> dict[str, Any]:
    path = REPO_ROOT / relative_path
    if not path.exists():
        return {"path": relative_path, "exists": False}
    return {
        "path": relative_path,
        "exists": True,
        "sha256": file_sha256(path),
        "bytes": path.stat().st_size,
    }


def quality_report() -> dict[str, Any]:
    results = quality_audit.run_checks()
    return {
        "ok": all(result.ok for result in results),
        "checks": [result.__dict__ for result in results],
    }


def module_manifest_records() -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for manifest in sorted((REPO_ROOT / "modules").glob("*/manifest.yaml")):
        module_root = manifest.parent
        records.append(
            {
                "module": module_root.name,
                "manifest": file_record(str(manifest.relative_to(REPO_ROOT))),
                "folders": {
                    folder: (module_root / folder).is_dir()
                    for folder in ("backend", "web", "migrations", "tests")
                },
            }
        )
    return records


def build_evidence() -> dict[str, Any]:
    status_lines = run_git(["status", "--short"]).splitlines()
    guardrail_files = [
        "AGENTS.md",
        ".github/CODEOWNERS",
        ".github/copilot-instructions.md",
        ".github/dependabot.yml",
        ".github/pull_request_template.md",
        ".github/workflows/uok-ci.yml",
        ".github/workflows/uok-openssf-scorecard.yml",
        "docs/ARCHITECTURE.md",
        "docs/DOCUMENTATION_INDEX.md",
        "docs/architecture/UOK_INTERNAL_ENGINEERING_SYSTEM.md",
        "docs/architecture/UOK_CODE_QUALITY_AND_TECHNOLOGY_AUDIT_STANDARD.md",
        "docs/operations/UOK_STANDARD_OPERATIONS.md",
        "docs/operations/UOK_GITHUB_ENGINEERING_GUARDRAILS.md",
    ]
    return {
        "schema": "uok.engineering_evidence.v1",
        "created_at": datetime.now(UTC).isoformat(),
        "git": {
            "branch": run_git(["branch", "--show-current"]),
            "head": run_git(["rev-parse", "HEAD"]),
            "remote_origin": run_git(["remote", "get-url", "origin"]),
            "dirty_file_count": len(status_lines),
        },
        "quality_audit": quality_report(),
        "guardrail_files": [file_record(path) for path in guardrail_files],
        "module_manifests": module_manifest_records(),
    }


def default_output_path() -> Path:
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    return REPO_ROOT / "var" / "evidence" / "engineering" / f"uok_engineering_{stamp}.json"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate UOK engineering evidence.")
    parser.add_argument("--stdout", action="store_true", help="Print evidence without writing a file.")
    parser.add_argument("--output", help="Write evidence to this path.")
    args = parser.parse_args()

    evidence = build_evidence()
    rendered = json.dumps(evidence, indent=2)
    if args.stdout:
        print(rendered)
        return 0

    output = Path(args.output) if args.output else default_output_path()
    if not output.is_absolute():
        output = REPO_ROOT / output
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(rendered + "\n", encoding="utf-8")
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

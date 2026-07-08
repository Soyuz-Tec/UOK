from __future__ import annotations

import json
import sys
import tomllib
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import source_size_policy


REPO_ROOT = Path(__file__).resolve().parents[1]


@dataclass
class CheckResult:
    name: str
    ok: bool
    details: str


def read_text(path: str) -> str:
    return (REPO_ROOT / path).read_text(encoding="utf-8", errors="ignore")


def read_json(path: str) -> dict[str, Any]:
    return json.loads(read_text(path))


def check_required_artifacts() -> CheckResult:
    required = [
        "README.md",
        "AGENTS.md",
        "docs/ARCHITECTURE.md",
        "docs/DOCUMENTATION_INDEX.md",
        "docs/architecture/UOK_CODE_QUALITY_AND_TECHNOLOGY_AUDIT_STANDARD.md",
        "docs/architecture/UOK_DEVELOPMENT_CONTINUITY_SYSTEM.md",
        "docs/architecture/UOK_INTERNAL_ENGINEERING_SYSTEM.md",
        "docs/architecture/UOK_PROGRAMMING_LANGUAGE_STACK_POLICY.md",
        "docs/design/UOK_UI_DESIGN_POLICY.md",
        "docs/operations/UOK_STANDARD_OPERATIONS.md",
        "docs/operations/UOK_ASUH_TEST_EVENTS.md",
        "docs/operations/UOK_GITHUB_ENGINEERING_GUARDRAILS.md",
        "scripts/engineering_evidence.py",
        "scripts/quality_scorecard.py",
        "scripts/source_size_policy.py",
        "scripts/uok_github_ops.ps1",
        ".github/CODEOWNERS",
        ".github/copilot-instructions.md",
        ".github/dependabot.yml",
        ".github/workflows/uok-ci.yml",
        ".github/workflows/uok-openssf-scorecard.yml",
        ".github/pull_request_template.md",
    ]
    missing = [path for path in required if not (REPO_ROOT / path).exists()]
    return CheckResult("required_artifacts", not missing, ", ".join(missing) or "present")


def check_python_stack() -> CheckResult:
    pyproject = tomllib.loads(read_text("pyproject.toml"))
    requirements = [
        line.strip()
        for line in read_text("requirements.txt").splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]
    problems: list[str] = []
    if pyproject["project"].get("requires-python") != ">=3.14":
        problems.append("pyproject requires-python must be >=3.14")
    for dependency in pyproject["project"].get("dependencies", []):
        if "==" not in dependency:
            problems.append(f"unpinned pyproject dependency: {dependency}")
    for dependency in pyproject["project"].get("optional-dependencies", {}).get("dev", []):
        if "==" not in dependency:
            problems.append(f"unpinned pyproject dev dependency: {dependency}")
    for dependency in requirements:
        if "==" not in dependency:
            problems.append(f"unpinned requirements dependency: {dependency}")
    required_pins = {
        "fastapi==0.139.0",
        "sqlalchemy==2.0.51",
        "pydantic==2.13.4",
        "psycopg[binary]==3.3.4",
    }
    missing = sorted(required_pins - set(requirements))
    problems.extend(f"missing required pin: {pin}" for pin in missing)
    return CheckResult("python_stack", not problems, "; ".join(problems) or "pinned")


def check_frontend_stack() -> CheckResult:
    package = read_json("web/package.json")
    tsconfig = read_json("web/tsconfig.json")
    compiler_options = tsconfig.get("compilerOptions", {})
    problems: list[str] = []
    if package.get("type") != "module":
        problems.append("web/package.json must use type=module")
    if package.get("engines", {}).get("node") != ">=26 <27":
        problems.append("Node engine must be >=26 <27")
    if package.get("scripts", {}).get("test") is None:
        problems.append("frontend test script missing")
    if package.get("scripts", {}).get("build:static") is None:
        problems.append("frontend static build script missing")
    if compiler_options.get("strict") is not True:
        problems.append("TypeScript strict mode must stay enabled")
    if compiler_options.get("allowJs") is not False:
        problems.append("TypeScript allowJs must stay false")
    if not (REPO_ROOT / "web/package-lock.json").exists():
        problems.append("web/package-lock.json missing")
    durable_js = [
        path.as_posix()
        for path in (REPO_ROOT / "web/src").rglob("*.js")
        if "generated" not in path.parts
    ]
    problems.extend(f"durable JavaScript source is not allowed: {path}" for path in durable_js)
    return CheckResult("frontend_stack", not problems, "; ".join(problems) or "typed")


def check_runtime_stack() -> CheckResult:
    dockerfile = read_text("Dockerfile")
    compose = read_text("deploy/compose-local-18088.yaml")
    ci = read_text(".github/workflows/uok-ci.yml")
    problems: list[str] = []
    expected = {
        "Dockerfile Python 3.14": "python:3.14-slim" in dockerfile,
        "Dockerfile Node 26": "node:26-alpine" in dockerfile,
        "Compose PostgreSQL 18": "postgres:18-alpine" in compose,
        "CI PostgreSQL 18": "postgres:18-alpine" in ci,
        "CI Python 3.14": 'python-version: "3.14"' in ci,
        "CI Node 26": 'node-version: "26"' in ci,
        "CI quality audit": "scripts/quality_audit.py" in ci,
    }
    problems.extend(name for name, ok in expected.items() if not ok)
    return CheckResult("runtime_stack", not problems, "; ".join(problems) or "aligned")


def check_module_shape() -> CheckResult:
    problems: list[str] = []
    for manifest in sorted((REPO_ROOT / "modules").glob("*/manifest.yaml")):
        module_root = manifest.parent
        for folder in ("backend", "web", "migrations", "tests"):
            if not (module_root / folder).is_dir():
                problems.append(f"{module_root.relative_to(REPO_ROOT).as_posix()} missing {folder}/")
    return CheckResult("module_shape", not problems, "; ".join(problems) or "valid")


def check_source_size() -> CheckResult:
    report = source_size_policy.run_source_size_policy(REPO_ROOT)
    details = source_size_policy.summarize_source_size_policy(report)
    return CheckResult("source_size", bool(report["ok"]), details)


def check_operations_hygiene() -> CheckResult:
    gitignore = read_text(".gitignore") if (REPO_ROOT / ".gitignore").exists() else ""
    runbook = read_text("docs/operations/UOK_STANDARD_OPERATIONS.md")
    continuity = read_text("docs/architecture/UOK_DEVELOPMENT_CONTINUITY_SYSTEM.md")
    problems: list[str] = []
    if "var/" not in gitignore:
        problems.append("var/ must stay ignored for local evidence")
    if "TechnologyAudit" not in runbook:
        problems.append("standard operations runbook must document TechnologyAudit")
    if "EngineeringEvidence" not in runbook:
        problems.append("standard operations runbook must document EngineeringEvidence")
    for action in ("GithubReadiness", "GithubSecuritySetup", "GithubPrChecks"):
        if action not in runbook:
            problems.append(f"standard operations runbook must document {action}")
    if "GitHub is the shared UOK source of truth" not in runbook:
        problems.append("standard operations runbook must define GitHub source-of-truth policy")
    if "GitHub Synchronization Policy" not in continuity:
        problems.append("development continuity guide must define GitHub synchronization policy")
    index = read_text("docs/DOCUMENTATION_INDEX.md")
    if "AGENTS.md" not in index:
        problems.append("documentation index must route AGENTS.md")
    if "UOK_CODE_QUALITY_AND_TECHNOLOGY_AUDIT_STANDARD.md" not in index:
        problems.append("documentation index must route quality standard")
    if "UOK_GITHUB_ENGINEERING_GUARDRAILS.md" not in index:
        problems.append("documentation index must route GitHub guardrails")
    return CheckResult("operations_hygiene", not problems, "; ".join(problems) or "documented")


def check_internal_engineering_system() -> CheckResult:
    document = read_text("docs/architecture/UOK_INTERNAL_ENGINEERING_SYSTEM.md")
    index = read_text("docs/DOCUMENTATION_INDEX.md")
    architecture = read_text("docs/ARCHITECTURE.md")
    pr_template = read_text(".github/pull_request_template.md")
    problems: list[str] = []
    required_names = [
        "Microsoft SDL",
        "Google Engineering Practices",
        "SLSA",
        "OpenSSF Scorecard",
        "ISO/IEC/IEEE 12207",
        "ISO/IEC/IEEE 15288",
        "ISO/IEC/IEEE 42010",
        "ISO/IEC 25010",
        "ISO/IEC 5055",
        "ISO/IEC/IEEE 29119",
        "NIST SP 800-218 SSDF",
        "OWASP ASVS",
        "OWASP SAMM",
    ]
    required_layers = [
        "Policies",
        "Checklists",
        "CI gates",
        "Code review rules",
        "Release gates",
        "Dashboards",
        "Audit evidence",
    ]
    for name in required_names:
        if name not in document:
            problems.append(f"engineering system missing standard name: {name}")
    for layer in required_layers:
        if layer not in document:
            problems.append(f"engineering system missing layer: {layer}")
    if "UOK_INTERNAL_ENGINEERING_SYSTEM.md" not in index:
        problems.append("documentation index must route internal engineering system")
    if "UOK_INTERNAL_ENGINEERING_SYSTEM.md" not in architecture:
        problems.append("architecture must link internal engineering system")
    if "UOK Internal Engineering System" not in pr_template:
        problems.append("PR template must ask for internal engineering system impact")
    return CheckResult("internal_engineering_system", not problems, "; ".join(problems) or "mapped")


def check_github_guardrails() -> CheckResult:
    problems: list[str] = []
    codeowners = read_text(".github/CODEOWNERS")
    dependabot = read_text(".github/dependabot.yml")
    scorecard = read_text(".github/workflows/uok-openssf-scorecard.yml")
    ci = read_text(".github/workflows/uok-ci.yml")
    guardrails = read_text("docs/operations/UOK_GITHUB_ENGINEERING_GUARDRAILS.md")
    if "@Soyuz-Tec" not in codeowners:
        problems.append("CODEOWNERS must name the repository owner")
    for ecosystem in ("pip", "npm", "github-actions", "docker"):
        if f"package-ecosystem: {ecosystem}" not in dependabot:
            problems.append(f"Dependabot missing {ecosystem}")
    if "ossf/scorecard-action" not in scorecard:
        problems.append("OpenSSF Scorecard workflow missing scorecard action")
    if "python scripts/engineering_evidence.py --stdout" not in ci:
        problems.append("CI must generate engineering evidence")
    if "quality_scorecard" not in read_text("scripts/engineering_evidence.py"):
        problems.append("engineering evidence must include quality scorecard")
    for phrase in (
        "branch protection",
        "Require CODEOWNERS review",
        "OpenSSF Scorecard",
        "EngineeringEvidence",
        "source of truth",
        "upstream branch",
    ):
        if phrase not in guardrails:
            problems.append(f"GitHub guardrails doc missing: {phrase}")
    return CheckResult("github_guardrails", not problems, "; ".join(problems) or "ready")


def run_checks() -> list[CheckResult]:
    return [
        check_required_artifacts(),
        check_python_stack(),
        check_frontend_stack(),
        check_runtime_stack(),
        check_module_shape(),
        check_source_size(),
        check_operations_hygiene(),
        check_internal_engineering_system(),
        check_github_guardrails(),
    ]


def main() -> int:
    results = run_checks()
    report = {
        "ok": all(result.ok for result in results),
        "checks": [result.__dict__ for result in results],
    }
    print(json.dumps(report, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

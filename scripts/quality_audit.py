from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import database_capacity_audit
import dependency_policy
import documentation_reference_policy
import frontend_quality_policy
import source_size_policy


REPO_ROOT = Path(__file__).resolve().parents[1]


@dataclass
class CheckResult:
    name: str
    ok: bool
    details: str


def read_text(path: str) -> str:
    return (REPO_ROOT / path).read_text(encoding="utf-8", errors="ignore")


def check_required_artifacts() -> CheckResult:
    required = [
        "README.md",
        "AGENTS.md",
        "modules/README.md",
        "web/README.md",
        "docs/ARCHITECTURE.md",
        "docs/DOCUMENTATION_INDEX.md",
        "docs/architecture/UOK_CODE_QUALITY_AND_TECHNOLOGY_AUDIT_STANDARD.md",
        "docs/architecture/UOK_DEVELOPMENT_CONTINUITY_SYSTEM.md",
        "docs/architecture/UOK_INTERNAL_ENGINEERING_SYSTEM.md",
        "docs/architecture/UOK_PROGRAMMING_LANGUAGE_STACK_POLICY.md",
        "docs/architecture/ADR-0021-module-manifest-runtime-and-release-truth.md",
        "docs/architecture/ADR-0023-module-local-frontend-composition.md",
        "docs/architecture/ADR-0024-database-connection-pooling.md",
        "docs/design/UOK_UI_DESIGN_POLICY.md",
        "docs/operations/UOK_STANDARD_OPERATIONS.md",
        "docs/operations/UOK_ASUH_TEST_EVENTS.md",
        "docs/operations/UOK_CALENDAR_CORE_DEPLOYMENT.md",
        "docs/operations/UOK_GITHUB_ENGINEERING_GUARDRAILS.md",
        "docs/operations/UOK_DATABASE_CONNECTION_POOLING.md",
        "deploy/database-capacity.env",
        "scripts/engineering_evidence.py",
        "scripts/check_generated_contracts.py",
        "scripts/generate_frontend_module_catalog.py",
        "scripts/frontend_quality_policy.py",
        "scripts/frontend_source_policy.py",
        "scripts/candidate_verifier_catalog.py",
        "scripts/dependency_policy.py",
        "scripts/documentation_reference_policy.py",
        "scripts/quality_scorecard.py",
        "scripts/run_python_tests.py",
        "scripts/source_size_policy.py",
        "scripts/validate_container_module_assets.py",
        "scripts/verify_database_capacity.py",
        "scripts/database_capacity_live.py",
        "scripts/database_capacity_audit.py",
        "scripts/uok_github_ops.ps1",
        "src/uok/module_release_contract.py",
        "src/uok/host/db_pool.py",
        "requirements-dev.txt",
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
    problems = dependency_policy.validate_dependency_policy(REPO_ROOT)
    return CheckResult("python_stack", not problems, "; ".join(problems) or "pinned")


def check_frontend_stack() -> CheckResult:
    problems = frontend_quality_policy.frontend_stack_problems(REPO_ROOT)
    return CheckResult("frontend_stack", not problems, "; ".join(problems) or "typed")


def check_runtime_stack() -> CheckResult:
    dockerfile = read_text("Dockerfile")
    dockerignore = read_text(".dockerignore")
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
        "Docker runtime-only Python requirements": "requirements-dev.txt" not in dockerfile,
        "Docker excludes module tests": "modules/*/tests" in dockerignore,
        "Docker validates manifest-declared module assets": dockerfile.count(
            "python scripts/validate_container_module_assets.py --require-tests-excluded"
        ) == 2,
        "Docker explicit single API worker": '"--workers", "1"' in dockerfile,
    }
    problems.extend(name for name, ok in expected.items() if not ok)
    problems.extend(database_capacity_audit.database_capacity_policy_problems(REPO_ROOT))
    return CheckResult("runtime_stack", not problems, "; ".join(problems) or "aligned")


def check_module_shape() -> CheckResult:
    problems: list[str] = []
    for manifest in sorted((REPO_ROOT / "modules").glob("*/manifest.yaml")):
        module_root = manifest.parent
        if not (module_root / "README.md").is_file():
            problems.append(f"{module_root.relative_to(REPO_ROOT).as_posix()} missing README.md")
        for folder in ("backend", "web", "migrations", "tests"):
            if not (module_root / folder).is_dir():
                problems.append(f"{module_root.relative_to(REPO_ROOT).as_posix()} missing {folder}/")
    return CheckResult("module_shape", not problems, "; ".join(problems) or "valid")


def check_documentation_references() -> CheckResult:
    problems = documentation_reference_policy.documentation_reference_problems(REPO_ROOT)
    return CheckResult(
        "documentation_references",
        not problems,
        "; ".join(problems) or "resolved",
    )


def check_source_size() -> CheckResult:
    report = source_size_policy.run_source_size_policy(REPO_ROOT)
    details = source_size_policy.summarize_source_size_policy(report)
    return CheckResult("source_size", bool(report["ok"]), details)


def check_operations_hygiene() -> CheckResult:
    gitignore = read_text(".gitignore") if (REPO_ROOT / ".gitignore").exists() else ""
    runbook = read_text("docs/operations/UOK_STANDARD_OPERATIONS.md")
    continuity = read_text("docs/architecture/UOK_DEVELOPMENT_CONTINUITY_SYSTEM.md")
    operations_script = read_text("scripts/uok_ops.ps1")
    ci = read_text(".github/workflows/uok-ci.yml")
    problems: list[str] = []
    if "var/" not in gitignore:
        problems.append("var/ must stay ignored for local evidence")
    if "TechnologyAudit" not in runbook:
        problems.append("standard operations runbook must document TechnologyAudit")
    if "EngineeringEvidence" not in runbook:
        problems.append("standard operations runbook must document EngineeringEvidence")
    if "UiProof" not in runbook:
        problems.append("standard operations runbook must document UiProof")
    if "DatabaseCapacity" not in runbook:
        problems.append("standard operations runbook must document DatabaseCapacity")
    for action in ("GithubReadiness", "GithubSecuritySetup", "GithubPrChecks"):
        if action not in runbook:
            problems.append(f"standard operations runbook must document {action}")
    if "GitHub is the shared UOK source of truth" not in runbook:
        problems.append("standard operations runbook must define GitHub source-of-truth policy")
    if "GitHub Synchronization Policy" not in continuity:
        problems.append("development continuity guide must define GitHub synchronization policy")
    test_runner_command = "python scripts/run_python_tests.py"
    if test_runner_command not in ci:
        problems.append("CI must use the repository Python test runner")
    if '"scripts/run_python_tests.py"' not in operations_script:
        problems.append("local Audit must use the repository Python test runner")
    if '"--environment-file"' not in operations_script or '"deploy/database-capacity.env"' not in operations_script:
        problems.append("standard operations must use the canonical database capacity environment")
    release_validator = "validate_module_release_contracts"
    if release_validator not in ci:
        problems.append("CI must enforce the module release contract")
    if release_validator not in operations_script:
        problems.append("local Audit must enforce the module release contract")
    index = read_text("docs/DOCUMENTATION_INDEX.md")
    if "AGENTS.md" not in index:
        problems.append("documentation index must route AGENTS.md")
    if "UOK_CODE_QUALITY_AND_TECHNOLOGY_AUDIT_STANDARD.md" not in index:
        problems.append("documentation index must route quality standard")
    if "UOK_GITHUB_ENGINEERING_GUARDRAILS.md" not in index:
        problems.append("documentation index must route GitHub guardrails")
    if "ADR-0021-module-manifest-runtime-and-release-truth.md" not in index:
        problems.append("documentation index must route the manifest runtime/release ADR")
    if "ADR-0024-database-connection-pooling.md" not in index:
        problems.append("documentation index must route the database pooling ADR")
    if "UOK_DATABASE_CONNECTION_POOLING.md" not in index:
        problems.append("documentation index must route the database pooling runbook")
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
    if "ADR-0024-database-connection-pooling.md" not in architecture:
        problems.append("architecture must link database connection-pooling decision")
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
        check_documentation_references(),
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

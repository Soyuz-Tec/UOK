from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import github_actions_policy  # noqa: E402
import quality_audit  # noqa: E402


SHA = "a" * 40


def _write_workflow(root: Path, name: str, content: str) -> None:
    path = root / ".github" / "workflows" / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def test_current_repository_workflows_use_full_commit_shas() -> None:
    assert github_actions_policy.github_actions_pin_problems(ROOT) == []
    assert quality_audit.check_github_guardrails().ok is True


def test_current_ci_uses_immutable_database_and_exact_image_scan() -> None:
    workflow = (ROOT / ".github/workflows/uok-ci.yml").read_text(encoding="utf-8")
    required = (
        f"image: {github_actions_policy.POSTGRES_SERVICE_IMAGE}",
        (
            "uses: aquasecurity/trivy-action@"
            "ed142fd0673e97e23eac54620cfb913e5ce36c25"
        ),
        "image-ref: uok-ci:${{ github.sha }}",
        "output: var/evidence/security/trivy-ci-image.json",
        'exit-code: "1"',
        'ignore-unfixed: "false"',
        "scanners: vuln",
        "severity: HIGH,CRITICAL",
        "name: Preserve exact-image vulnerability report",
    )

    assert all(fragment in workflow for fragment in required)
    ordered_steps = (
        "name: Measure frontend coverage",
        "name: Prove coverage generation left a clean source tree",
        "name: Build verified coverage measurement",
        "name: Generate measured engineering evidence",
        "name: Require complete measured evidence set",
        "name: Build frontend",
    )
    positions = [workflow.index(step) for step in ordered_steps]
    assert positions == sorted(positions)
    assert 'test -z "$(git status --porcelain=v1 --untracked-files=all)"' in workflow
    upload = workflow.split("name: Preserve coverage evidence", 1)[1].split(
        "- name:",
        1,
    )[0]
    assert "if-no-files-found: error" in upload
    for path in (
        "var/evidence/coverage/python/coverage.json",
        "var/evidence/coverage/python/provenance.json",
        "var/evidence/coverage/frontend/coverage-summary.json",
        "var/evidence/coverage/frontend/provenance.json",
        "var/evidence/engineering/uok_engineering_measurements_v2.json",
        "var/evidence/engineering/uok_engineering_ci.json",
    ):
        assert workflow.count(path) >= 2


def test_named_bare_quoted_and_local_uses_forms_are_scanned(tmp_path: Path) -> None:
    _write_workflow(
        tmp_path,
        "valid.yml",
        f"""
jobs:
  named:
    steps:
      - name: Pinned action
        uses: actions/checkout@{SHA}
      - uses: './.github/actions/local'
  reusable:
    uses: "owner/repository/.github/workflows/check.yml@{SHA}"
""",
    )
    _write_workflow(tmp_path, "also-valid.yaml", f"- uses: owner/action/subpath@{SHA}\n")

    assert github_actions_policy.github_actions_pin_problems(tmp_path) == []


def test_tags_branches_short_uppercase_and_non_commit_refs_fail(tmp_path: Path) -> None:
    references = ("v4", "main", "abc1234", "A" * 40, "${{ inputs.action_ref }}", "sha256:abc")
    _write_workflow(
        tmp_path,
        "invalid.yml",
        "\n".join(f"- uses: owner/action@{reference}" for reference in references),
    )

    problems = github_actions_policy.github_actions_pin_problems(tmp_path)

    assert len(problems) == len(references)
    assert all("lower-case 40-character commit SHA" in problem for problem in problems)
    for line_number, problem in enumerate(problems, start=1):
        assert f".github/workflows/invalid.yml:{line_number}:" in problem


def test_missing_or_malformed_external_references_fail_closed(tmp_path: Path) -> None:
    _write_workflow(
        tmp_path,
        "malformed.yaml",
        """
- uses: docker://example.invalid/action:latest
- uses:
- uses: "owner/action@unterminated
""",
    )

    problems = github_actions_policy.github_actions_pin_problems(tmp_path)

    assert len(problems) == 3
    assert "external uses reference" in problems[0]
    assert all("40-character commit SHA" in problem for problem in problems)


def test_postgres_service_image_requires_reviewed_digest(tmp_path: Path) -> None:
    _write_workflow(
        tmp_path,
        "postgres-service.yml",
        """
jobs:
  checks:
    services:
      postgres:
        image: postgres:18-alpine
""",
    )

    assert github_actions_policy.github_actions_pin_problems(tmp_path) == [
        (
            ".github/workflows/postgres-service.yml:6: PostgreSQL service image "
            "must use the reviewed OCI index digest"
        )
    ]


def test_uses_text_inside_comments_and_run_blocks_is_not_an_action(tmp_path: Path) -> None:
    _write_workflow(
        tmp_path,
        "script-text.yml",
        """
# - uses: owner/action@v1
jobs:
  audit:
    steps:
      - run: |
          uses: owner/action@v1
          echo "uses: owner/action@main"
      - run: >-
          uses: owner/action@branch
""",
    )

    assert github_actions_policy.github_actions_pin_problems(tmp_path) == []


def test_missing_workflow_directory_or_files_fails_closed(tmp_path: Path) -> None:
    assert github_actions_policy.github_actions_pin_problems(tmp_path) == [
        ".github/workflows is missing"
    ]
    (tmp_path / ".github" / "workflows").mkdir(parents=True)
    assert github_actions_policy.github_actions_pin_problems(tmp_path) == [
        ".github/workflows has no YAML workflows"
    ]

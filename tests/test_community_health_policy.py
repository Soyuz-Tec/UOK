from __future__ import annotations

import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import community_health_policy  # noqa: E402
import quality_audit  # noqa: E402


def _write(root: Path, relative: str, content: str = "present\n") -> None:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _copy_required_files(root: Path) -> None:
    for relative in community_health_policy.REQUIRED_FILES:
        _write(root, relative, (ROOT / relative).read_text(encoding="utf-8"))


def test_repository_community_policy_is_complete_without_inventing_a_license() -> None:
    report = community_health_policy.community_health_report(ROOT)

    assert report["ok"] is True
    assert report["missing"] == []
    assert report["empty"] == []
    assert report["license"] == {
        "present": False,
        "path": None,
        "status": "owner_decision_required",
    }
    assert report["independent_review"]["status"] == "external_configuration_required"
    assert quality_audit.check_community_governance().ok is True


@pytest.mark.parametrize("relative", community_health_policy.REQUIRED_FILES)
def test_present_but_empty_required_artifact_fails_closed(
    tmp_path: Path, relative: str
) -> None:
    _copy_required_files(tmp_path)
    _write(tmp_path, relative, " \n\t\n")

    report = community_health_policy.community_health_report(tmp_path)

    assert report["ok"] is False
    assert relative in report["empty"]
    assert f"empty community artifact: {relative}" in report["problems"]


def test_missing_artifact_and_missing_policy_route_fail_closed(tmp_path: Path) -> None:
    _copy_required_files(tmp_path)
    (tmp_path / "CODE_OF_CONDUCT.md").unlink()
    _write(tmp_path, "SUPPORT.md", "# Support\nUse an unspecified issue.\n")

    report = community_health_policy.community_health_report(tmp_path)

    assert report["ok"] is False
    assert "missing community artifact: CODE_OF_CONDUCT.md" in report["problems"]
    assert (
        "SUPPORT.md missing required community policy phrase: "
        f"{community_health_policy.QUESTION_ROUTE}"
    ) in report["problems"]


def test_malformed_issue_form_fails_even_when_expected_words_are_present(
    tmp_path: Path,
) -> None:
    _copy_required_files(tmp_path)
    _write(
        tmp_path,
        community_health_policy.QUESTION_TEMPLATE,
        """name: Question
description: "unterminated
body:
  - type textarea
    id: question
    attributes:
      label: Question
    validations:
      required: true
""",
    )

    report = community_health_policy.community_health_report(tmp_path)

    assert report["ok"] is False
    assert any("unterminated quoted scalar" in problem for problem in report["problems"])
    assert any("body entry must declare type" in problem for problem in report["problems"])


def test_insufficient_question_form_fails_semantic_controls_not_phrase_presence(
    tmp_path: Path,
) -> None:
    _copy_required_files(tmp_path)
    _write(
        tmp_path,
        community_health_policy.QUESTION_TEMPLATE,
        """name: Question
description: Contains the phrases required question textarea, required area dropdown, and mandatory safety confirmation.
body:
  - type: markdown
    attributes:
      value: |
        This text mentions all controls but implements none of them.
""",
    )

    report = community_health_policy.community_health_report(tmp_path)

    assert report["ok"] is False
    assert (
        f"{community_health_policy.QUESTION_TEMPLATE} requires a required question textarea"
        in report["problems"]
    )
    assert (
        f"{community_health_policy.QUESTION_TEMPLATE} requires a required area dropdown"
        in report["problems"]
    )
    assert (
        f"{community_health_policy.QUESTION_TEMPLATE} requires a mandatory safety confirmation"
        in report["problems"]
    )


def test_issue_config_must_disable_blank_issues_and_keep_private_route(
    tmp_path: Path,
) -> None:
    _copy_required_files(tmp_path)
    _write(
        tmp_path,
        ".github/ISSUE_TEMPLATE/config.yml",
        """blank_issues_enabled: true
contact_links:
  - name: Security
    url: http://example.invalid/security
    about:
""",
    )

    report = community_health_policy.community_health_report(tmp_path)

    assert report["ok"] is False
    assert (
        ".github/ISSUE_TEMPLATE/config.yml must disable blank issues"
        in report["problems"]
    )
    assert (
        ".github/ISSUE_TEMPLATE/config.yml requires the private security advisory route"
        in report["problems"]
    )
    assert (
        ".github/ISSUE_TEMPLATE/config.yml contains an unusable contact link"
        in report["problems"]
    )


def test_declared_license_is_reported_without_interpreting_legal_terms(
    tmp_path: Path,
) -> None:
    _copy_required_files(tmp_path)
    _write(tmp_path, "LICENSE", "owner-selected terms\n")

    report = community_health_policy.community_health_report(tmp_path)

    assert report["ok"] is True
    assert report["license"] == {
        "present": True,
        "path": "LICENSE",
        "status": "declared",
    }

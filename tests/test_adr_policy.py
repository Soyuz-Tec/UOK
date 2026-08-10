from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import adr_policy  # noqa: E402
import quality_audit  # noqa: E402


def test_repository_adr_governance_is_consistent() -> None:
    assert adr_policy.adr_policy_problems(ROOT) == []


def test_quality_audit_enforces_adr_governance() -> None:
    result = quality_audit.check_adr_governance()
    assert result.ok is True
    assert result.details == "governed"


def test_duplicate_and_unknown_adr_references_are_reported(tmp_path: Path) -> None:
    architecture = tmp_path / "docs" / "architecture"
    architecture.mkdir(parents=True)
    (architecture / "ADR-0001-first.md").write_text(
        "# ADR-0001: First\n\nSee ADR-9999.\n",
        encoding="utf-8",
    )
    (architecture / "ADR-0001-copy.md").write_text(
        "# ADR-0001: Copy\n",
        encoding="utf-8",
    )
    (architecture / "ADR_INDEX.md").write_text(
        "| ID | Decision status | Implementation status | Date | Owners | Relations | Evidence | Revisit trigger |\n"
        "| --- | --- | --- | --- | --- | --- | --- | --- |\n"
        "| [ADR-0001](ADR-0001-first.md) | Accepted | Implemented | 2026-08-09 | Architecture | None | Tests | Boundary change |\n",
        encoding="utf-8",
    )

    problems = adr_policy.adr_policy_problems(tmp_path)
    assert "duplicate ADR ID: ADR-0001" in problems
    assert any("unknown ADR reference ADR-9999" in problem for problem in problems)


def test_new_adrs_require_lifecycle_metadata_and_sections(tmp_path: Path) -> None:
    architecture = tmp_path / "docs" / "architecture"
    architecture.mkdir(parents=True)
    (architecture / "ADR-0036-incomplete.md").write_text(
        "# ADR-0036: Incomplete\n\n## Context\n\nMissing controls.\n",
        encoding="utf-8",
    )
    (architecture / "ADR_INDEX.md").write_text(
        "| ID | Decision status | Implementation status | Date | Owners | Relations | Evidence | Revisit trigger |\n"
        "| --- | --- | --- | --- | --- | --- | --- | --- |\n"
        "| [ADR-0036](ADR-0036-incomplete.md) | Proposed | Planned | 2026-08-09 | Architecture | None | Planned | Review |\n",
        encoding="utf-8",
    )

    problems = adr_policy.adr_policy_problems(tmp_path)
    assert "ADR-0036: missing metadata field Status" in problems
    assert "ADR-0036: missing section Rollback" in problems

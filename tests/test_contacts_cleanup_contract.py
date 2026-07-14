from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "scripts" / "uok_contacts_cleanup_evidence.ps1"
OPERATIONS = ROOT / "scripts" / "uok_contacts_cleanup_ops.ps1"
RUNBOOK = ROOT / "docs" / "operations" / "UOK_CONTACTS_CORE_OPERATIONS.md"


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_legacy_candidate_evidence_is_exact_and_read_only() -> None:
    script = _read(EVIDENCE)
    required_evidence = (
        "party.party_type = 'person'",
        "party.status = 'archived'",
        "party.source = 'manual'",
        "party.display_name = 'UOK Contact ' || g.stamp",
        "exclusive.party_id = party.id) = 1",
        "e.payload_json::jsonb @> jsonb_build_object('name', g.name)",
        "'uok-contact-' || g.stamp",
        "'uok-contact-group-add-' || g.stamp",
        "'uok-contact-group-remove-' || g.stamp",
        "'uok-contact-group-readd-' || g.stamp",
        "'uok-cleanup-contact-' || party.id || '-' || g.stamp",
    )
    for evidence in required_evidence:
        assert evidence in script
    assert re.search(r"\b(UPDATE|DELETE|INSERT)\s+(contact_|parties|command_logs|events)", script, re.IGNORECASE) is None


def test_execution_removes_membership_before_archiving_with_all_gates() -> None:
    script = _read(OPERATIONS)
    execution = script[script.index("function Invoke-UokContactsVerifierGroupCleanup") :]
    assert "-ExecuteContactsCleanup and -ConfirmContactsCleanup" in execution
    assert "-BackupPath pointing to an existing reviewed database dump" in execution
    assert "Execution requires a non-empty reviewed database dump" in execution
    removal = execution.index("Invoke-UokContactsVerifierMembershipRemoval")
    empty_readback = execution.index('cleanup_mode -eq "empty"', removal)
    archive = execution.index("Invoke-UokContactsVerifierGroupArchive", empty_readback)
    archived_readback = execution.index('status -eq "archived"', archive)
    assert removal < empty_readback < archive < archived_readback


def test_runbook_documents_v2_legacy_safety_contract() -> None:
    runbook = _read(RUNBOOK)
    assert "reviewed v2 plan" in runbook
    assert "legacy_one_member" in runbook
    assert "never issues mutating SQL" in runbook
    assert "RemoveContactFromGroup" in runbook
    assert "ArchiveContactGroup" in runbook

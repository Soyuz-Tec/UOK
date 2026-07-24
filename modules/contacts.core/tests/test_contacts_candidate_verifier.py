from __future__ import annotations

from pathlib import Path


MODULE_ROOT = Path(__file__).resolve().parents[1]


def test_group_candidate_proves_etag_guarded_recoverable_lifecycle() -> None:
    script = (MODULE_ROOT / "verify" / "UokCandidateContacts.Support.ps1").read_text(encoding="utf-8")

    assert "/api/contacts/groups?include_empty=true&include_archived=true" in script
    assert "$currentGroupResponse | ForEach-Object { $_ }" in script
    assert '$deleteHeaders["If-Match"] = $currentGroup.etag' in script
    assert 'Invoke-UokJson -Method "DELETE" -Path "/api/contacts/groups/$groupId" -Headers $deleteHeaders' in script
    assert '$restoreHeaders["If-Match"] = $archivedGroup.etag' in script
    assert 'Invoke-UokJson -Method "POST" -Path "/api/contacts/groups/$groupId/restore" -Headers $restoreHeaders' in script
    assert '$cleanupHeaders["If-Match"] = $restoredGroup.etag' in script
    assert 'Invoke-UokJson -Method "DELETE" -Path "/api/contacts/groups/$groupId" -Headers $cleanupHeaders' in script

    readme = (MODULE_ROOT / "verify" / "README.md").read_text(encoding="utf-8")
    assert "lifecycle evidence, not data-neutral cleanup" in readme
    assert "verify_uok_candidate_isolated.ps1" in readme

from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def _read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_standard_operations_routes_the_full_lifecycle() -> None:
    operations = _read("scripts/uok_ops.ps1")
    common = _read("scripts/uok_common_ops.ps1")

    for action in (
        "AutoStartInstall",
        "AutoStartStatus",
        "AutoStartVerify",
        "AutoStartDisable",
        "AutoStartEnable",
        "AutoStartUninstall",
    ):
        assert action in operations
    assert "uok_autostart_ops.ps1" in operations
    assert "Get-UokRebuildIdentity" in operations
    assert "Rebuild requires a clean committed worktree." in common
    assert "Assert-UokApiImageIdentity" in operations
    assert "Assert-UokRebuildRecoveryQuiesced" in operations
    assert "Run AutoStartDisable before Rebuild" in common
    image_assertion = operations.index("Assert-UokApiImageIdentity")
    image_sync = operations.index("Sync-UokApiRecoveryImageTag")
    refresh_action = operations.index('"-Action"', image_sync)
    refresh_value = operations.index('"Refresh"', refresh_action)
    assert image_assertion < image_sync < refresh_action < refresh_value
    assert '"docker.io/library/uok-api:latest"' in common
    assert '"{{.Image}}"' in common
    assert '"{{.Id}}"' in common
    assert "org.opencontainers.image.version" in common
    assert "org.opencontainers.image.revision" in common
    assert "ConvertFrom-Json -ErrorAction Stop" in common
    assert "index .Labels" not in common
    assert (
        'arguments += @("-CheckIntervalMinutes", "$CheckIntervalMinutes")' in operations
    )
    assert len(operations.splitlines()) <= 300
    assert len(_read("scripts/uok_autostart_support.ps1").splitlines()) <= 300

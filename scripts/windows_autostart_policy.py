from __future__ import annotations

from pathlib import Path


ACTIONS = (
    "AutoStartInstall",
    "AutoStartStatus",
    "AutoStartVerify",
    "AutoStartDisable",
    "AutoStartEnable",
    "AutoStartUninstall",
)


def _read(root: Path, relative_path: str) -> str:
    return (root / relative_path).read_text(encoding="utf-8", errors="ignore")


def windows_autostart_policy_problems(root: Path) -> list[str]:
    try:
        runbook = _read(root, "docs/operations/UOK_STANDARD_OPERATIONS.md")
        index = _read(root, "docs/DOCUMENTATION_INDEX.md")
        common = _read(root, "scripts/uok_common_ops.ps1")
        operations = _read(root, "scripts/uok_ops.ps1")
        support = _read(root, "scripts/uok_autostart_support.ps1")
        worker = _read(root, "scripts/uok_autostart_worker.ps1")
        compose = _read(root, "deploy/compose-local-18088.yaml")
        override = _read(root, "deploy/compose-autostart.override.yaml")
    except OSError:
        return ["Windows Podman auto-start policy artifacts are unavailable"]
    problems = [
        f"standard operations must implement and document {action}"
        for action in ACTIONS
        if action not in runbook or action not in operations
    ]
    checks = {
        "local Compose services must use unless-stopped restart policies": (
            compose.count("restart: unless-stopped") == 2
        ),
        "local rebuild must bind and verify the committed source identity": (
            "UOK_VERSION: ${UOK_BUILD_VERSION:-development}" in compose
            and "UOK_REVISION: ${UOK_BUILD_REVISION:-unknown}" in compose
            and "Get-UokRebuildIdentity" in operations
            and "Assert-UokApiImageIdentity" in operations
        ),
        "local rebuild must require quiesced managed recovery": (
            "Assert-UokRebuildRecoveryQuiesced" in operations
            and "Run AutoStartDisable before Rebuild" in common
        ),
        "auto-start installation must freeze only exact clean-source images": (
            "Auto-start installation requires a clean committed worktree." in support
            and "API image labels do not match" in support
            and "Live container images do not match" in support
        ),
        "auto-start override must disable pulls and retain restart policies": (
            override.count("pull_policy: never") == 2
            and override.count("restart: unless-stopped") == 2
        ),
        "Windows auto-start must restore without building images": (
            '"--no-build"' in worker
            and '"--no-recreate"' in worker
            and '"--build"' not in worker
        ),
        "Windows auto-start must restart a running unhealthy API": (
            'if ($state -eq "unhealthy") { "restart" }' in worker
            and "Start-UokApiContainer" in worker
        ),
        "Windows auto-start must fail closed on missing or unmounted data volumes": (
            "Assert-UokVolumeReference" in worker
            and worker.count("Assert-UokContainerContract -Config") == 6
            and "ConvertFrom-Json -ErrorAction Stop" in worker
            and '$_.Destination -eq $Destination -and $_.Type -eq "volume"' in worker
            and '-Destination "/var/lib/postgresql"' in worker
            and '-Destination "/data"' in worker
            and "db_volume_fingerprint" in worker
            and "files_volume_fingerprint" in worker
        ),
        "documentation index must route the Windows Podman auto-start runbook": (
            "UOK_WINDOWS_PODMAN_AUTOSTART.md" in index
        ),
    }
    problems.extend(message for message, ok in checks.items() if not ok)
    return problems

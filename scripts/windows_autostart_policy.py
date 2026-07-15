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
        operations = _read(root, "scripts/uok_ops.ps1")
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
        "auto-start override must disable pulls and retain restart policies": (
            override.count("pull_policy: never") == 2
            and override.count("restart: unless-stopped") == 2
        ),
        "Windows auto-start must restore without building images": (
            '"--no-build"' in worker
            and '"--no-recreate"' in worker
            and '"--build"' not in worker
        ),
        "documentation index must route the Windows Podman auto-start runbook": (
            "UOK_WINDOWS_PODMAN_AUTOSTART.md" in index
        ),
    }
    problems.extend(message for message, ok in checks.items() if not ok)
    return problems

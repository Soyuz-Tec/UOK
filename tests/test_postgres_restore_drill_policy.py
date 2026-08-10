from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = (
    ROOT / "scripts" / "verify_postgres_backup_restore.ps1"
).read_text(encoding="utf-8")


def test_restore_drill_is_disposable_immutable_and_fail_closed() -> None:
    assert '"--network", "none"' in SCRIPT
    assert '"--detach"' in SCRIPT
    assert "--publish" not in SCRIPT
    assert '"--exit-on-error"' in SCRIPT
    assert '"--single-transaction"' in SCRIPT
    assert '"--no-owner"' in SCRIPT
    assert '"--no-privileges"' in SCRIPT
    assert "^[0-9a-fA-F]{64}$" in SCRIPT
    assert "@sha256:[0-9a-fA-F]{64}$" in SCRIPT
    assert "finally {" in SCRIPT
    assert "container_absent" in SCRIPT
    assert "volume_absent" in SCRIPT
    assert "podman system prune" not in SCRIPT.lower()


def test_restore_drill_requires_custom_dump_and_records_evidence() -> None:
    assert '"PGDMP"' in SCRIPT
    assert "Get-FileHash" in SCRIPT
    assert "public_table_count" in SCRIPT
    assert "schema_versions" in SCRIPT
    assert "server_version" in SCRIPT
    assert "var\\evidence\\operations" in SCRIPT


def test_resource_absence_probe_fails_closed_for_unexpected_exit_code() -> None:
    shell = shutil.which("pwsh") or shutil.which("powershell")
    if shell is None:
        pytest.skip("PowerShell is required for the restore-helper regression")
    function_source = (
        "function Test-ResourceAbsent {"
        + SCRIPT.split("function Test-ResourceAbsent {", 1)[1].split(
            "\n\n$resolvedBackup",
            1,
        )[0]
    )
    command = f"""
$ErrorActionPreference = "Stop"
function Invoke-PodmanProbe {{
    param([string[]]$Arguments)
    return $script:ProbeExitCode
}}
{function_source}
$script:ProbeExitCode = 0
if (Test-ResourceAbsent -Kind container -Name test-resource) {{
    throw "exit 0 must mean the resource is present"
}}
$script:ProbeExitCode = 1
if (-not (Test-ResourceAbsent -Kind volume -Name test-resource)) {{
    throw "exit 1 must mean the resource is absent"
}}
$script:ProbeExitCode = 125
$failedClosed = $false
try {{
    $null = Test-ResourceAbsent -Kind container -Name test-resource
}} catch {{
    if ($_.Exception.Message -ne "podman container exists returned unexpected exit code 125.") {{
        throw
    }}
    $failedClosed = $true
}}
if (-not $failedClosed) {{
    throw "unexpected probe exits must fail closed"
}}
"""
    result = subprocess.run(
        [shell, "-NoProfile", "-NonInteractive", "-Command", command],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    assert result.returncode == 0, result.stderr or result.stdout

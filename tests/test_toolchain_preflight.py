from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT / "scripts" / "uok_toolchain_preflight.ps1"
VERSIONS = ROOT / "scripts" / "uok_toolchain_versions.ps1"
OPERATIONS = ROOT / "scripts" / "uok_ops.ps1"


def _powershell() -> str:
    shell = shutil.which("pwsh") or shutil.which("powershell")
    if shell is None:
        pytest.skip("PowerShell is unavailable")
    return shell


def test_exact_tool_versions_are_parsed_and_ranges_are_closed(tmp_path: Path) -> None:
    script = tmp_path / "toolchain-parser-test.ps1"
    helper = str(HELPER).replace("'", "''")
    versions = str(VERSIONS).replace("'", "''")
    script.write_text(
        f"""$ErrorActionPreference = "Stop"
. '{versions}'
. '{helper}'
$accepted = @(
    @("Python", "Python 3.14.6", "3.14.6"),
    @("Node.js", "v26.4.0", "26.4.0"),
    @("npm", "11.17.0", "11.17.0")
)
foreach ($item in $accepted) {{
    $version = ConvertTo-UokToolVersion -Tool $item[0] -Output $item[1]
    if ($version.ToString() -ne $item[2]) {{ throw "unexpected parsed version" }}
    if (-not (Test-UokToolVersionSupported -Tool $item[0] -Version $version)) {{
        throw "expected supported version"
    }}
}}
$rejected = @(
    @("Python", "Python 3.13.9"),
    @("Python", "Python 3.15.0"),
    @("Node.js", "v25.9.0"),
    @("Node.js", "v27.0.0"),
    @("npm", "10.9.0"),
    @("npm", "12.0.0")
)
foreach ($item in $rejected) {{
    $version = ConvertTo-UokToolVersion -Tool $item[0] -Output $item[1]
    if (Test-UokToolVersionSupported -Tool $item[0] -Version $version) {{
        throw "expected unsupported version"
    }}
}}
foreach ($invalid in @("Python 3.14", "v26.4.0 extra", "11.17.0`nwarning")) {{
    $failed = $false
    try {{ ConvertTo-UokToolVersion -Tool "npm" -Output $invalid | Out-Null }}
    catch {{ $failed = $true }}
    if (-not $failed) {{ throw "malformed output was accepted" }}
}}
""",
        encoding="utf-8",
    )
    result = subprocess.run(
        [_powershell(), "-NoProfile", "-File", str(script)],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_preflight_prefers_repo_and_user_installs_without_downloading() -> None:
    helper = HELPER.read_text(encoding="utf-8")
    versions = VERSIONS.read_text(encoding="utf-8")

    assert '".venv\\Scripts"' in helper
    assert '".venv/bin"' in helper
    assert '-3.14 -c "import sys; print(sys.executable)"' in helper
    assert 'GetEnvironmentVariable("Path", "User")' in helper
    assert 'GetEnvironmentVariable("Path", "Machine")' in helper
    assert "Add-UokPathPrefixes" in helper
    assert "No toolchain software was downloaded or installed." in helper
    for forbidden in (
        "Invoke-WebRequest",
        "winget ",
        "choco ",
        "scoop ",
        "apt ",
        "brew ",
    ):
        assert forbidden not in helper + versions


def test_standard_proof_and_build_actions_are_fail_fast() -> None:
    operations = OPERATIONS.read_text(encoding="utf-8")
    preflight = operations.index("if (Test-UokActionRequiresTargetToolchain")
    dispatch = operations.index("switch ($Action)", preflight)

    assert preflight < dispatch
    assert '"ToolchainPreflight"' in operations
    helper = HELPER.read_text(encoding="utf-8")
    for action in (
        "Audit",
        "TechnologyAudit",
        "EngineeringEvidence",
        "UiProof",
        "Verify",
        "Rebuild",
        "PlanningReleaseReadiness",
        "AsuhTest",
    ):
        assert f'"{action}"' in helper
    for runtime_only in (
        "Health",
        "DatabaseCapacity",
        "BackupDb",
        "RestoreDb",
        "AutoStartStatus",
        "AutoStartVerify",
    ):
        assert f'"{runtime_only}"' not in helper
    assert len(operations.splitlines()) <= 300
    assert len(HELPER.read_text(encoding="utf-8").splitlines()) <= 300
    assert len(VERSIONS.read_text(encoding="utf-8").splitlines()) <= 300

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]


def _shell() -> str:
    shell = shutil.which("pwsh") or shutil.which("powershell")
    if shell is None:
        pytest.skip("PowerShell is unavailable")
    return shell


def _fake(directory: Path, name: str, output: str) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    if os.name == "nt":
        path = directory / f"{name}.cmd"
        path.write_text(f"@echo off\r\necho {output}\r\n", encoding="utf-8")
    else:
        path = directory / name
        path.write_text(f"#!/bin/sh\nprintf '%s\\n' '{output}'\n", encoding="utf-8")
        path.chmod(0o755)
    return path


def _run(
    root: Path, python: Path, node: Path, old: Path
) -> subprocess.CompletedProcess[str]:
    root.mkdir(parents=True)
    versions = str(ROOT / "scripts" / "uok_toolchain_versions.ps1").replace("'", "''")
    preflight = str(ROOT / "scripts" / "uok_toolchain_preflight.ps1").replace("'", "''")
    script = root / "run.ps1"
    script.write_text(
        f"""$ErrorActionPreference = "Stop"
. '{versions}'
. '{preflight}'
$env:PATH = '{str(old).replace("'", "''")}' + [IO.Path]::PathSeparator + $env:PATH
function Find-UokTargetPython {{ param([string]$RepoRoot); Get-UokToolCandidate -Tool "Python" -Path '{str(python).replace("'", "''")}' }}
function Find-UokTargetNode {{ Get-UokToolCandidate -Tool "Node.js" -Path '{str(node).replace("'", "''")}' }}
Assert-UokTargetToolchain -RepoRoot '{str(root).replace("'", "''")}' -Force
""",
        encoding="utf-8",
    )
    return subprocess.run(
        [_shell(), "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(script)],
        capture_output=True,
        text=True,
        check=False,
    )


def test_npm_must_be_paired_with_selected_node(tmp_path: Path) -> None:
    target = tmp_path / "target"
    old = tmp_path / "old"
    python = _fake(target, "python", "Python 3.14.6")
    node = _fake(target, "node", "v26.4.0")
    _fake(old, "node", "v24.16.0")
    _fake(old, "npm", "11.17.0")

    rejected = _run(tmp_path / "missing", python, node, old)
    assert rejected.returncode != 0
    assert "selected Node.js installation" in rejected.stdout + rejected.stderr

    _fake(target, "npm", "11.17.0")
    accepted = _run(tmp_path / "paired", python, node, old)
    assert accepted.returncode == 0, accepted.stdout + accepted.stderr
    assert str(target) in accepted.stdout


def test_real_wrapper_runs_under_pwsh_when_target_tools_are_available() -> None:
    pwsh = shutil.which("pwsh")
    if pwsh is None:
        pytest.skip("PowerShell 7 is unavailable")
    result = subprocess.run(
        [
            pwsh,
            "-NoProfile",
            "-File",
            str(ROOT / "scripts" / "uok_ops.ps1"),
            "-Action",
            "ToolchainPreflight",
        ],
        capture_output=True,
        text=True,
        check=False,
        cwd=ROOT,
    )
    output = result.stdout + result.stderr
    if result.returncode != 0 and "was not found" in output:
        pytest.skip("the target local toolchain is unavailable")
    assert result.returncode == 0, output
    assert "UOK target toolchain preflight passed." in output
    assert "Cannot overwrite variable IsWindows" not in output

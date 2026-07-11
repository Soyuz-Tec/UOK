from __future__ import annotations

import json
import os
import re
import shutil
import stat
import subprocess
import unicodedata
from dataclasses import dataclass
from pathlib import Path, PurePosixPath


POWERSHELL_AST_COMMAND = r"""
$path = [Environment]::GetEnvironmentVariable("UOK_VERIFIER_SCRIPT")
$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
    $path,
    [ref]$tokens,
    [ref]$parseErrors
)
if (@($parseErrors).Count -gt 0) {
    $details = @($parseErrors | ForEach-Object { $_.Message }) -join " | "
    [Console]::Error.WriteLine($details)
    exit 2
}
$functions = @(
    $ast.FindAll(
        { param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] },
        $true
    ) |
        Where-Object {
            $_.Parent -is [System.Management.Automation.Language.NamedBlockAst] -and
            $_.Parent.Parent -eq $ast -and
            -not $_.IsFilter -and
            -not $_.IsWorkflow
        } |
        ForEach-Object { $_.Name }
)
$dotSources = @(
    $ast.FindAll(
        {
            param($node)
            $node -is [System.Management.Automation.Language.CommandAst] -and
            $node.InvocationOperator -eq [System.Management.Automation.Language.TokenKind]::Dot
        },
        $true
    ) |
        ForEach-Object { $_.Extent.Text }
)
[Console]::Out.WriteLine((ConvertTo-Json -InputObject ([ordered]@{
    functions = $functions
    dot_sources = $dotSources
}) -Compress -Depth 4))
"""

_STATIC_JOIN_PATH = re.compile(
    r"^\.[ \t]+\(Join-Path[ \t]+\$PSScriptRoot[ \t]+"
    r"(?:\"(?P<double>[A-Za-z0-9._/\-]+)\"|'(?P<single>[A-Za-z0-9._/\-]+)')\)$",
    re.IGNORECASE,
)
_STATIC_EXPANDED_PATH = re.compile(
    r'^\.[ \t]+"(?:\$\{PSScriptRoot\}|\$PSScriptRoot)/'
    r'(?P<expanded>[A-Za-z0-9._/\-]+)"$',
    re.IGNORECASE,
)


class CandidateVerifierPreflightError(ValueError):
    """Raised when a verifier script closure cannot be proven safe before loading."""


@dataclass(frozen=True)
class PowerShellScriptInspection:
    functions: tuple[str, ...]
    dot_sources: tuple[str, ...]


def preflight_powershell_closure(
    workspace: Path,
    module_name: str,
    entry_script: Path,
    parsed_scripts: dict[Path, PowerShellScriptInspection],
) -> tuple[tuple[Path, PowerShellScriptInspection], ...]:
    owner_root = _lexical_path(workspace / "modules" / module_name / "verify")
    shared_root = _lexical_path(workspace / "scripts" / "verify")
    closure: list[tuple[Path, PowerShellScriptInspection]] = []
    visited: set[Path] = set()
    visiting: list[Path] = []

    def visit(script: Path) -> None:
        resolved = script.resolve()
        if resolved in visiting:
            cycle = " -> ".join(path.name for path in (*visiting, resolved))
            raise CandidateVerifierPreflightError(
                f"{module_name} candidate verifier dot-source cycle: {cycle}"
            )
        if resolved in visited:
            return
        inspection = parsed_scripts.get(resolved)
        if inspection is None:
            inspection = inspect_powershell_script(resolved, module_name)
            parsed_scripts[resolved] = inspection
        visiting.append(resolved)
        closure.append((resolved, inspection))
        for expression in inspection.dot_sources:
            helper = _resolve_dot_source(
                workspace,
                module_name,
                resolved,
                expression,
                owner_root,
                shared_root,
            )
            visit(helper)
        visiting.pop()
        visited.add(resolved)

    visit(entry_script)
    return tuple(closure)


def inspect_powershell_script(
    script_path: Path,
    module_name: str,
) -> PowerShellScriptInspection:
    executable = shutil.which("pwsh") or shutil.which("powershell")
    if executable is None:
        raise CandidateVerifierPreflightError(
            "PowerShell is required to validate candidate verifier syntax before loading scripts"
        )
    environment = os.environ.copy()
    environment["UOK_VERIFIER_SCRIPT"] = str(script_path)
    try:
        result = subprocess.run(
            [executable, "-NoLogo", "-NoProfile", "-NonInteractive", "-Command", POWERSHELL_AST_COMMAND],
            capture_output=True,
            check=False,
            env=environment,
            text=True,
            timeout=30,
        )
    except (OSError, subprocess.TimeoutExpired, UnicodeError) as error:
        raise CandidateVerifierPreflightError(
            f"{module_name} candidate verifier PowerShell preflight failed: {error}"
        ) from error
    if result.returncode != 0:
        details = (result.stderr or result.stdout).strip() or f"exit {result.returncode}"
        raise CandidateVerifierPreflightError(
            f"{module_name} candidate verifier PowerShell syntax is invalid in "
            f"{script_path.name}: {details}"
        )
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise CandidateVerifierPreflightError(
            f"{module_name} candidate verifier PowerShell preflight returned invalid output"
        ) from error
    if not isinstance(payload, dict):
        raise CandidateVerifierPreflightError(
            f"{module_name} candidate verifier PowerShell preflight returned invalid inspection"
        )
    functions = payload.get("functions")
    dot_sources = payload.get("dot_sources")
    if (
        not isinstance(functions, list)
        or not all(isinstance(name, str) for name in functions)
        or not isinstance(dot_sources, list)
        or not all(isinstance(expression, str) for expression in dot_sources)
    ):
        raise CandidateVerifierPreflightError(
            f"{module_name} candidate verifier PowerShell preflight returned invalid inspection"
        )
    return PowerShellScriptInspection(tuple(functions), tuple(dot_sources))


def powershell_functions(script_path: Path, module_name: str) -> tuple[str, ...]:
    inspection = inspect_powershell_script(script_path, module_name)
    return tuple(collision_key(name) for name in inspection.functions)


def collision_key(value: str) -> str:
    return unicodedata.normalize("NFKC", value).casefold()


def is_link_or_junction(path: Path) -> bool:
    if path.is_symlink():
        return True
    is_junction = getattr(path, "is_junction", None)
    if callable(is_junction) and is_junction():
        return True
    if os.name != "nt":
        return False
    try:
        reparse_tag = getattr(path.lstat(), "st_reparse_tag", 0)
    except OSError:
        return False
    return reparse_tag == getattr(stat, "IO_REPARSE_TAG_MOUNT_POINT", -1)


def _resolve_dot_source(
    workspace: Path,
    module_name: str,
    source_script: Path,
    expression: str,
    owner_root: Path,
    shared_root: Path,
) -> Path:
    relative = _static_dot_source_path(expression, module_name, source_script)
    unresolved = source_script.parent.joinpath(*relative.parts)
    target = _lexical_path(unresolved)
    allowed_root = next(
        (root for root in (owner_root, shared_root) if _is_relative_to(target, root)),
        None,
    )
    if allowed_root is None:
        raise CandidateVerifierPreflightError(
            f"{module_name} candidate verifier dot-source resolves outside approved verifier roots: "
            f"{expression}"
        )
    _reject_linked_path(workspace, allowed_root, target, module_name)
    resolved_root = allowed_root.resolve()
    resolved_target = target.resolve()
    if not _is_relative_to(resolved_target, resolved_root):
        raise CandidateVerifierPreflightError(
            f"{module_name} candidate verifier dot-source escapes its approved verifier root"
        )
    if resolved_target.suffix.casefold() != ".ps1" or not resolved_target.is_file():
        raise CandidateVerifierPreflightError(
            f"{module_name} candidate verifier dot-source does not resolve to a PowerShell file: "
            f"{expression}"
        )
    return resolved_target


def _static_dot_source_path(
    expression: str,
    module_name: str,
    source_script: Path,
) -> PurePosixPath:
    match = _STATIC_JOIN_PATH.fullmatch(expression.strip())
    raw_path = None if match is None else match.group("double") or match.group("single")
    if raw_path is None:
        match = _STATIC_EXPANDED_PATH.fullmatch(expression.strip())
        raw_path = None if match is None else match.group("expanded")
    if raw_path is None:
        raise CandidateVerifierPreflightError(
            f"{module_name} candidate verifier uses dynamic or unsupported dot-source in "
            f"{source_script.name}: {expression}"
        )
    relative = PurePosixPath(raw_path)
    if relative.is_absolute() or relative.as_posix() != raw_path or not relative.parts:
        raise CandidateVerifierPreflightError(
            f"{module_name} candidate verifier dot-source path is not canonical: {expression}"
        )
    return relative


def _reject_linked_path(
    workspace: Path,
    allowed_root: Path,
    target: Path,
    module_name: str,
) -> None:
    workspace_root = _lexical_path(workspace)
    for boundary in _path_components(workspace_root, allowed_root):
        if is_link_or_junction(boundary):
            raise CandidateVerifierPreflightError(
                f"{module_name} candidate verifier approved root cannot be a link or junction"
            )
    for candidate in _path_components(allowed_root, target):
        if is_link_or_junction(candidate):
            raise CandidateVerifierPreflightError(
                f"{module_name} candidate verifier dot-source path cannot be a link or junction"
            )


def _path_components(root: Path, target: Path) -> tuple[Path, ...]:
    relative = target.relative_to(root)
    current = root
    paths: list[Path] = []
    for part in relative.parts:
        current /= part
        paths.append(current)
    return tuple(paths)


def _lexical_path(path: Path) -> Path:
    return Path(os.path.abspath(path))


def _is_relative_to(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
    except ValueError:
        return False
    return True

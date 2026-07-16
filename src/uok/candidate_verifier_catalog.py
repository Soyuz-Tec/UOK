from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

from .candidate_verifier_preflight import (
    CandidateVerifierPreflightError,
    PowerShellScriptInspection,
    collision_key as _collision_key,
    is_link_or_junction as _is_link_or_junction,
    powershell_functions,
    preflight_powershell_closure,
)
from .module_manifest_loader import load_module_manifests
from .module_order import ModuleOrderError, dependency_order
from .module_release_contract import validate_module_release_contracts
from .host.module_paths import modules_root


POWERSHELL_FUNCTION_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z][A-Za-z0-9]*)*$")


class CandidateVerifierCatalogError(ValueError):
    """Raised when release verifier discovery is unsafe or ambiguous."""


@dataclass(frozen=True)
class CandidateVerifier:
    name: str
    script: str
    function: str

    def as_dict(self) -> dict[str, str]:
        return {"name": self.name, "script": self.script, "function": self.function}


def candidate_verifier_catalog(module_root: Path | None = None) -> list[dict[str, str]]:
    requested_root = module_root or modules_root()
    if _is_link_or_junction(requested_root):
        raise CandidateVerifierCatalogError(
            "module catalog root cannot be a link or junction"
        )
    root = requested_root.resolve()
    release_contract = validate_module_release_contracts(root)
    if not release_contract["ok"]:
        reasons = "; ".join(
            (
                f"{violation.get('module', 'catalog')}:{violation.get('field', 'contract')}: "
                f"{violation.get('reason', violation)}"
            )
            for violation in release_contract.get("violations", [])
        )
        raise CandidateVerifierCatalogError(f"module release contract is invalid: {reasons}")
    manifests = load_module_manifests(root)
    try:
        ordered_names = dependency_order(manifests)
    except ModuleOrderError as error:
        raise CandidateVerifierCatalogError(str(error)) from error
    workspace = root.parent
    entries: list[CandidateVerifier] = []
    function_owners: dict[str, str] = {}
    script_owners: dict[str, str] = {}
    parsed_scripts: dict[Path, PowerShellScriptInspection] = {}

    for module_name in ordered_names:
        manifest = manifests[module_name]
        raw_script = manifest.get("candidate_verifier_script")
        raw_function = manifest.get("candidate_verifier_function")
        if raw_script is None and raw_function is None:
            continue
        if not isinstance(raw_script, str) or not raw_script.strip():
            raise CandidateVerifierCatalogError(f"{module_name} candidate_verifier_script is required")
        if not isinstance(raw_function, str) or not POWERSHELL_FUNCTION_PATTERN.fullmatch(raw_function):
            raise CandidateVerifierCatalogError(f"{module_name} candidate_verifier_function is invalid")
        if "candidate_verifier" not in manifest.get("extension_points", []):
            raise CandidateVerifierCatalogError(f"{module_name} must declare the candidate_verifier extension point")

        safe_script = _safe_verifier_script(workspace, module_name, raw_script)
        script_path = workspace / Path(*PurePosixPath(safe_script).parts)
        function_key = _collision_key(raw_function)
        try:
            closure = preflight_powershell_closure(
                workspace,
                module_name,
                script_path,
                parsed_scripts,
            )
        except CandidateVerifierPreflightError as error:
            raise CandidateVerifierCatalogError(str(error)) from error
        entry_functions = closure[0][1].functions
        entry_count = sum(
            _collision_key(name) == function_key for name in entry_functions
        )
        closure_count = sum(
            _collision_key(name) == function_key
            for _, inspection in closure
            for name in inspection.functions
        )
        if entry_count == 0:
            raise CandidateVerifierCatalogError(
                f"{module_name} candidate verifier script does not define {raw_function}"
            )
        if closure_count != 1:
            raise CandidateVerifierCatalogError(
                f"{module_name} candidate verifier closure defines {raw_function} "
                f"{closure_count} times; exactly one top-level function is required"
            )
        if function_key in function_owners:
            raise CandidateVerifierCatalogError(
                f"candidate verifier function {raw_function} is shared by "
                f"{function_owners[function_key]} and {module_name}"
            )
        script_key = _collision_key(safe_script)
        if script_key in script_owners:
            raise CandidateVerifierCatalogError(
                f"candidate verifier script {safe_script} is shared by "
                f"{script_owners[script_key]} and {module_name}"
            )
        function_owners[function_key] = module_name
        script_owners[script_key] = module_name
        entries.append(CandidateVerifier(module_name, safe_script, raw_function))
    return [entry.as_dict() for entry in entries]


def _safe_verifier_script(workspace: Path, module_name: str, raw_script: str) -> str:
    if "\\" in raw_script:
        raise CandidateVerifierCatalogError(f"{module_name} candidate verifier path must use forward slashes")
    relative = PurePosixPath(raw_script)
    canonical = relative.as_posix()
    if relative.is_absolute() or ".." in relative.parts or canonical != raw_script:
        raise CandidateVerifierCatalogError(f"{module_name} candidate verifier path is not canonical")
    if relative.parts[:3] != ("modules", module_name, "verify") or len(relative.parts) < 4:
        raise CandidateVerifierCatalogError(
            f"{module_name} candidate verifier must stay under modules/{module_name}/verify"
        )
    if relative.suffix.casefold() != ".ps1":
        raise CandidateVerifierCatalogError(f"{module_name} candidate verifier must be a PowerShell script")

    module_dir = workspace / "modules" / module_name
    expected_root_path = module_dir / "verify"
    unresolved_script = workspace / Path(*relative.parts)
    for candidate in (module_dir, expected_root_path, *unresolved_script.parents):
        if candidate == workspace:
            break
        if _is_link_or_junction(candidate):
            raise CandidateVerifierCatalogError(
                f"{module_name} candidate verifier ownership path cannot be a link or junction"
            )
    if _is_link_or_junction(unresolved_script):
        raise CandidateVerifierCatalogError(
            f"{module_name} candidate verifier script cannot be a link or junction"
        )

    expected_root = expected_root_path.resolve()
    script_path = unresolved_script.resolve()
    try:
        script_path.relative_to(expected_root)
    except ValueError as error:
        raise CandidateVerifierCatalogError(
            f"{module_name} candidate verifier resolves outside its module verify directory"
        ) from error
    if not script_path.is_file():
        raise CandidateVerifierCatalogError(f"{module_name} candidate verifier script does not exist: {canonical}")
    return canonical


def _powershell_functions(script_path: Path, module_name: str) -> tuple[str, ...]:
    try:
        return powershell_functions(script_path, module_name)
    except CandidateVerifierPreflightError as error:
        raise CandidateVerifierCatalogError(str(error)) from error

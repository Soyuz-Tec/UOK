from __future__ import annotations

import os
import subprocess
import sys
import types
from importlib.machinery import ModuleSpec
from pathlib import Path

import pytest

from tests.module_manifest_contract_support import write_module
import uok.module_contract_validation as module_contract_validation
import uok.host.module_paths as module_paths
from uok.host.module_imports import resolve_module_import
from uok.module_manifest_loader import load_module_manifests
from uok.host.module_paths import ensure_module_backend_paths, module_backend_paths, repo_root


def test_runtime_contract_completes_before_extension_packages_import() -> None:
    script = r"""
import importlib.abc
import sys

import uok.module_contract_validation as contracts

validation_complete = False
real_validate = contracts.validate_module_runtime_contracts


def validate_then_mark_complete(*args, **kwargs):
    global validation_complete
    report = real_validate(*args, **kwargs)
    validation_complete = True
    return report


class RejectEarlyExtensionImport(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if fullname.startswith("uok_") and not validation_complete:
            raise RuntimeError(f"extension package imported before validation completed: {fullname}")
        return None


contracts.validate_module_runtime_contracts = validate_then_mark_complete
sys.meta_path.insert(0, RejectEarlyExtensionImport())

from uok.host.application import app

assert validation_complete
assert app.title == "UOK"
"""
    environment = os.environ.copy()
    source_root = str(repo_root() / "src")
    environment["PYTHONPATH"] = os.pathsep.join(
        filter(None, (source_root, environment.get("PYTHONPATH")))
    )

    result = subprocess.run(
        [sys.executable, "-c", script],
        cwd=repo_root(),
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr or result.stdout


def test_backend_import_path_uses_validated_manifest_backend_path(
    tmp_path: Path, monkeypatch,
) -> None:
    root = tmp_path / "modules"
    write_module(root, "apps.manager", required=True)
    write_module(root, "declared.core")
    manifest = root / "declared.core" / "manifest.yaml"
    manifest.write_text(
        manifest.read_text(encoding="utf-8").replace(
            "modules/declared.core/backend",
            "modules/declared.core/python",
        ),
        encoding="utf-8",
    )
    declared_backend = root / "declared.core" / "python"
    declared_backend.mkdir()
    undeclared_backend = root / "undeclared.core" / "backend"
    undeclared_backend.mkdir(parents=True)
    original_path = list(sys.path)
    monkeypatch.setattr(sys, "path", original_path.copy())
    apps_backend = root / "apps.manager" / "backend"

    assert module_backend_paths(root) == [apps_backend, declared_backend]

    ensure_module_backend_paths(root)

    assert sys.path == [str(apps_backend), str(declared_backend), *original_path]
    assert str(undeclared_backend) not in sys.path


def test_malformed_manifest_shadow_cannot_mutate_import_path(
    tmp_path: Path,
    monkeypatch,
) -> None:
    root = tmp_path / "modules"
    write_module(root, "valid.core")
    shadow_backend = root / "aaa.shadow" / "backend"
    (shadow_backend / "uok_contacts_core").mkdir(parents=True)
    (shadow_backend / "uok_contacts_core" / "__init__.py").write_text(
        "SHADOWED = True\n",
        encoding="utf-8",
    )
    (root / "aaa.shadow" / "manifest.yaml").write_text(
        "name: aaa.shadow\nbackend_path: modules/aaa.shadow/backend\n",
        encoding="utf-8",
    )
    original_path = list(sys.path)
    monkeypatch.setattr(sys, "path", original_path.copy())

    with pytest.raises(ValueError, match="missing required fields"):
        ensure_module_backend_paths(root)

    assert sys.path == original_path
    assert str(shadow_backend) not in sys.path


@pytest.mark.parametrize("linked_part", ["root", "module", "backend", "package"])
def test_backend_import_paths_reject_links_before_resolution(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    linked_part: str,
) -> None:
    root = tmp_path / "modules"
    write_module(root, "apps.manager", required=True)
    write_module(root, "alpha.core", package="alpha_backend")
    linked_paths = {
        "root": root,
        "module": root / "alpha.core",
        "backend": root / "alpha.core" / "backend",
        "package": root / "alpha.core" / "backend" / "alpha_backend",
    }
    linked = linked_paths[linked_part]
    validation_called = False

    def record_validation(*_args, **_kwargs):
        nonlocal validation_called
        validation_called = True
        raise AssertionError("runtime validation must not inspect linked module source")

    monkeypatch.setattr(
        module_paths,
        "_is_link_or_junction",
        lambda path: path == linked,
    )
    monkeypatch.setattr(
        module_contract_validation,
        "validate_module_runtime_contracts",
        record_validation,
    )
    original_path = list(sys.path)
    monkeypatch.setattr(sys, "path", original_path.copy())

    with pytest.raises(ValueError, match="link or junction"):
        ensure_module_backend_paths(root)

    assert validation_called is False
    assert sys.path == original_path


def test_backend_package_collision_fails_before_sys_path_mutation(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = tmp_path / "modules"
    write_module(root, "apps.manager", required=True)
    write_module(root, "alpha.core", package="shared_backend")
    write_module(root, "beta.core", package="shared_backend")
    original_path = list(sys.path)
    monkeypatch.setattr(sys, "path", original_path.copy())

    with pytest.raises(ValueError, match="shared_backend"):
        ensure_module_backend_paths(root)

    assert sys.path == original_path


@pytest.mark.parametrize("origin_kind", ["missing", "external", "external_sibling"])
def test_cached_provider_origin_must_belong_to_manifest_backend(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    origin_kind: str,
) -> None:
    manifest = load_module_manifests()["contacts.core"]
    target = str(manifest["api_router"]).partition(":")[0]
    cached_name = (
        target.split(".", 1)[0] + ".cached_provider"
        if origin_kind == "external_sibling"
        else target
    )
    fake = types.ModuleType(cached_name)
    fake.router = object()
    if origin_kind != "missing":
        external = tmp_path / "api.py"
        external.write_text("router = object()\n", encoding="utf-8")
        fake.__file__ = str(external)
        fake.__spec__ = ModuleSpec(cached_name, loader=None, origin=str(external))
    monkeypatch.setitem(sys.modules, cached_name, fake)

    with pytest.raises(ValueError, match="origin|outside its backend"):
        resolve_module_import("contacts.core", manifest, "api_router")


def test_provider_import_must_use_owning_validated_manifest() -> None:
    manifests = load_module_manifests()
    forged = dict(manifests["contacts.core"])
    forged["backend_path"] = manifests["apps.manager"]["backend_path"]
    forged["api_router"] = manifests["apps.manager"]["api_router"]

    with pytest.raises(ValueError, match="validated module manifest"):
        resolve_module_import("contacts.core", forged, "api_router")

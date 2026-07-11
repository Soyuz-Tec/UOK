from __future__ import annotations

from pathlib import Path

import pytest

from tests.module_manifest_contract_support import write_module
from uok.module_contract_validation import validate_module_runtime_contracts


def _replace_api_prefix(module_root: Path, module_name: str, prefix: str) -> None:
    path = module_root / module_name / "manifest.yaml"
    path.write_text(
        path.read_text(encoding="utf-8").replace(f"/api/{module_name}", prefix),
        encoding="utf-8",
    )


@pytest.mark.parametrize(
    "prefix",
    [
        "/internal/alpha.core",
        "/api/alpha.core/./items",
        "/api/alpha.core/../items",
        "/api/alpha.core//items",
        "/api/alpha.core/",
        "/api/alpha.core?mode=unsafe",
        '"/api/alpha.core#fragment"',
        r"/api\alpha.core",
        "/api/%61lpha.core",
        "/API/alpha.core",
        "/api/alpha.core.",
    ],
)
def test_runtime_contract_rejects_noncanonical_api_prefix(
    tmp_path: Path,
    prefix: str,
) -> None:
    module_root = tmp_path / "modules"
    write_module(module_root, "apps.manager", required=True)
    write_module(module_root, "alpha.core", package="alpha_backend")
    _replace_api_prefix(module_root, "alpha.core", prefix)

    report = validate_module_runtime_contracts(module_root)

    assert report["checks"]["api_routers_valid"] is False
    assert any(
        row["field"] == "api_prefixes"
        and "canonical safe paths under /api" in row["reason"]
        for row in report["violations"]
    )


@pytest.mark.parametrize(
    ("alpha_prefix", "beta_prefix"),
    [
        ("/api/shared", "/api/shared"),
        ("/api/shared", "/api/shared/nested"),
        ("/api/shared/nested", "/api/shared"),
    ],
)
def test_runtime_contract_rejects_cross_module_api_prefix_collisions(
    tmp_path: Path,
    alpha_prefix: str,
    beta_prefix: str,
) -> None:
    module_root = tmp_path / "modules"
    write_module(module_root, "apps.manager", required=True)
    write_module(module_root, "alpha.core", package="alpha_backend")
    write_module(module_root, "beta.core", package="beta_backend")
    _replace_api_prefix(module_root, "alpha.core", alpha_prefix)
    _replace_api_prefix(module_root, "beta.core", beta_prefix)

    report = validate_module_runtime_contracts(module_root)

    assert report["checks"]["api_routers_valid"] is False
    assert any(
        row["module"] == "beta.core"
        and row["field"] == "api_prefixes"
        and "owned by alpha.core" in row["reason"]
        for row in report["violations"]
    )


def test_api_prefix_ownership_uses_segment_boundaries(tmp_path: Path) -> None:
    module_root = tmp_path / "modules"
    write_module(module_root, "apps.manager", required=True)
    write_module(module_root, "alpha.core", package="alpha_backend")
    write_module(module_root, "beta.core", package="beta_backend")
    _replace_api_prefix(module_root, "alpha.core", "/api/shared")
    _replace_api_prefix(module_root, "beta.core", "/api/shared-tools")

    report = validate_module_runtime_contracts(module_root)

    assert report["ok"] is True, report["violations"]


@pytest.mark.parametrize(
    "prefix",
    [
        "/api/auth",
        "/api/auth/provider",
        "/api/commands",
        "/api/architecture/source",
    ],
)
def test_runtime_contract_rejects_kernel_owned_api_namespaces(
    tmp_path: Path,
    prefix: str,
) -> None:
    module_root = tmp_path / "modules"
    write_module(module_root, "apps.manager", required=True)
    write_module(module_root, "alpha.core", package="alpha_backend")
    _replace_api_prefix(module_root, "alpha.core", prefix)

    report = validate_module_runtime_contracts(module_root)

    assert report["checks"]["api_routers_valid"] is False
    assert any(
        row["module"] == "alpha.core"
        and row["field"] == "api_prefixes"
        and "kernel-owned prefix" in row["reason"]
        for row in report["violations"]
    )

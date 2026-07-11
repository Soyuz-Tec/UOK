from __future__ import annotations

from pathlib import Path

import pytest

from tests.module_manifest_contract_support import write_module
from uok.module_contract_validation import validate_module_runtime_contracts
from uok.module_model_claims import KERNEL_MODEL_NAMES


def _add_claim(module_root: Path, claim: str) -> None:
    manifest_path = module_root / "alpha.core" / "manifest.yaml"
    manifest_path.write_text(
        manifest_path.read_text(encoding="utf-8").replace(
            "owned_tables: []",
            f"owned_tables:\n  - {claim}",
        ),
        encoding="utf-8",
    )


@pytest.mark.parametrize("kernel_model", sorted(KERNEL_MODEL_NAMES))
def test_static_contract_rejects_direct_module_claims_for_kernel_models(
    tmp_path: Path,
    kernel_model: str,
) -> None:
    module_root = tmp_path / "modules"
    write_module(module_root, "apps.manager", required=True)
    write_module(module_root, "alpha.core")
    _add_claim(module_root, kernel_model)

    report = validate_module_runtime_contracts(module_root)

    assert report["ok"] is False
    assert report["checks"]["owned_table_claims_valid"] is False
    assert any(
        row["field"] == "owned_tables" and kernel_model in row["reason"]
        for row in report["violations"]
    )


@pytest.mark.parametrize(
    ("claim", "reason"),
    [
        ("ModuleRecord:apps.manager", "may only be scoped to apps.manager"),
        ("CommandLog:other.core", "scope must equal declaring module alpha.core"),
    ],
)
def test_static_contract_binds_kernel_scopes_to_the_declaring_module(
    tmp_path: Path,
    claim: str,
    reason: str,
) -> None:
    module_root = tmp_path / "modules"
    write_module(module_root, "apps.manager", required=True)
    write_module(module_root, "alpha.core")
    _add_claim(module_root, claim)

    report = validate_module_runtime_contracts(module_root)

    assert report["ok"] is False
    assert any(reason in row["reason"] for row in report["violations"])

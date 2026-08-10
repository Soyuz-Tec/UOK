from __future__ import annotations

import inspect
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine

from tests.model_metadata_contract import normalized_model_metadata
from uok.host.model_registry import (
    ensure_module_models_registered,
    module_model_provider_order,
    module_model_registry_report,
)
from uok.host.module_imports import resolve_module_import
from uok.host.module_paths import repo_root
from uok.kernel.persistence import Base
from uok.kernel_models import KERNEL_MODELS
from uok.module_manifest_loader import load_module_manifests


FIXTURE = Path(__file__).parent / "fixtures" / "module_model_registry.json"
METADATA_FIXTURE = Path(__file__).parent / "fixtures" / "module_model_metadata.json"
EXPECTED_PROVIDER_ORDER = (
    "agents.core",
    "calendar.core",
    "communications.core",
    "compliance.core",
    "contacts.core",
    "locations.core",
    "planning.core",
    "product.master",
    "reports.core",
    "routes.core",
    "shipments.core",
)
EXPECTED_MODEL_COUNT = 68


def _expected_registry() -> dict[str, dict[str, str]]:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def test_registry_matches_checked_in_metadata_contract() -> None:
    expected = _expected_registry()
    report = module_model_registry_report()
    actual = {"kernel": {
        name: model.__table__.name for name, model in sorted(KERNEL_MODELS.items())
    }}
    actual.update(report["module_models"])

    assert actual == expected
    assert report["model_count"] == EXPECTED_MODEL_COUNT
    assert report["table_count"] == EXPECTED_MODEL_COUNT
    assert tuple(report["provider_order"]) == EXPECTED_PROVIDER_ORDER
    assert len(Base.registry.mappers) == EXPECTED_MODEL_COUNT
    assert len(Base.metadata.tables) == EXPECTED_MODEL_COUNT


def test_full_sqlalchemy_metadata_matches_pre_move_contract() -> None:
    expected = json.loads(METADATA_FIXTURE.read_text(encoding="utf-8"))
    actual = normalized_model_metadata(ensure_module_models_registered())

    assert actual == expected


def test_registry_is_idempotent_and_uses_one_base_metadata() -> None:
    first = ensure_module_models_registered()
    first_ids = {name: id(model) for name, model in first.items()}
    second = ensure_module_models_registered()

    assert {name: id(model) for name, model in second.items()} == first_ids
    assert module_model_provider_order() == EXPECTED_PROVIDER_ORDER
    assert all(model.__table__.metadata is Base.metadata for model in second.values())
    assert all(model.registry is Base.registry for model in second.values())


def test_manifest_model_providers_preserve_exact_class_identity() -> None:
    from uok_calendar_core import models as calendar_owner
    from uok_communications_core import models as communications_owner

    manifests = load_module_manifests()
    registered = ensure_module_models_registered()
    for module_name in EXPECTED_PROVIDER_ORDER:
        manifest = manifests[module_name]
        provider = resolve_module_import(module_name, manifest, "model_exports")
        for name, model in provider().items():
            assert registered[name] is model

    assert registered["Calendar"] is calendar_owner.Calendar
    assert registered["CommunicationThread"] is communications_owner.CommunicationThread


def test_manifest_direct_ownership_matches_provider_exports_and_origins() -> None:
    expected = _expected_registry()
    manifests = load_module_manifests()
    models = ensure_module_models_registered()
    root = repo_root()

    for module_name in EXPECTED_PROVIDER_ORDER:
        manifest = manifests[module_name]
        direct_names = {
            str(owner) for owner in manifest["owned_tables"] if ":" not in str(owner)
        }
        assert direct_names == set(expected[module_name])
        backend = (root / str(manifest["backend_path"])).resolve()
        for name in direct_names:
            source = Path(inspect.getsourcefile(models[name]) or "").resolve()
            assert source.is_relative_to(backend)

    assert "ModuleRecord:apps.manager" in manifests["apps.manager"]["owned_tables"]
    assert all(
        ":" in str(owner)
        for manifest in manifests.values()
        for owner in manifest["owned_tables"]
        if str(owner).split(":", 1)[0] in KERNEL_MODELS
    )


def test_complete_registry_can_create_all_tables_in_sqlite() -> None:
    ensure_module_models_registered()
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with engine.connect() as connection:
        table_names = set(
            connection.exec_driver_sql(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).scalars()
        )
    assert set(Base.metadata.tables).issubset(table_names)


def test_schema_identifiers_fit_postgresql_limit() -> None:
    ensure_module_models_registered()
    identifiers = {
        table.name
        for table in Base.metadata.tables.values()
    }
    for table in Base.metadata.tables.values():
        identifiers.update(column.name for column in table.columns)
        identifiers.update(
            item.name
            for item in (*table.constraints, *table.indexes)
            if item.name is not None
        )

    assert sorted(name for name in identifiers if len(name) > 63) == []


@pytest.mark.parametrize(
    "setup",
    [
        (
            "from uok.host.model_registry import ensure_module_models_registered; "
            "ensure_module_models_registered()"
        ),
        "from uok.module_tables import model_table_names; model_table_names()",
        "from uok.migration_registry import verify_migration_discipline; verify_migration_discipline()",
        (
            "from uok.host.module_paths import ensure_module_backend_paths; "
            "ensure_module_backend_paths(); import uok_calendar_core.models"
        ),
        (
            "from uok.host.module_paths import ensure_module_backend_paths; "
            "ensure_module_backend_paths(); import uok_agents_core.public_api"
        ),
        (
            "from uok.host.module_paths import ensure_module_backend_paths; "
            "ensure_module_backend_paths(); import uok_communications_core.models"
        ),
        (
            "from uok.host.module_paths import ensure_module_backend_paths; "
            "ensure_module_backend_paths(); import uok_compliance_core.public_api"
        ),
        (
            "from uok.host.module_paths import ensure_module_backend_paths; "
            "ensure_module_backend_paths(); import uok_contacts_core.public_api"
        ),
        (
            "from uok.host.module_paths import ensure_module_backend_paths; "
            "ensure_module_backend_paths(); "
            "from uok_contacts_core.public_api import PartyReferenceResolution; "
            "assert PartyReferenceResolution.__name__ == 'PartyReferenceResolution'"
        ),
        (
            "from uok.host.module_paths import ensure_module_backend_paths; "
            "ensure_module_backend_paths(); import uok_planning_core.public_api"
        ),
        (
            "from uok.host.module_paths import ensure_module_backend_paths; "
            "ensure_module_backend_paths(); import uok_locations_core.public_api"
        ),
        (
            "from uok.host.module_paths import ensure_module_backend_paths; "
            "ensure_module_backend_paths(); import uok_product_master.public_api"
        ),
        (
            "from uok.host.module_paths import ensure_module_backend_paths; "
            "ensure_module_backend_paths(); import uok_reports_core.models"
        ),
        (
            "from uok.host.module_paths import ensure_module_backend_paths; "
            "ensure_module_backend_paths(); import uok_routes_core.public_api"
        ),
        (
            "from uok.host.module_paths import ensure_module_backend_paths; "
            "ensure_module_backend_paths(); import uok_shipments_core.public_api"
        ),
    ],
)
def test_import_order_produces_the_same_registry(setup: str) -> None:
    script = f"""
{setup}
from uok.host.model_registry import module_model_registry_report
from uok.kernel.persistence import Base
report = module_model_registry_report()
assert report['model_count'] == {EXPECTED_MODEL_COUNT}
assert report['table_count'] == {EXPECTED_MODEL_COUNT}
assert report['provider_order'] == {list(EXPECTED_PROVIDER_ORDER)!r}
assert len(Base.registry.mappers) == {EXPECTED_MODEL_COUNT}
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


@pytest.mark.parametrize(
    ("provider_expression", "message"),
    [
        ("{}", "provider mismatch"),
        ("{'OwnedModel': 'not-a-class'}", "must inherit uok.kernel.persistence.Base"),
        (
            "{'OwnedModel': 'not-a-class', 'ExtraModel': 'not-a-class'}",
            "provider mismatch",
        ),
    ],
)
def test_malformed_model_provider_fails_terminally_in_subprocess(
    provider_expression: str,
    message: str,
) -> None:
    script = f"""
import uok.host.model_registry as registry
from uok.host.model_registry import ModuleModelRegistryError

manifest = {{
    'name': 'alpha.core',
    'backend_path': 'modules/contacts.core/backend',
    'model_exports': 'alpha.models:owned_models',
    'owned_tables': ['OwnedModel'],
}}
registry.validate_module_runtime_contracts = lambda: {{'ok': True, 'violations': []}}
registry.load_module_manifests = lambda: {{'alpha.core': manifest}}
registry.dependency_order = lambda manifests: ['alpha.core']
registry.resolve_module_import = lambda *args: (lambda: {provider_expression})
try:
    registry.ensure_module_models_registered()
except ModuleModelRegistryError as error:
    assert {message!r} in str(error)
else:
    raise AssertionError('malformed provider was accepted')
try:
    registry.ensure_module_models_registered()
except ModuleModelRegistryError as error:
    assert 'previously failed' in str(error)
else:
    raise AssertionError('failed registry was not terminal')
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

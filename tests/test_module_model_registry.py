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
from uok.db import Base
from uok.kernel_models import KERNEL_MODELS
from uok.module_manifest_loader import load_module_manifests
from uok.module_model_registry import (
    ensure_module_models_registered,
    module_model_provider_order,
    module_model_registry_report,
)
from uok.module_paths import repo_root


FIXTURE = Path(__file__).parent / "fixtures" / "module_model_registry.json"
METADATA_FIXTURE = Path(__file__).parent / "fixtures" / "module_model_metadata.json"
EXPECTED_PROVIDER_ORDER = (
    "calendar.core",
    "communications.core",
    "contacts.core",
    "planning.core",
    "reports.core",
)


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
    assert report["model_count"] == 49
    assert report["table_count"] == 49
    assert tuple(report["provider_order"]) == EXPECTED_PROVIDER_ORDER
    assert len(Base.registry.mappers) == 49
    assert len(Base.metadata.tables) == 49


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


def test_compatibility_facades_preserve_exact_class_identity() -> None:
    from uok import calendar_models, communication_models, models
    from uok import planning_analysis_models, planning_audit_models
    from uok import planning_models, planning_resource_models
    from uok_calendar_core import models as calendar_owner
    from uok_communications_core import models as communications_owner
    from uok_contacts_core import models as contacts_owner
    from uok_planning_core import models as planning_owner
    from uok_reports_core import models as reports_owner

    owners = (
        calendar_owner,
        communications_owner,
        contacts_owner,
        planning_owner,
        reports_owner,
    )
    for owner in owners:
        for name, model in owner.owned_models().items():
            assert getattr(models, name) is model

    assert calendar_models.Calendar is calendar_owner.Calendar
    assert communication_models.CommunicationThread is communications_owner.CommunicationThread
    assert planning_models.PlanningProject is planning_owner.PlanningProject
    assert planning_resource_models.PlanningResource is planning_owner.PlanningResource
    assert planning_analysis_models.PlanningAnalysisRun is planning_owner.PlanningAnalysisRun
    assert planning_audit_models.PlanningScheduleRevision is planning_owner.PlanningScheduleRevision


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


@pytest.mark.parametrize(
    "setup",
    [
        "import uok.models",
        "from uok.module_tables import model_table_names; model_table_names()",
        "from uok.migration_registry import verify_migration_discipline; verify_migration_discipline()",
        (
            "from uok.module_paths import ensure_module_backend_paths; "
            "ensure_module_backend_paths(); import uok_calendar_core.models"
        ),
        (
            "from uok.module_paths import ensure_module_backend_paths; "
            "ensure_module_backend_paths(); import uok_communications_core.models"
        ),
        (
            "from uok.module_paths import ensure_module_backend_paths; "
            "ensure_module_backend_paths(); import uok_contacts_core.models"
        ),
        (
            "from uok.module_paths import ensure_module_backend_paths; "
            "ensure_module_backend_paths(); "
            "from uok_contacts_core import clean_text; assert clean_text(' UOK ') == 'UOK'"
        ),
        (
            "from uok.module_paths import ensure_module_backend_paths; "
            "ensure_module_backend_paths(); namespace = {}; "
            "exec('from uok_contacts_core import *', namespace); "
            "assert namespace['clean_text'](' UOK ') == 'UOK'"
        ),
        (
            "from uok.module_paths import ensure_module_backend_paths; "
            "ensure_module_backend_paths(); import uok_planning_core.models"
        ),
        (
            "from uok.module_paths import ensure_module_backend_paths; "
            "ensure_module_backend_paths(); import uok_reports_core.models"
        ),
    ],
)
def test_import_order_produces_the_same_registry(setup: str) -> None:
    script = f"""
{setup}
from uok.module_model_registry import module_model_registry_report
from uok.db import Base
report = module_model_registry_report()
assert report['model_count'] == 49
assert report['table_count'] == 49
assert report['provider_order'] == {list(EXPECTED_PROVIDER_ORDER)!r}
assert len(Base.registry.mappers) == 49
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
        ("{'OwnedModel': 'not-a-class'}", "must inherit uok.db.Base"),
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
import uok.module_model_registry as registry
from uok.module_model_registry import ModuleModelRegistryError

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

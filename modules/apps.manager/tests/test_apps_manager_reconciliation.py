from __future__ import annotations

import importlib

import pytest
from sqlalchemy import delete, func, select
from sqlalchemy.dialects import postgresql
from starlette.testclient import TestClient

from tests.helpers import auth
from uok import module_dependencies
from uok.db import SessionLocal
from uok.models import EventRecord, ModuleRecord, Organization
from uok.module_dependencies import ensure_dependencies_operational, ensure_module_operational
from uok.modules import module_catalog
from uok.util import dumps, loads

module_status_service = importlib.import_module("uok.module_status")
module_lifecycle_service = importlib.import_module("uok.module_lifecycle")


def test_missing_required_record_projects_declared_status_with_reconciliation_evidence(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    manifest = module_catalog()["apps.manager"]
    monkeypatch.setattr(module_status_service, "module_catalog", lambda: {"apps.manager": manifest})
    monkeypatch.setattr(module_status_service, "module_record", lambda *_: None)
    monkeypatch.setattr(module_status_service, "module_dependents", lambda *_: [])

    status = module_status_service.module_status(object(), "organization", "apps.manager")

    assert status["status"] == "installed"
    assert status["recorded_status"] is None
    assert status["reconciliation_required"] is True
    assert status["lifecycle_state_declared"] is True


def test_legacy_planned_module_record_is_inert_and_reconciles_once(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    admin = auth(client, "admin", "admin")
    viewer = auth(client, "viewer", "viewer123")
    with SessionLocal() as db:
        organization_id = db.scalar(select(Organization.id))
        assert organization_id
        row = db.scalar(select(ModuleRecord).where(
            ModuleRecord.organization_id == organization_id,
            ModuleRecord.name == "agents.core",
        ))
        if row is None:
            row = ModuleRecord(
                organization_id=organization_id,
                name="agents.core",
                kind="capability_module",
                version="3.1.0-alpha.2",
                status="upgraded",
                manifest_json=dumps({"maturity": "source_present"}),
            )
            db.add(row)
        else:
            row.status = "upgraded"
            row.version = "3.1.0-alpha.2"
            row.manifest_json = dumps({"maturity": "source_present"})
        db.commit()

    status = client.get("/api/modules/agents.core/status", headers=admin)
    assert status.status_code == 200, status.text
    assert status.json()["status"] == "planned"
    assert status.json()["recorded_status"] == "upgraded"
    assert status.json()["reconciliation_required"] is True

    with SessionLocal() as db:
        with pytest.raises(ValueError, match="not installed or enabled"):
            ensure_module_operational(db, organization_id, "agents.core")
        catalog = module_catalog()
        monkeypatch.setattr(module_dependencies, "module_catalog", lambda: {
            **catalog,
            "test.consumer": {
                "maturity": "runtime_proven",
                "lifecycle": ["available", "installed"],
                "dependencies": ["agents.core"],
            },
        })
        with pytest.raises(ValueError, match="agents.core"):
            ensure_dependencies_operational(db, organization_id, "test.consumer")
        event_filter = (
            EventRecord.organization_id == organization_id,
            EventRecord.event_type == "ModuleLifecycleReconciled",
            EventRecord.object_id == "agents.core",
        )
        before = db.scalar(select(func.count(EventRecord.id)).where(*event_filter)) or 0

    denied = client.post("/api/modules/agents.core/reconcile", headers=viewer)
    first_response = client.post("/api/modules/agents.core/reconcile", headers=admin)
    second_response = client.post("/api/modules/agents.core/reconcile", headers=admin)

    assert denied.status_code == 403, denied.text
    assert first_response.status_code == 200, first_response.text
    assert second_response.status_code == 200, second_response.text
    first = first_response.json()
    second = second_response.json()
    with SessionLocal() as db:
        after = db.scalar(select(func.count(EventRecord.id)).where(*event_filter)) or 0
        event = db.scalar(select(EventRecord).where(*event_filter).order_by(EventRecord.sequence.desc()))

    assert first["reconciled"] is True
    assert first["module"]["status"] == "planned"
    assert first["module"]["recorded_status"] == "planned"
    assert first["module"]["reconciliation_required"] is False
    assert second["reconciled"] is False
    assert after == before + 1
    assert event is not None
    assert loads(event.payload_json)["recorded_status"] == "upgraded"


def test_planned_record_with_current_status_but_stale_snapshot_requires_reconciliation(
    client: TestClient,
) -> None:
    admin = auth(client, "admin", "admin")
    with SessionLocal() as db:
        organization_id = db.scalar(select(Organization.id))
        assert organization_id
        row = db.scalar(select(ModuleRecord).where(
            ModuleRecord.organization_id == organization_id,
            ModuleRecord.name == "agents.core",
        ))
        assert row is not None
        row.status = "planned"
        row.version = "3.1.0-alpha.2"
        row.manifest_json = dumps({"maturity": "planned", "version": "3.1.0-alpha.2"})
        db.commit()

    status = client.get("/api/modules/agents.core/status", headers=admin)

    assert status.status_code == 200, status.text
    assert status.json()["status"] == "planned"
    assert status.json()["recorded_status"] == "planned"
    assert status.json()["reconciliation_required"] is True


def test_reconcile_recreates_missing_required_module_record(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    with SessionLocal() as db:
        organization_id = db.scalar(select(Organization.id))
        assert organization_id
        db.execute(delete(ModuleRecord).where(
            ModuleRecord.organization_id == organization_id,
            ModuleRecord.name == "apps.manager",
        ))
        db.commit()

    status = client.get("/api/modules/apps.manager/status", headers=admin)
    response = client.post("/api/modules/apps.manager/reconcile", headers=admin)

    assert status.status_code == 200, status.text
    assert status.json()["status"] == "installed"
    assert status.json()["reconciliation_required"] is True
    assert response.status_code == 200, response.text
    assert response.json()["reconciled"] is True
    assert response.json()["module"]["recorded_status"] == "installed"
    assert response.json()["module"]["reconciliation_required"] is False
    with SessionLocal() as db:
        event = db.scalar(select(EventRecord).where(
            EventRecord.organization_id == organization_id,
            EventRecord.event_type == "ModuleLifecycleReconciled",
            EventRecord.object_id == "apps.manager",
        ).order_by(EventRecord.sequence.desc()))
    assert event is not None
    payload = loads(event.payload_json)
    assert payload["created"] is True
    assert payload["recorded_status"] is None
    assert payload["recorded_version"] is None


def test_locked_module_lookup_compiles_to_for_update() -> None:
    class RecordingSession:
        statement = None

        def scalar(self, statement):
            self.statement = statement
            return None

    db = RecordingSession()

    module_dependencies.module_record(db, "organization", "agents.core", lock=True)

    assert db.statement is not None
    sql = str(db.statement.compile(dialect=postgresql.dialect()))
    assert "FOR UPDATE" in sql
    scope_sql = str(
        module_lifecycle_service._module_lifecycle_scope_statement("organization").compile(
            dialect=postgresql.dialect()
        )
    )
    assert "FOR UPDATE" in scope_sql

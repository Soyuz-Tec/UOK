from __future__ import annotations

from fastapi.testclient import TestClient

from tests.helpers import auth


def test_uok_migration_discipline_uses_single_active_baseline(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    discipline = client.get("/api/migrations/discipline", headers=admin)
    assert discipline.status_code == 200, discipline.text
    body = discipline.json()
    assert body["ok"] is True
    assert body["checks"]["single_active_baseline"] is True
    assert body["checks"]["baseline_has_uok_tables"] is True
    assert body["checks"]["baseline_has_declared_module_tables"] is True
    assert body["checks"]["baseline_has_contacts_tables"] is True
    assert {"parties", "party_relationships", "party_notes", "contact_import_batches"}.issubset(set(body["declared_module_tables"]))
    assert body["checks"]["baseline_has_no_business_module_tables"] is True

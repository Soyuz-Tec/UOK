from __future__ import annotations

from sqlalchemy.exc import SQLAlchemyError
from starlette.testclient import TestClient

from tests.helpers import auth
from uok.host.application import app
from uok.host.database import get_db
from uok.operations import readiness_report


class UnavailableSession:
    rollback_called = False

    def execute(self, *_args: object, **_kwargs: object) -> object:
        raise SQLAlchemyError("database unavailable")

    def rollback(self) -> None:
        self.rollback_called = True


def test_public_health_probes_are_minimal_and_ready(client: TestClient) -> None:
    live = client.get("/health/live")
    assert live.status_code == 200
    assert live.json()["status"] == "ok"
    assert "checks" not in live.json()

    ready = client.get("/health/ready")
    assert ready.status_code == 200
    assert ready.json()["checks"] == {"database": "ok", "schema": "ok"}

    compatible = client.get("/health")
    assert compatible.status_code == 200
    assert compatible.json()["candidate_state"] == "persistent"
    assert "events" not in compatible.json()
    assert "failed_commands" not in compatible.json()


def test_readiness_fails_closed_without_disclosing_database_error() -> None:
    db = UnavailableSession()

    report = readiness_report(db)  # type: ignore[arg-type]

    assert report["status"] == "unavailable"
    assert report["checks"] == {
        "database": "unavailable",
        "schema": "unavailable",
    }
    assert db.rollback_called is True
    assert "database unavailable" not in str(report)


def test_readiness_route_returns_503_without_disclosing_database_error() -> None:
    def unavailable_db() -> UnavailableSession:
        return UnavailableSession()

    app.dependency_overrides[get_db] = unavailable_db
    try:
        with TestClient(app) as client:
            response = client.get("/health/ready")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 503
    assert response.json()["status"] == "unavailable"
    assert "database unavailable" not in response.text


def test_operations_diagnostics_requires_permission_and_scopes_counts(
    client: TestClient,
) -> None:
    assert client.get("/api/operations/diagnostics").status_code == 401

    admin = auth(client, "admin", "admin")
    response = client.get("/api/operations/diagnostics", headers=admin)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert set(body["counts"]) == {"events", "failed_commands"}
    assert body["checks"] == {
        "migrations": True,
        "module_contracts": True,
    }

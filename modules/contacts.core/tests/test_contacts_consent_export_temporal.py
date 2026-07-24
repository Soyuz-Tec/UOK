from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command


def _install(client: TestClient) -> dict[str, str]:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    installed = client.post("/api/modules/contacts.core/install", headers=admin)
    assert installed.status_code == 200, installed.text
    return ops


def _contact(client: TestClient, ops: dict[str, str], suffix: str, prefix: str) -> tuple[str, str]:
    email = f"{prefix}-{suffix}@example.test"
    created = command(
        client,
        ops,
        "CreateContact",
        {"display_name": f"{prefix.title()} {suffix}", "email": email},
        f"consent-temporal-{prefix}-{suffix}",
    )
    assert created.status_code == 200, created.text
    return created.json()["result"]["contact_id"], email


def _consent(client: TestClient, ops: dict[str, str], party_id: str, status: str, effective: datetime, expires: datetime | None = None) -> None:
    response = client.post(
        f"/api/contacts/{party_id}/consents",
        headers=ops,
        json={
            "purpose": "directory_export",
            "channel": "email",
            "status": status,
            "effective_at": effective.isoformat(),
            "expires_at": expires.isoformat() if expires else None,
        },
    )
    assert response.status_code == 200, response.text


def test_export_resolves_only_currently_effective_unexpired_consent(client: TestClient) -> None:
    suffix = str(uuid4())
    ops = _install(client)
    now = datetime.now(timezone.utc)

    restricted_id, restricted_email = _contact(client, ops, suffix, "restricted")
    _consent(client, ops, restricted_id, "denied", now - timedelta(days=1))
    _consent(client, ops, restricted_id, "granted", now + timedelta(days=1), now + timedelta(days=2))
    restricted_export = client.get(f"/api/contacts/export.csv?party_id={restricted_id}", headers=ops)
    assert restricted_export.status_code == 200, restricted_export.text
    assert restricted_export.headers["x-consent-restricted-count"] == "1"
    assert restricted_email not in restricted_export.text

    allowed_id, allowed_email = _contact(client, ops, suffix, "allowed")
    _consent(client, ops, allowed_id, "denied", now - timedelta(days=2), now - timedelta(days=1))
    _consent(client, ops, allowed_id, "denied", now + timedelta(days=1), now + timedelta(days=2))
    allowed_export = client.get(f"/api/contacts/export.csv?party_id={allowed_id}", headers=ops)
    assert allowed_export.status_code == 200, allowed_export.text
    assert allowed_export.headers["x-consent-restricted-count"] == "0"
    assert allowed_email in allowed_export.text

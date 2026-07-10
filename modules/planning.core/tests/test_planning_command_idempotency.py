from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from starlette.testclient import TestClient

from tests.helpers import auth
import uok.commands as command_gateway


def test_planning_command_path_requires_key_and_maps_conflicts(client: TestClient) -> None:
    suffix = str(uuid4())[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")

    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    assert client.post("/api/modules/planning.core/install", headers=admin).status_code == 200

    payload = {
        "command_type": "CreatePlanningProject",
        "payload": {"name": f"Command Idempotency {suffix}", "start": "2026-08-03", "end": "2026-08-28"},
    }
    missing = client.post("/api/commands", headers=ops, json=payload)
    assert missing.status_code == 422, missing.text
    assert missing.json()["error"]["code"] == "command_request_invalid"
    assert missing.json()["error"]["field"] == "idempotency_key"

    control_character = client.post(
        "/api/commands",
        headers=ops,
        json={**payload, "idempotency_key": f"{'a' * 15}\x00"},
    )
    assert control_character.status_code == 422, control_character.text

    key = f"planning-command-project-{suffix}"
    created = client.post("/api/commands", headers=ops, json={**payload, "idempotency_key": key})
    assert created.status_code == 200, created.text

    replay = client.post("/api/commands", headers=ops, json={**payload, "idempotency_key": key})
    assert replay.status_code == 200, replay.text
    assert replay.json()["result"] == created.json()["result"]
    assert replay.json()["idempotent"] is True

    changed = {
        **payload,
        "payload": {**payload["payload"], "name": f"Different Command Idempotency {suffix}"},
        "idempotency_key": key,
    }
    conflict = client.post("/api/commands", headers=ops, json=changed)
    assert conflict.status_code == 409, conflict.text
    error = conflict.json()["error"]
    assert error["code"] == "idempotency_conflict"
    assert error["field"] == "idempotency_key"
    assert error["correlation_id"] == created.json()["command_id"]
    assert "different command request" in error["message"]


def test_command_gateway_recovers_a_same_key_insert_race(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    ops = auth(client, "ops", "ops123")
    replay = {
        "idempotent": True,
        "status": "succeeded",
        "result": {"id": "project-from-first-request"},
    }
    lookup_count = 0

    def raced_lookup(session: Session, *_args: object, **_kwargs: object) -> dict[str, object] | None:
        nonlocal lookup_count
        lookup_count += 1
        if lookup_count == 2:
            assert not session.in_transaction(), "the failed insert must be rolled back before replay lookup"
        return None if lookup_count == 1 else replay

    def unique_key_race(_session: Session) -> None:
        raise IntegrityError("INSERT command_logs", {}, Exception("duplicate idempotency key"))

    monkeypatch.setattr(command_gateway, "_authorized_replay_or_none", raced_lookup)
    monkeypatch.setattr(Session, "flush", unique_key_race)

    response = client.post(
        "/api/commands",
        headers=ops,
        json={
            "command_type": "CreatePlanningProject",
            "payload": {"name": "Raced project", "start": "2026-08-03", "end": "2026-08-28"},
            "idempotency_key": "planning-raced-project-key",
        },
    )

    assert response.status_code == 200, response.text
    assert response.json() == replay
    assert lookup_count == 2

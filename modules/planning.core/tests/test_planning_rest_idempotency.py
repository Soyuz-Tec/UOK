from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth


def test_planning_rest_writes_require_and_replay_idempotency_key(client: TestClient) -> None:
    suffix = str(uuid4())[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")

    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    assert client.post("/api/modules/planning.core/install", headers=admin).status_code == 200

    payload = {"name": f"REST Idempotency {suffix}", "start": "2026-08-03", "end": "2026-08-28"}
    missing = client.post("/api/planning/projects", headers=ops, json=payload)
    assert missing.status_code == 422, missing.text

    key = f"planning-rest-project-{suffix}"
    headers = {**ops, "Idempotency-Key": key}
    created = client.post("/api/planning/projects", headers=headers, json=payload)
    assert created.status_code == 200, created.text

    replay = client.post("/api/planning/projects", headers=headers, json=payload)
    assert replay.status_code == 200, replay.text
    assert replay.json() == created.json()

    conflict = client.post(
        "/api/planning/projects",
        headers=headers,
        json={**payload, "name": f"Different REST Idempotency {suffix}"},
    )
    assert conflict.status_code == 409, conflict.text
    assert "different command request" in conflict.json()["detail"]["error"]

    rows = client.get("/api/planning/projects", headers=ops)
    assert rows.status_code == 200, rows.text
    assert [row["id"] for row in rows.json()].count(created.json()["id"]) == 1

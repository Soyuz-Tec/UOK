from __future__ import annotations

from json import loads
from pathlib import Path
from uuid import uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy import select
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.db import SessionLocal
from uok.models import EventRecord


def test_thread_provider_is_scoped_audited_idempotent_and_lifecycle_safe(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    viewer = auth(client, "viewer", "viewer123")
    finance = auth(client, "finance", "finance123")
    installed = client.post("/api/modules/communications.core/install", headers=admin)
    assert installed.status_code == 200, installed.text
    suffix = uuid4().hex[:8]
    payload = {"title": f"Execution room {suffix}", "context_type": "planning.task", "context_id": f"task-{suffix}"}

    created = command(client, ops, "CreateCommunicationThread", payload, f"communication-thread-{suffix}")
    assert created.status_code == 200, created.text
    body = created.json()["result"]
    assert body["title"] == payload["title"]
    assert body["context_type"] == "planning.task"
    assert body["context_id"] == f"task-{suffix}"
    assert body["correlation_id"] == created.json()["command_id"]
    replay = command(client, ops, "CreateCommunicationThread", payload, f"communication-thread-{suffix}")
    assert replay.status_code == 200, replay.text
    assert replay.json()["idempotent"] is True

    rows = client.get("/api/communications/threads", headers=viewer)
    assert rows.status_code == 200, rows.text
    assert any(row["id"] == body["id"] for row in rows.json())
    detail = client.get(f"/api/communications/threads/{body['id']}", headers=viewer)
    assert detail.status_code == 200, detail.text
    assert detail.json()["id"] == body["id"]
    denied = client.get(f"/api/communications/threads/{body['id']}", headers=finance)
    assert denied.status_code == 403, denied.text

    with SessionLocal() as db:
        event = db.scalar(select(EventRecord).where(
            EventRecord.event_type == "CommunicationThreadCreated",
            EventRecord.object_id == body["id"],
        ))
        assert event is not None
        assert loads(event.payload_json)["correlation_id"] == created.json()["command_id"]

    assert client.post("/api/modules/communications.core/disable", headers=admin).status_code == 200
    unavailable = client.get("/api/communications/threads", headers=ops)
    assert unavailable.status_code == 400, unavailable.text
    assert client.post("/api/modules/communications.core/enable", headers=admin).status_code == 200
    assert client.get(f"/api/communications/threads/{body['id']}", headers=ops).status_code == 200


def test_communication_migration_and_manifest_are_module_owned() -> None:
    root = Path(__file__).parents[1]
    sql = (root / "migrations" / "001_communications_core.sql").read_text(encoding="utf-8")
    manifest = (root / "manifest.yaml").read_text(encoding="utf-8")
    assert "CREATE TABLE IF NOT EXISTS communication_threads" in sql
    assert "ck_communication_thread_status" in sql
    for value in (
        "CreateCommunicationThread",
        "CommunicationThreadCreated",
        "CommunicationThread",
        "communications.read",
        "communications.edit",
    ):
        assert value in manifest


def test_communication_thread_rejects_whitespace_only_title() -> None:
    from uok_communications_core.schemas import CommunicationThreadCreateRequest

    with pytest.raises(ValidationError):
        CommunicationThreadCreateRequest(title="   ")

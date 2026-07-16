from __future__ import annotations

from json import loads
from uuid import uuid4

from sqlalchemy import func, select
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.db import SessionLocal
from uok.models import CommunicationThread, EventRecord


def test_thread_capabilities_are_server_projected_and_private(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    trader = auth(client, "trader", "trader123")
    viewer = auth(client, "viewer", "viewer123")
    finance = auth(client, "finance", "finance123")
    assert client.post("/api/modules/communications.core/install", headers=admin).status_code == 200

    for headers in (ops, trader):
        response = client.get("/api/communications/capabilities", headers=headers)
        assert response.status_code == 200, response.text
        assert response.json() == {"read": True, "create": True, "delete": True, "restore": True}
        assert response.headers["cache-control"] == "private, no-store"
        assert response.headers["vary"] == "Authorization"

    read_only = client.get("/api/communications/capabilities", headers=viewer)
    assert read_only.status_code == 200, read_only.text
    assert read_only.json() == {"read": True, "create": False, "delete": False, "restore": False}
    assert client.get("/api/communications/capabilities", headers=finance).status_code == 403


def test_thread_delete_restore_is_retained_audited_and_preserves_prior_status(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    viewer = auth(client, "viewer", "viewer123")
    assert client.post("/api/modules/communications.core/install", headers=admin).status_code == 200

    for prior_status in ("open", "closed"):
        suffix = uuid4().hex[:8]
        created = command(
            client,
            ops,
            "CreateCommunicationThread",
            {"title": f"{prior_status.title()} lifecycle {suffix}", "context_type": "planning.task", "context_id": f"task-{suffix}"},
            f"communication-lifecycle-create-{suffix}",
        )
        assert created.status_code == 200, created.text
        thread = created.json()["result"]
        thread_id = thread["id"]
        if prior_status == "closed":
            with SessionLocal.begin() as db:
                row = db.get(CommunicationThread, thread_id)
                assert row is not None
                row.status = "closed"

        denied = client.delete(f"/api/communications/threads/{thread_id}", headers=viewer)
        assert denied.status_code == 403, denied.text
        assert denied.headers["cache-control"] == "private, no-store"
        assert denied.headers["vary"] == "Authorization"
        missing_precondition = client.delete(f"/api/communications/threads/{thread_id}", headers=ops)
        assert missing_precondition.status_code == 428, missing_precondition.text
        assert "open and confirm the action again" in missing_precondition.json()["error"]["repair"]
        stale = client.delete(
            f"/api/communications/threads/{thread_id}",
            headers={**ops, "If-Match": f'"communication-thread:{thread_id}:v99"'},
        )
        assert stale.status_code == 412, stale.text
        assert stale.headers["etag"] == thread["etag"]
        archived = client.delete(
            f"/api/communications/threads/{thread_id}",
            headers={**ops, "If-Match": thread["etag"]},
        )
        assert archived.status_code == 200, archived.text
        assert archived.headers["etag"] == archived.json()["etag"]
        assert archived.json()["status"] == "archived"
        assert archived.json()["restore_status"] == prior_status
        assert archived.json()["id"] == thread_id

        assert thread_id not in {row["id"] for row in client.get("/api/communications/threads", headers=ops).json()}
        archived_rows = client.get("/api/communications/threads", headers=ops, params={"lifecycle": "archived"})
        assert archived_rows.status_code == 200, archived_rows.text
        assert archived_rows.headers["cache-control"] == "private, no-store"
        assert archived_rows.headers["vary"] == "Authorization"
        assert thread_id in {row["id"] for row in archived_rows.json()}
        assert client.get(f"/api/communications/threads/{thread_id}", headers=ops).status_code == 404
        archived_detail = client.get(
            f"/api/communications/threads/{thread_id}",
            headers=ops,
            params={"include_archived": "true"},
        )
        assert archived_detail.status_code == 200, archived_detail.text
        assert archived_detail.headers["etag"] == archived.headers["etag"]
        assert archived_detail.json()["etag"] == archived.headers["etag"]

        with SessionLocal() as db:
            row = db.get(CommunicationThread, thread_id)
            assert row is not None
            assert row.title == thread["title"]
            assert row.context_id == thread["context_id"]
            assert row.created_by_user_id == thread["created_by_user_id"]
            assert row.archived_at is not None
            assert row.archived_from_status == prior_status
            event = db.scalar(select(EventRecord).where(
                EventRecord.event_type == "CommunicationThreadArchived",
                EventRecord.object_id == thread_id,
            ))
            assert event is not None
            assert loads(event.payload_json)["previous_status"] == prior_status

        assert client.delete(
            f"/api/communications/threads/{thread_id}",
            headers={**ops, "If-Match": archived.json()["etag"]},
        ).status_code == 200
        assert _event_count("CommunicationThreadArchived", thread_id) == 1

        restored = client.post(
            f"/api/communications/threads/{thread_id}/restore",
            headers={**ops, "If-Match": archived.json()["etag"]},
        )
        assert restored.status_code == 200, restored.text
        assert restored.headers["etag"] == restored.json()["etag"]
        assert restored.json()["status"] == prior_status
        assert restored.json()["restore_status"] is None
        assert restored.json()["id"] == thread_id
        restored_detail = client.get(f"/api/communications/threads/{thread_id}", headers=ops)
        assert restored_detail.status_code == 200, restored_detail.text
        assert restored_detail.headers["etag"] == restored.headers["etag"]
        assert restored_detail.json()["etag"] == restored.headers["etag"]
        assert thread_id in {row["id"] for row in client.get("/api/communications/threads", headers=ops).json()}
        assert thread_id not in {row["id"] for row in client.get("/api/communications/threads", headers=ops, params={"lifecycle": "archived"}).json()}
        assert client.post(
            f"/api/communications/threads/{thread_id}/restore",
            headers={**ops, "If-Match": restored.json()["etag"]},
        ).status_code == 200
        assert _event_count("CommunicationThreadRestored", thread_id) == 1


def test_thread_lifecycle_mutations_fail_closed_while_module_is_disabled(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/communications.core/install", headers=admin).status_code == 200
    suffix = uuid4().hex[:8]
    created = command(client, ops, "CreateCommunicationThread", {"title": f"Disabled lifecycle {suffix}"}, f"disabled-thread-{suffix}")
    thread_id = created.json()["result"]["id"]
    assert client.post("/api/modules/communications.core/disable", headers=admin).status_code == 200
    denied = client.delete(
        f"/api/communications/threads/{thread_id}",
        headers={**ops, "If-Match": created.json()["result"]["etag"]},
    )
    assert denied.status_code == 400, denied.text
    with SessionLocal() as db:
        row = db.get(CommunicationThread, thread_id)
        assert row is not None
        assert row.status == "open"
        assert row.archived_at is None
    assert client.post("/api/modules/communications.core/enable", headers=admin).status_code == 200


def _event_count(event_type: str, thread_id: str) -> int:
    with SessionLocal() as db:
        return int(db.scalar(select(func.count()).select_from(EventRecord).where(
            EventRecord.event_type == event_type,
            EventRecord.object_id == thread_id,
        )) or 0)

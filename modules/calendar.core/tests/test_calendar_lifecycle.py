from __future__ import annotations

from uuid import uuid4

from sqlalchemy import func, select
from starlette.testclient import TestClient

from tests.helpers import auth
from uok.host.database import SessionLocal
from uok.kernel_models import EventRecord
from uok_calendar_core.calendar_lifecycle import strong_calendar_etag
from uok_calendar_core.models import Calendar, CalendarEventParticipant, CalendarReminder


WINDOW = "from_at=2033-06-01T00%3A00%3A00Z&to_at=2033-06-10T00%3A00%3A00Z"


def test_calendar_capabilities_are_server_projected_and_private(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    trader = auth(client, "trader", "trader123")
    viewer = auth(client, "viewer", "viewer123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200

    for headers in (admin, ops):
        response = client.get("/api/calendar/capabilities", headers=headers)
        assert response.status_code == 200, response.text
        assert response.json() == {"read": True, "manage": True, "create": True, "delete": True, "restore": True}
        assert response.headers["Cache-Control"] == "private, no-store"
        assert response.headers["Vary"] == "Authorization"

    for headers in (trader, viewer):
        response = client.get("/api/calendar/capabilities", headers=headers)
        assert response.status_code == 200, response.text
        assert response.json() == {"read": True, "manage": False, "create": False, "delete": False, "restore": False}


def test_calendar_delete_is_guarded_retained_hidden_and_restorable(client: TestClient) -> None:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    trader = auth(client, "trader", "trader123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200

    calendar = client.post("/api/calendar/calendars", headers=ops, json={
        "name": f"Retained calendar {suffix}",
        "timezone": "UTC",
        "visibility_scope": "organization",
    })
    assert calendar.status_code == 200, calendar.text
    calendar_row = calendar.json()
    calendar_id = calendar_row["id"]
    initial_etag = calendar_row["etag"]
    assert initial_etag.startswith('"calendar-sha256-')
    assert calendar_row["user_managed"] is True
    assert calendar_row["can_delete"] is True
    assert calendar_row["can_restore"] is False
    event = client.post("/api/calendar/events", headers=ops, json={
        "calendar_id": calendar_id,
        "title": f"Retained event {suffix}",
        "starts_at": "2033-06-04T09:00:00Z",
        "ends_at": "2033-06-04T10:00:00Z",
        "timezone": "UTC",
        "participants": [{"participant_type": "person", "email": "retained@example.test"}],
        "reminders": [{"reminder_type": "in_app", "trigger_minutes_before": 15}],
    })
    assert event.status_code == 200, event.text
    event_id = event.json()["id"]

    denied = client.delete(f"/api/calendar/calendars/{calendar_id}", headers=trader)
    assert denied.status_code == 403, denied.text

    missing = client.delete(f"/api/calendar/calendars/{calendar_id}", headers=ops)
    assert missing.status_code == 428, missing.text
    assert missing.json()["error"]["code"] == "precondition_required"

    updated = client.patch(f"/api/calendar/calendars/{calendar_id}", headers=ops, json={"name": f"Updated retained calendar {suffix}"})
    assert updated.status_code == 200, updated.text
    latest = next(row for row in client.get("/api/calendar/calendars", headers=ops).json() if row["id"] == calendar_id)
    stale = client.delete(f"/api/calendar/calendars/{calendar_id}", headers={**ops, "If-Match": initial_etag})
    assert stale.status_code == 412, stale.text
    assert stale.json()["error"]["code"] == "stale_precondition"
    assert stale.headers["ETag"] == latest["etag"]

    deleted = client.delete(f"/api/calendar/calendars/{calendar_id}", headers={**ops, "If-Match": latest["etag"]})
    assert deleted.status_code == 200, deleted.text
    assert deleted.json()["status"] == "deleted"
    assert deleted.json()["can_delete"] is False
    assert deleted.json()["can_restore"] is True
    assert deleted.headers["ETag"] == deleted.json()["etag"]

    delete_retry = client.delete(
        f"/api/calendar/calendars/{calendar_id}",
        headers={**ops, "If-Match": deleted.headers["ETag"]},
    )
    assert delete_retry.status_code == 200, delete_retry.text
    assert delete_retry.json() == deleted.json()
    assert delete_retry.headers["ETag"] == deleted.headers["ETag"]

    with SessionLocal() as db:
        stored = db.get(Calendar, calendar_id)
        assert stored is not None
        assert stored.status == "deleted"
        assert stored.deleted_at is not None
        assert db.scalar(select(func.count()).select_from(CalendarEventParticipant).where(CalendarEventParticipant.event_id == event_id)) == 1
        assert db.scalar(select(func.count()).select_from(CalendarReminder).where(CalendarReminder.event_id == event_id)) == 1
        audit = db.scalar(select(EventRecord).where(
            EventRecord.event_type == "CalendarDeleted",
            EventRecord.object_id == calendar_id,
        ))
        assert audit is not None
        delete_event_count = db.scalar(select(func.count()).select_from(EventRecord).where(
            EventRecord.event_type == "CalendarDeleted",
            EventRecord.object_id == calendar_id,
        ))
        assert delete_event_count == 1

    assert calendar_id not in {row["id"] for row in client.get("/api/calendar/calendars", headers=ops).json()}
    denied_deleted_catalog = client.get("/api/calendar/calendars?include_deleted=true", headers=trader)
    assert denied_deleted_catalog.status_code == 403
    deleted_catalog = client.get("/api/calendar/calendars?include_deleted=true", headers=ops)
    assert deleted_catalog.status_code == 200, deleted_catalog.text
    assert deleted_catalog.headers["Cache-Control"] == "private, no-store"
    assert deleted_catalog.headers["Vary"] == "Authorization"
    retained = next(row for row in deleted_catalog.json() if row["id"] == calendar_id)
    assert retained["status"] == "deleted"
    assert retained["can_restore"] is True
    assert retained["etag"] == deleted.headers["ETag"]
    detail = client.get(f"/api/calendar/events/{event_id}", headers=ops)
    assert detail.status_code == 404
    assert detail.json()["detail"] == "calendar event not found"
    assert client.get(f"/api/calendar/events?{WINDOW}&calendar_id={calendar_id}", headers=ops).json() == []
    assert client.get(f"/api/calendar/freebusy?{WINDOW}&calendar_id={calendar_id}", headers=ops).json() == {"busy": []}
    assert f"Retained event {suffix}" not in client.get(f"/api/calendar/ics/export?{WINDOW}&calendar_id={calendar_id}", headers=ops).text

    rejected_event = client.post("/api/calendar/events", headers=ops, json={
        "calendar_id": calendar_id,
        "title": "Must stay hidden",
        "starts_at": "2033-06-05T09:00:00Z",
        "ends_at": "2033-06-05T10:00:00Z",
        "timezone": "UTC",
    })
    assert rejected_event.status_code == 400
    assert rejected_event.json()["detail"] == {"error": "calendar not found"}

    missing_restore = client.post(f"/api/calendar/calendars/{calendar_id}/restore", headers=ops)
    assert missing_restore.status_code == 428, missing_restore.text
    restored = client.post(
        f"/api/calendar/calendars/{calendar_id}/restore",
        headers={**ops, "If-Match": retained["etag"]},
    )
    assert restored.status_code == 200, restored.text
    assert restored.json()["status"] == "active"
    assert restored.json()["can_delete"] is True
    assert restored.json()["can_restore"] is False
    assert restored.headers["ETag"] == restored.json()["etag"]
    restore_retry = client.post(
        f"/api/calendar/calendars/{calendar_id}/restore",
        headers={**ops, "If-Match": restored.headers["ETag"]},
    )
    assert restore_retry.status_code == 200, restore_retry.text
    assert restore_retry.json() == restored.json()
    assert restore_retry.headers["ETag"] == restored.headers["ETag"]
    restored_read = next(row for row in client.get("/api/calendar/calendars", headers=ops).json() if row["id"] == calendar_id)
    assert restored_read["etag"] == restored.headers["ETag"]
    assert client.get(f"/api/calendar/events/{event_id}", headers=ops).status_code == 200
    assert f"Retained event {suffix}" in client.get(f"/api/calendar/ics/export?{WINDOW}&calendar_id={calendar_id}", headers=ops).text
    with SessionLocal() as db:
        restored_audit = db.scalar(select(EventRecord).where(
            EventRecord.event_type == "CalendarRestored",
            EventRecord.object_id == calendar_id,
        ))
        assert restored_audit is not None
        restore_event_count = db.scalar(select(func.count()).select_from(EventRecord).where(
            EventRecord.event_type == "CalendarRestored",
            EventRecord.object_id == calendar_id,
        ))
        assert restore_event_count == 1


def test_system_managed_calendar_is_not_delete_eligible(client: TestClient) -> None:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    created = client.post("/api/calendar/calendars", headers=ops, json={
        "name": f"System calendar {suffix}",
        "timezone": "UTC",
        "visibility_scope": "organization",
    })
    assert created.status_code == 200, created.text
    calendar_id = created.json()["id"]
    with SessionLocal() as db:
        calendar = db.get(Calendar, calendar_id)
        assert calendar is not None
        calendar.owner_user_id = None
        db.commit()

    row = next(item for item in client.get("/api/calendar/calendars", headers=ops).json() if item["id"] == calendar_id)
    assert row["user_managed"] is False
    assert row["can_delete"] is False
    rejected = client.delete(f"/api/calendar/calendars/{calendar_id}", headers={**ops, "If-Match": row["etag"]})
    assert rejected.status_code == 400, rejected.text
    assert "system-managed" in rejected.text
    with SessionLocal() as db:
        calendar = db.get(Calendar, calendar_id)
        assert calendar is not None
        assert calendar.status == "active"


def test_invalid_calendar_lifecycle_state_is_hidden_and_not_transitioned(client: TestClient) -> None:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    created = client.post("/api/calendar/calendars", headers=ops, json={
        "name": f"Invalid lifecycle {suffix}",
        "timezone": "UTC",
        "visibility_scope": "organization",
    })
    assert created.status_code == 200, created.text
    calendar_id = created.json()["id"]
    with SessionLocal() as db:
        calendar = db.get(Calendar, calendar_id)
        assert calendar is not None
        calendar.status = "corrupt"
        calendar.updated_at = calendar.created_at
        db.commit()
        db.refresh(calendar)
        invalid_etag = strong_calendar_etag(calendar)

    assert calendar_id not in {
        row["id"]
        for row in client.get("/api/calendar/calendars?include_deleted=true", headers=ops).json()
    }
    deleted = client.delete(
        f"/api/calendar/calendars/{calendar_id}",
        headers={**ops, "If-Match": invalid_etag},
    )
    restored = client.post(
        f"/api/calendar/calendars/{calendar_id}/restore",
        headers={**ops, "If-Match": invalid_etag},
    )
    assert deleted.status_code == restored.status_code == 400
    assert "invalid lifecycle state" in deleted.text
    assert "invalid lifecycle state" in restored.text
    with SessionLocal() as db:
        calendar = db.get(Calendar, calendar_id)
        assert calendar is not None
        assert calendar.status == "corrupt"
        lifecycle_events = db.scalar(select(func.count()).select_from(EventRecord).where(
            EventRecord.object_id == calendar_id,
            EventRecord.event_type.in_(("CalendarDeleted", "CalendarRestored")),
        ))
        assert lifecycle_events == 0

from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from uok.host.database import SessionLocal
from uok_calendar_core.models import CalendarEvent

from tests.helpers import auth, command


def test_event_patch_requires_current_etag_and_rejects_null_or_status_bypass(client: TestClient) -> None:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    trader = auth(client, "trader", "trader123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    calendar = client.post("/api/calendar/calendars", headers=ops, json={"name": f"ETag {suffix}"}).json()
    created = client.post("/api/calendar/events", headers=ops, json={
        "calendar_id": calendar["id"],
        "title": f"Protected update {suffix}",
        "starts_at": "2026-07-13T13:00:00Z",
        "ends_at": "2026-07-13T14:00:00Z",
        "timezone": "UTC",
    })
    event_id = created.json()["id"]
    original_etag = created.headers["ETag"]

    missing = client.patch(f"/api/calendar/events/{event_id}", headers=ops, json={"title": "Missing guard"})
    assert missing.status_code == 428, missing.text
    accepted = client.patch(
        f"/api/calendar/events/{event_id}",
        headers={**ops, "If-Match": original_etag},
        json={"title": "Accepted guard"},
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.headers["ETag"] != original_etag
    stale = client.patch(
        f"/api/calendar/events/{event_id}",
        headers={**ops, "If-Match": original_etag},
        json={"title": "Stale overwrite"},
    )
    assert stale.status_code == 412, stale.text
    assert stale.headers["ETag"] == accepted.headers["ETag"]

    rejected_null = client.patch(
        f"/api/calendar/events/{event_id}",
        headers={**ops, "If-Match": accepted.headers["ETag"]},
        json={"title": None},
    )
    assert rejected_null.status_code == 422

    canceled = client.post(
        f"/api/calendar/events/{event_id}/cancel",
        headers={**trader, "If-Match": accepted.headers["ETag"]},
    )
    assert canceled.status_code == 200, canceled.text
    denied_restore = client.post(f"/api/calendar/events/{event_id}/restore", headers=trader)
    assert denied_restore.status_code == 403
    status_bypass = client.patch(
        f"/api/calendar/events/{event_id}",
        headers={**trader, "If-Match": canceled.headers["ETag"]},
        json={"status": "confirmed"},
    )
    assert status_bypass.status_code == 422
    detail = client.get(f"/api/calendar/events/{event_id}", headers=ops)
    assert detail.json()["status"] == "canceled"
    assert detail.json()["canceled_at"] is not None


def test_lifecycle_and_reminder_mutations_require_current_event_etag(client: TestClient) -> None:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    calendar = client.post("/api/calendar/calendars", headers=ops, json={"name": f"Mutation ETag {suffix}"}).json()
    created = client.post("/api/calendar/events", headers=ops, json={
        "calendar_id": calendar["id"],
        "title": f"Guard every mutation {suffix}",
        "starts_at": "2026-07-13T15:00:00Z",
        "ends_at": "2026-07-13T16:00:00Z",
        "timezone": "UTC",
    })
    assert created.status_code == 200, created.text
    event_id = created.json()["id"]
    original_etag = created.headers["ETag"]

    missing_cancel = client.post(f"/api/calendar/events/{event_id}/cancel", headers=ops)
    assert missing_cancel.status_code == 428, missing_cancel.text
    canceled = client.post(
        f"/api/calendar/events/{event_id}/cancel",
        headers={**ops, "If-Match": original_etag},
    )
    assert canceled.status_code == 200, canceled.text
    canceled_etag = canceled.headers["ETag"]
    assert canceled_etag != original_etag

    missing_restore = client.post(f"/api/calendar/events/{event_id}/restore", headers=ops)
    assert missing_restore.status_code == 428, missing_restore.text
    stale_restore = client.post(
        f"/api/calendar/events/{event_id}/restore",
        headers={**ops, "If-Match": original_etag},
    )
    assert stale_restore.status_code == 412, stale_restore.text
    assert stale_restore.headers["ETag"] == canceled_etag
    restored = client.post(
        f"/api/calendar/events/{event_id}/restore",
        headers={**ops, "If-Match": canceled_etag},
    )
    assert restored.status_code == 200, restored.text
    restored_etag = restored.headers["ETag"]

    reminder_payload = {"reminder_type": "in_app", "trigger_minutes_before": 20}
    missing_create = client.post(f"/api/calendar/events/{event_id}/reminders", headers=ops, json=reminder_payload)
    assert missing_create.status_code == 428, missing_create.text
    stale_create = client.post(
        f"/api/calendar/events/{event_id}/reminders",
        headers={**ops, "If-Match": canceled_etag},
        json=reminder_payload,
    )
    assert stale_create.status_code == 412, stale_create.text
    reminder = client.post(
        f"/api/calendar/events/{event_id}/reminders",
        headers={**ops, "If-Match": restored_etag},
        json=reminder_payload,
    )
    assert reminder.status_code == 200, reminder.text
    reminder_id = reminder.json()["reminder_id"]
    reminder_etag = reminder.headers["ETag"]

    missing_delete = client.delete(f"/api/calendar/reminders/{reminder_id}", headers=ops)
    assert missing_delete.status_code == 428, missing_delete.text
    stale_delete = client.delete(
        f"/api/calendar/reminders/{reminder_id}",
        headers={**ops, "If-Match": restored_etag},
    )
    assert stale_delete.status_code == 412, stale_delete.text
    deleted = client.delete(
        f"/api/calendar/reminders/{reminder_id}",
        headers={**ops, "If-Match": reminder_etag},
    )
    assert deleted.status_code == 200, deleted.text
    assert deleted.json() == {"reminder_id": reminder_id, "status": "deleted"}
    assert deleted.headers["ETag"] != reminder_etag


def test_direct_commands_reject_malformed_or_oversized_replacements(client: TestClient) -> None:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    calendar = client.post("/api/calendar/calendars", headers=ops, json={"name": f"Limits {suffix}"}).json()
    base = {
        "calendar_id": calendar["id"],
        "title": f"Bounded {suffix}",
        "starts_at": "2026-07-13T13:00:00Z",
        "ends_at": "2026-07-13T14:00:00Z",
        "timezone": "UTC",
    }
    oversized = command(client, ops, "CreateCalendarEvent", {
        **base,
        "participants": [
            {"participant_type": "person", "email": f"person-{index}@example.test"}
            for index in range(101)
        ],
    }, f"calendar-participants-{suffix}")
    assert oversized.status_code == 400, oversized.text
    assert oversized.json()["detail"] == {"error": "participants cannot contain more than 100 items"}

    malformed = command(client, ops, "CreateCalendarEvent", {
        **base,
        "title": f"Malformed {suffix}",
        "participants": ["not-an-object"],
    }, f"calendar-malformed-{suffix}")
    assert malformed.status_code == 400, malformed.text
    assert malformed.json()["detail"] == {"error": "participants entries must be objects"}

    reminders = command(client, ops, "CreateCalendarEvent", {
        **base,
        "title": f"Reminder limit {suffix}",
        "reminders": [{"reminder_type": "in_app", "trigger_minutes_before": index} for index in range(11)],
    }, f"calendar-reminders-{suffix}")
    assert reminders.status_code == 400, reminders.text
    assert reminders.json()["detail"] == {"error": "reminders cannot contain more than 10 items"}


def test_direct_commands_reject_non_object_attrs_without_persisting_invalid_state(client: TestClient) -> None:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200

    invalid_calendar = command(client, ops, "CreateCalendar", {
        "name": f"Invalid attrs {suffix}",
        "attrs": 42,
    }, f"calendar-invalid-attrs-{suffix}")
    assert invalid_calendar.status_code == 400, invalid_calendar.text
    assert invalid_calendar.json()["detail"] == {"error": "attrs must be an object"}

    calendar = client.post("/api/calendar/calendars", headers=ops, json={
        "name": f"Valid attrs {suffix}",
        "timezone": "UTC",
    }).json()
    invalid_calendar_update = command(client, ops, "UpdateCalendar", {
        "calendar_id": calendar["id"],
        "attrs": ["not", "an", "object"],
    }, f"calendar-update-attrs-{suffix}")
    assert invalid_calendar_update.status_code == 400, invalid_calendar_update.text
    assert invalid_calendar_update.json()["detail"] == {"error": "attrs must be an object"}

    event_payload = {
        "calendar_id": calendar["id"],
        "title": f"Attrs event {suffix}",
        "starts_at": "2026-07-13T13:00:00Z",
        "ends_at": "2026-07-13T14:00:00Z",
        "timezone": "UTC",
    }
    invalid_event = command(client, ops, "CreateCalendarEvent", {
        **event_payload,
        "attrs": "not-an-object",
    }, f"calendar-event-attrs-{suffix}")
    assert invalid_event.status_code == 400, invalid_event.text
    assert invalid_event.json()["detail"] == {"error": "attrs must be an object"}

    created = client.post("/api/calendar/events", headers=ops, json=event_payload)
    invalid_event_update = client.post("/api/commands", headers={
        **ops,
        "If-Match": created.headers["ETag"],
    }, json={
        "command_type": "UpdateCalendarEvent",
        "payload": {"event_id": created.json()["id"], "attrs": 42},
        "idempotency_key": f"calendar-event-update-attrs-{suffix}",
    })
    assert invalid_event_update.status_code == 400, invalid_event_update.text
    assert invalid_event_update.json()["detail"] == {"error": "attrs must be an object"}
    detail = client.get(f"/api/calendar/events/{created.json()['id']}", headers=ops)
    assert detail.json()["attrs"] == {}

    with SessionLocal() as db:
        event = db.get(CalendarEvent, created.json()["id"])
        assert event is not None
        event.attrs_json = "42"
        db.commit()
    legacy = client.get(f"/api/calendar/events/{created.json()['id']}", headers=ops)
    legacy_update = client.post("/api/commands", headers={
        **ops,
        "If-Match": legacy.headers["ETag"],
    }, json={
        "command_type": "UpdateCalendarEvent",
        "payload": {"event_id": created.json()["id"], "attrs": {"valid": True}},
        "idempotency_key": f"calendar-event-legacy-attrs-{suffix}",
    })
    assert legacy_update.status_code == 400, legacy_update.text
    assert legacy_update.json()["detail"] == {"error": "stored attrs must be an object"}

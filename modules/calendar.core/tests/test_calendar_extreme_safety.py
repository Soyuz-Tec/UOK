from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from starlette.testclient import TestClient

from uok.host.database import SessionLocal
from uok_calendar_core.models import CalendarEvent

from tests.helpers import auth


def test_calendar_writes_reject_extreme_dates_duration_and_recurrence_horizon(
    client: TestClient,
) -> None:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    calendar = client.post("/api/calendar/calendars", headers=ops, json={
        "name": f"Operational bounds {suffix}",
    }).json()
    base = {"calendar_id": calendar["id"], "title": f"Bounds {suffix}"}

    extreme = client.post("/api/calendar/events", headers=ops, json={
        **base,
        "starts_at": "0001-01-01T00:00:00Z",
        "ends_at": "0001-01-01T01:00:00Z",
    })
    assert extreme.status_code == 400, extreme.text
    assert extreme.json()["detail"] == {"error": "starts_at must be between years 2 and 9998"}

    duration = client.post("/api/calendar/events", headers=ops, json={
        **base,
        "starts_at": "2026-01-01T00:00:00Z",
        "ends_at": "2028-01-01T00:00:00Z",
    })
    assert duration.status_code == 400, duration.text
    assert duration.json()["detail"] == {"error": "event duration cannot exceed 366 days"}

    horizon = client.post("/api/calendar/events", headers=ops, json={
        **base,
        "starts_at": "2026-01-01T09:00:00Z",
        "ends_at": "2026-01-01T10:00:00Z",
        "recurrence_rule": "FREQ=YEARLY;INTERVAL=1000",
    })
    assert horizon.status_code == 400, horizon.text
    assert horizon.json()["detail"] == {"error": "recurrence cannot span more than 366 years"}


def test_extreme_legacy_duration_reads_without_overflow(client: TestClient) -> None:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    calendar = client.post("/api/calendar/calendars", headers=ops, json={
        "name": f"Legacy duration {suffix}",
    }).json()
    created = client.post("/api/calendar/events", headers=ops, json={
        "calendar_id": calendar["id"],
        "title": f"Legacy extreme {suffix}",
        "starts_at": "2026-01-01T00:00:00Z",
        "ends_at": "2026-01-01T01:00:00Z",
    })
    assert created.status_code == 200, created.text
    event_id = created.json()["id"]
    with SessionLocal() as db:
        event = db.get(CalendarEvent, event_id)
        assert event is not None
        event.starts_at = datetime(1, 1, 1, tzinfo=timezone.utc)
        event.ends_at = datetime(9999, 12, 31, 23, 59, tzinfo=timezone.utc)
        event.recurrence_rule = "FREQ=YEARLY;COUNT=2"
        db.commit()

    events = client.get("/api/calendar/events", headers=ops, params={
        "from_at": "2026-01-01T00:00:00Z",
        "to_at": "2027-01-01T00:00:00Z",
        "calendar_id": calendar["id"],
    })
    assert events.status_code == 200, events.text
    assert len(events.json()) == 2
    freebusy = client.get("/api/calendar/freebusy", headers=ops, params={
        "from_at": "2026-01-01T00:00:00Z",
        "to_at": "2027-01-01T00:00:00Z",
        "calendar_id": calendar["id"],
    })
    assert freebusy.status_code == 200, freebusy.text
    assert len(freebusy.json()["busy"]) == 2
    with SessionLocal() as db:
        event = db.get(CalendarEvent, event_id)
        assert event is not None
        event.starts_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
        event.ends_at = datetime(2026, 1, 1, 1, tzinfo=timezone.utc)
        event.recurrence_rule = None
        db.commit()


def test_legacy_sparse_timezone_export_fails_before_vtimezone_amplification(
    client: TestClient,
) -> None:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    calendar = client.post("/api/calendar/calendars", headers=ops, json={
        "name": f"Legacy timezone span {suffix}",
        "timezone": "America/New_York",
    }).json()
    created = client.post("/api/calendar/events", headers=ops, json={
        "calendar_id": calendar["id"],
        "title": f"Legacy sparse {suffix}",
        "starts_at": "2026-01-01T14:00:00Z",
        "ends_at": "2026-01-01T15:00:00Z",
        "timezone": "America/New_York",
        "recurrence_rule": "FREQ=YEARLY;COUNT=2",
    })
    assert created.status_code == 200, created.text
    with SessionLocal() as db:
        event = db.get(CalendarEvent, created.json()["id"])
        assert event is not None
        event.recurrence_rule = "FREQ=YEARLY;INTERVAL=1000;COUNT=8"
        db.commit()

    exported = client.get("/api/calendar/ics/export", headers=ops, params={
        "from_at": "2026-01-01T00:00:00Z",
        "to_at": "2026-01-02T00:00:00Z",
        "calendar_id": calendar["id"],
    })
    assert exported.status_code == 400, exported.text
    assert exported.json()["detail"] == {
        "error": "calendar export timezone span exceeds the operational limit",
    }
    with SessionLocal() as db:
        event = db.get(CalendarEvent, created.json()["id"])
        assert event is not None
        event.recurrence_rule = "FREQ=YEARLY;COUNT=2"
        db.commit()

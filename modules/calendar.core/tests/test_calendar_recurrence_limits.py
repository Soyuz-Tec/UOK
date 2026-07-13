from __future__ import annotations

from time import perf_counter
from uuid import uuid4

from starlette.testclient import TestClient

from uok.db import SessionLocal
from uok_calendar_core.models import CalendarEvent

from tests.helpers import auth


def test_recurrence_writes_normalize_open_series_and_reject_over_limit_boundaries(client: TestClient) -> None:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    calendar = client.post("/api/calendar/calendars", headers=ops, json={
        "name": f"Recurrence limits {suffix}",
        "timezone": "UTC",
    }).json()
    base = {
        "calendar_id": calendar["id"],
        "starts_at": "2026-01-01T09:00:00Z",
        "ends_at": "2026-01-01T10:00:00Z",
        "timezone": "UTC",
    }

    open_series = client.post("/api/calendar/events", headers=ops, json={
        **base,
        "title": f"Open series {suffix}",
        "recurrence_rule": "FREQ=DAILY",
    })
    assert open_series.status_code == 200, open_series.text
    assert open_series.json()["recurrence_rule"] == "FREQ=DAILY;COUNT=366"

    valid_boundary = client.post("/api/calendar/events", headers=ops, json={
        **base,
        "title": f"Valid boundary {suffix}",
        "recurrence_rule": "FREQ=DAILY",
        "recurrence_until": "2027-01-01T09:00:00Z",
    })
    assert valid_boundary.status_code == 200, valid_boundary.text

    over_limit = client.post("/api/calendar/events", headers=ops, json={
        **base,
        "title": f"Over limit {suffix}",
        "recurrence_rule": "FREQ=DAILY",
        "recurrence_until": "2027-01-02T09:00:00Z",
    })
    assert over_limit.status_code == 400, over_limit.text
    assert over_limit.json()["detail"] == {
        "error": "recurrence cannot contain more than 366 effective occurrences",
    }

    embedded_far_future = client.post("/api/calendar/events", headers=ops, json={
        **base,
        "title": f"Embedded over limit {suffix}",
        "recurrence_rule": "FREQ=DAILY;UNTIL=99990101T090000Z",
    })
    assert embedded_far_future.status_code == 400, embedded_far_future.text
    assert embedded_far_future.json()["detail"] == {
        "error": "recurrence cannot contain more than 366 effective occurrences",
    }

    incompatible_boundary = client.post("/api/calendar/events", headers=ops, json={
        **base,
        "title": f"Incompatible boundary {suffix}",
        "recurrence_rule": "FREQ=DAILY;COUNT=2;UNTIL=20260102T090000Z",
    })
    assert incompatible_boundary.status_code == 400, incompatible_boundary.text
    assert incompatible_boundary.json()["detail"] == {
        "error": "recurrence_rule must not contain both COUNT and UNTIL",
    }


def test_legacy_recurrence_reads_and_export_fail_safe_with_bounded_work(client: TestClient) -> None:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    calendar = client.post("/api/calendar/calendars", headers=ops, json={
        "name": f"Legacy recurrence {suffix}",
        "timezone": "UTC",
    }).json()
    created = client.post("/api/calendar/events", headers=ops, json={
        "calendar_id": calendar["id"],
        "title": f"Legacy series {suffix}",
        "starts_at": "2026-01-01T09:00:00Z",
        "ends_at": "2026-01-01T10:00:00Z",
        "timezone": "UTC",
        "recurrence_rule": "FREQ=DAILY;COUNT=2",
    })
    assert created.status_code == 200, created.text
    event_id = created.json()["id"]

    _set_legacy_rule(event_id, "FREQ=DAILY")
    started = perf_counter()
    distant = client.get("/api/calendar/events", headers=ops, params={
        "from_at": "9999-01-01T00:00:00Z",
        "to_at": "9999-01-02T00:00:00Z",
        "calendar_id": calendar["id"],
    })
    assert distant.status_code == 200, distant.text
    assert distant.json() == []
    assert perf_counter() - started < 3.0

    _set_legacy_rule(event_id, "FREQ=DAILY;UNTIL=99990101T090000Z")
    started = perf_counter()
    exported = client.get("/api/calendar/ics/export", headers=ops, params={
        "from_at": "2026-01-01T00:00:00Z",
        "to_at": "2026-01-03T00:00:00Z",
        "calendar_id": calendar["id"],
    })
    assert exported.status_code == 400, exported.text
    assert exported.json()["detail"] == {
        "error": "recurrence cannot contain more than 366 effective occurrences",
    }
    assert perf_counter() - started < 3.0

    _set_legacy_rule(event_id, "FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30")
    invalid = client.get("/api/calendar/events", headers=ops, params={
        "from_at": "2026-01-01T00:00:00Z",
        "to_at": "2026-02-01T00:00:00Z",
        "calendar_id": calendar["id"],
    })
    assert invalid.status_code == 400, invalid.text
    assert "do not identify a valid calendar date" in invalid.text
    _set_legacy_rule(event_id, "FREQ=DAILY;COUNT=2")


def _set_legacy_rule(event_id: str, rule: str) -> None:
    with SessionLocal() as db:
        event = db.get(CalendarEvent, event_id)
        assert event is not None
        event.recurrence_rule = rule
        event.recurrence_until = None
        db.commit()

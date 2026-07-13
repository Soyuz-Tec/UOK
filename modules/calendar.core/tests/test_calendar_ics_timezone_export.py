from __future__ import annotations

from datetime import timezone
from uuid import uuid4

from dateutil.rrule import rrulestr
from icalendar import Calendar as ICalendar
from starlette.testclient import TestClient

from tests.helpers import auth


def test_tzid_export_preserves_dst_wall_time_for_external_expansion(client: TestClient) -> None:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    calendar = client.post("/api/calendar/calendars", headers=ops, json={
        "name": f"TZID export {suffix}",
        "timezone": "America/New_York",
    }).json()
    created = client.post("/api/calendar/events", headers=ops, json={
        "calendar_id": calendar["id"],
        "title": f"DST wall time {suffix}",
        "starts_at": "2026-03-01T14:00:00Z",
        "ends_at": "2026-03-01T15:00:00Z",
        "timezone": "America/New_York",
        "recurrence_rule": "FREQ=WEEKLY",
        "recurrence_until": "2026-03-15T13:00:00Z",
    })
    assert created.status_code == 200, created.text

    exported = client.get("/api/calendar/ics/export", headers=ops, params={
        "from_at": "2026-03-01T00:00:00Z",
        "to_at": "2026-03-31T00:00:00Z",
        "calendar_id": calendar["id"],
    })
    assert exported.status_code == 200, exported.text
    assert exported.text.count("BEGIN:VTIMEZONE") == 1
    assert "TZID:America/New_York" in exported.text
    assert "DTSTART;TZID=America/New_York:20260301T090000" in exported.text
    assert "DTEND;TZID=America/New_York:20260301T100000" in exported.text
    assert "RRULE:FREQ=WEEKLY;UNTIL=20260315T130000Z" in exported.text

    parsed = ICalendar.from_ical(exported.content)
    assert len(parsed.walk("VTIMEZONE")) == 1
    event = parsed.walk("VEVENT")[0]
    external_start = event.decoded("DTSTART")
    external_end = event.decoded("DTEND")
    external_rule = event["RRULE"].to_ical().decode("utf-8")
    starts = list(rrulestr(external_rule, dtstart=external_start))
    assert [row.hour for row in starts] == [9, 9, 9]
    assert [row.astimezone(timezone.utc).hour for row in starts] == [14, 13, 13]
    assert external_end.hour == 10


def test_ics_export_filters_nonoverlapping_master_and_keeps_external_count_bounded(
    client: TestClient,
) -> None:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    calendar = client.post("/api/calendar/calendars", headers=ops, json={
        "name": f"Bounded export {suffix}",
        "timezone": "UTC",
    }).json()
    long_series = client.post("/api/calendar/events", headers=ops, json={
        "calendar_id": calendar["id"],
        "title": f"Duration overlap {suffix}",
        "starts_at": "2026-01-01T00:00:00Z",
        "ends_at": "2026-01-03T00:00:00Z",
        "recurrence_rule": "FREQ=WEEKLY;COUNT=2",
    })
    assert long_series.status_code == 200, long_series.text

    gap = client.get("/api/calendar/ics/export", headers=ops, params={
        "from_at": "2026-01-04T00:00:00Z",
        "to_at": "2026-01-05T00:00:00Z",
        "calendar_id": calendar["id"],
    })
    assert gap.status_code == 200, gap.text
    assert "BEGIN:VEVENT" not in gap.text

    overlap = client.get("/api/calendar/ics/export", headers=ops, params={
        "from_at": "2026-01-09T00:00:00Z",
        "to_at": "2026-01-10T00:00:00Z",
        "calendar_id": calendar["id"],
    })
    assert overlap.status_code == 200, overlap.text
    assert f"SUMMARY:Duration overlap {suffix}" in overlap.text

    exhausted = client.get("/api/calendar/ics/export", headers=ops, params={
        "from_at": "2026-01-15T00:00:00Z",
        "to_at": "2026-01-16T00:00:00Z",
        "calendar_id": calendar["id"],
    })
    assert exhausted.status_code == 200, exhausted.text
    assert "BEGIN:VEVENT" not in exhausted.text

    open_series = client.post("/api/calendar/events", headers=ops, json={
        "calendar_id": calendar["id"],
        "title": f"Bounded external series {suffix}",
        "starts_at": "2026-02-01T09:00:00Z",
        "ends_at": "2026-02-01T10:00:00Z",
        "recurrence_rule": "FREQ=DAILY",
    })
    assert open_series.status_code == 200, open_series.text
    bounded = client.get("/api/calendar/ics/export", headers=ops, params={
        "from_at": "2026-02-01T00:00:00Z",
        "to_at": "2026-02-02T00:00:00Z",
        "calendar_id": calendar["id"],
    })
    parsed = ICalendar.from_ical(bounded.content)
    event = next(row for row in parsed.walk("VEVENT") if "Bounded external" in str(row["SUMMARY"]))
    starts = list(rrulestr(event["RRULE"].to_ical().decode(), dtstart=event.decoded("DTSTART")))
    assert len(starts) == 366

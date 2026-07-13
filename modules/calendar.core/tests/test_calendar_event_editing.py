from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth


def test_recurrence_participants_reminders_and_ics_round_trip(client: TestClient) -> None:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    calendar = client.post("/api/calendar/calendars", headers=ops, json={
        "name": f"DST calendar {suffix}",
        "timezone": "America/New_York",
        "visibility_scope": "organization",
    })
    assert calendar.status_code == 200, calendar.text

    created = client.post("/api/calendar/events", headers=ops, json={
        "calendar_id": calendar.json()["id"],
        "title": f"DST review {suffix}",
        "description": "Original description",
        "location": "Original room",
        "starts_at": "2026-03-01T14:00:00Z",
        "ends_at": "2026-03-01T15:00:00Z",
        "timezone": "America/New_York",
        "recurrence_rule": "FREQ=WEEKLY",
        "recurrence_until": "2026-03-15T13:00:00Z",
        "participants": [{
            "participant_type": "person",
            "email": f"first-{suffix}@example.test",
            "display_name": "First attendee",
        }],
        "reminders": [{"reminder_type": "in_app", "trigger_minutes_before": 30}],
    })
    assert created.status_code == 200, created.text
    event_id = created.json()["id"]
    event_etag = created.headers["ETag"]
    assert [row["email"] for row in created.json()["participants"]] == [f"first-{suffix}@example.test"]
    assert [row["trigger_minutes_before"] for row in created.json()["reminders"]] == [30]

    occurrences = client.get(
        "/api/calendar/events",
        headers=ops,
        params={
            "from_at": "2026-03-01T00:00:00Z",
            "to_at": "2026-03-31T00:00:00Z",
            "calendar_id": calendar.json()["id"],
        },
    )
    assert occurrences.status_code == 200, occurrences.text
    assert [row["occurrence_start"] for row in occurrences.json()] == [
        "2026-03-01T14:00:00+00:00",
        "2026-03-08T13:00:00+00:00",
        "2026-03-15T13:00:00+00:00",
    ]

    exported = client.get(
        "/api/calendar/ics/export",
        headers=ops,
        params={
            "from_at": "2026-03-01T00:00:00Z",
            "to_at": "2026-03-31T00:00:00Z",
            "calendar_id": calendar.json()["id"],
        },
    )
    assert exported.status_code == 200, exported.text
    assert "RRULE:FREQ=WEEKLY;UNTIL=20260315T130000Z" in exported.text
    assert f"ATTENDEE;CN=\"First attendee\";ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION:mailto:first-{suffix}@example.test" in exported.text.replace("\r\n ", "")
    assert "BEGIN:VALARM\r\nACTION:DISPLAY" in exported.text
    assert "TRIGGER:-PT30M" in exported.text

    updated = client.patch(f"/api/calendar/events/{event_id}", headers={**ops, "If-Match": event_etag}, json={
        "description": None,
        "location": None,
        "participants": [{
            "participant_type": "person",
            "email": f"second-{suffix}@example.test",
            "display_name": "Second attendee",
            "response_status": "accepted",
        }],
        "reminders": [{"reminder_type": "in_app", "trigger_minutes_before": 15}],
    })
    assert updated.status_code == 200, updated.text
    body = updated.json()
    assert body["description"] is None
    assert body["location"] is None
    assert [row["email"] for row in body["participants"]] == [f"second-{suffix}@example.test"]
    assert [row["response_status"] for row in body["participants"]] == ["accepted"]
    assert [row["trigger_minutes_before"] for row in body["reminders"]] == [15]
    event_etag = updated.headers["ETag"]

    cleared = client.patch(f"/api/calendar/events/{event_id}", headers={**ops, "If-Match": event_etag}, json={
        "recurrence_rule": "",
        "recurrence_until": None,
        "participants": [],
        "reminders": [],
    })
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["recurrence_rule"] is None
    assert cleared.json()["recurrence_until"] is None
    assert cleared.json()["participants"] == []
    assert cleared.json()["reminders"] == []


def test_clearing_recurrence_rule_also_clears_stored_boundary(client: TestClient) -> None:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    calendar = client.post("/api/calendar/calendars", headers=ops, json={
        "name": f"Recurrence clear {suffix}",
        "timezone": "UTC",
    }).json()
    created = client.post("/api/calendar/events", headers=ops, json={
        "calendar_id": calendar["id"],
        "title": f"Series {suffix}",
        "starts_at": "2026-07-13T13:00:00Z",
        "ends_at": "2026-07-13T14:00:00Z",
        "timezone": "UTC",
        "recurrence_rule": "FREQ=WEEKLY",
        "recurrence_until": "2026-08-13T13:00:00Z",
    })
    assert created.status_code == 200, created.text

    boundary_cleared = client.patch(
        f"/api/calendar/events/{created.json()['id']}",
        headers={**ops, "If-Match": created.headers["ETag"]},
        json={"recurrence_until": None},
    )
    assert boundary_cleared.status_code == 200, boundary_cleared.text
    assert boundary_cleared.json()["recurrence_rule"] == "FREQ=WEEKLY;COUNT=366"
    assert boundary_cleared.json()["recurrence_until"] is None

    cleared = client.patch(
        f"/api/calendar/events/{created.json()['id']}",
        headers={**ops, "If-Match": boundary_cleared.headers["ETag"]},
        json={"recurrence_rule": None},
    )
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["recurrence_rule"] is None
    assert cleared.json()["recurrence_until"] is None


def test_all_day_export_and_invalid_participant_fail_closed(client: TestClient) -> None:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    calendar = client.post("/api/calendar/calendars", headers=ops, json={
        "name": f"All-day calendar {suffix}",
        "timezone": "America/New_York",
    }).json()

    invalid = client.post("/api/calendar/events", headers=ops, json={
        "calendar_id": calendar["id"],
        "title": "Invalid participant",
        "starts_at": "2026-07-13T13:00:00Z",
        "ends_at": "2026-07-13T14:00:00Z",
        "timezone": "America/New_York",
        "participants": [{"participant_type": "person", "display_name": "Missing identity"}],
    })
    assert invalid.status_code == 400
    assert invalid.json()["detail"] == {"error": "participant requires participant_id or email"}

    injected = client.post("/api/calendar/events", headers=ops, json={
        "calendar_id": calendar["id"],
        "title": "Injected participant",
        "starts_at": "2026-07-13T13:00:00Z",
        "ends_at": "2026-07-13T14:00:00Z",
        "timezone": "America/New_York",
        "participants": [{
            "participant_type": "person",
            "email": "safe@example.test\r\nX-INJECTED:true",
            "display_name": "Unsafe\r\nATTENDEE:mailto:other@example.test",
        }],
    })
    assert injected.status_code == 400
    assert "control characters" in injected.text

    created = client.post("/api/calendar/events", headers=ops, json={
        "calendar_id": calendar["id"],
        "title": f"All day {suffix}",
        "starts_at": "2026-07-13T13:00:00Z",
        "ends_at": "2026-07-13T14:00:00Z",
        "timezone": "America/New_York",
        "all_day": True,
        "recurrence_rule": "FREQ=WEEKLY",
        "recurrence_until": "2026-07-20T04:00:00Z",
    })
    assert created.status_code == 200, created.text
    assert created.json()["starts_at"] == "2026-07-13T04:00:00+00:00"
    assert created.json()["ends_at"] == "2026-07-14T04:00:00+00:00"
    exported = client.get("/api/calendar/ics/export", headers=ops, params={
        "from_at": "2026-07-13T00:00:00Z",
        "to_at": "2026-07-15T00:00:00Z",
        "calendar_id": calendar["id"],
    })
    assert exported.status_code == 200, exported.text
    assert "DTSTART;VALUE=DATE:20260713" in exported.text
    assert "DTEND;VALUE=DATE:20260714" in exported.text
    assert "RRULE:FREQ=WEEKLY;UNTIL=20260720" in exported.text

    invalid_range = client.get("/api/calendar/ics/export", headers=ops, params={
        "from_at": "2026-07-15T00:00:00Z",
        "to_at": "2026-07-13T00:00:00Z",
    })
    assert invalid_range.status_code == 400

    rezoned = client.patch(
        f"/api/calendar/events/{created.json()['id']}",
        headers={**ops, "If-Match": created.headers["ETag"]},
        json={"timezone": "UTC"},
    )
    assert rezoned.status_code == 200, rezoned.text
    assert rezoned.json()["starts_at"] == "2026-07-13T00:00:00+00:00"
    assert rezoned.json()["ends_at"] == "2026-07-14T00:00:00+00:00"


def test_final_long_recurrence_occurrence_can_overlap_after_its_start_boundary(client: TestClient) -> None:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    calendar = client.post("/api/calendar/calendars", headers=ops, json={"name": f"Overlap {suffix}"}).json()
    created = client.post("/api/calendar/events", headers=ops, json={
        "calendar_id": calendar["id"],
        "title": f"Long series {suffix}",
        "starts_at": "2026-07-01T00:00:00Z",
        "ends_at": "2026-07-03T00:00:00Z",
        "timezone": "UTC",
        "recurrence_rule": "FREQ=DAILY",
        "recurrence_until": "2026-07-10T00:00:00Z",
    })
    assert created.status_code == 200, created.text
    rows = client.get("/api/calendar/events", headers=ops, params={
        "from_at": "2026-07-11T00:00:00Z",
        "to_at": "2026-07-12T00:00:00Z",
        "calendar_id": calendar["id"],
    })
    assert rows.status_code == 200, rows.text
    assert [(row["occurrence_start"], row["occurrence_end"]) for row in rows.json()] == [
        ("2026-07-10T00:00:00+00:00", "2026-07-12T00:00:00+00:00"),
    ]

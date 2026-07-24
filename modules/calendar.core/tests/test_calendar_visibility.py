from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth
from uok.kernel.security import Actor
from uok_calendar_core.access import can_read_calendar
from uok_calendar_core.models import Calendar


WINDOW = "from_at=2031-03-01T00%3A00%3A00Z&to_at=2031-03-10T00%3A00%3A00Z"


def test_private_and_reserved_team_scopes_are_owner_or_manager_only() -> None:
    owner = Actor("owner", "owner", "org", "trader")
    reader = Actor("reader", "reader", "org", "viewer")
    manager = Actor("manager", "manager", "org", "ops_manager")
    for scope in ("private", "team"):
        calendar = Calendar(
            id=f"calendar-{scope}",
            organization_id="org",
            owner_user_id=owner.user_id,
            name=scope,
            visibility_scope=scope,
            timezone="UTC",
            status="active",
        )
        assert can_read_calendar(owner, calendar) is True
        assert can_read_calendar(manager, calendar) is True
        assert can_read_calendar(reader, calendar) is False


def _calendar(client: TestClient, headers: dict[str, str], name: str, scope: str) -> dict:
    response = client.post("/api/calendar/calendars", headers=headers, json={
        "name": name,
        "timezone": "UTC",
        "visibility_scope": scope,
    })
    assert response.status_code == 200, response.text
    return response.json()


def _event(client: TestClient, headers: dict[str, str], calendar_id: str, title: str, hour: int) -> dict:
    response = client.post("/api/calendar/events", headers=headers, json={
        "calendar_id": calendar_id,
        "title": title,
        "starts_at": f"2031-03-04T{hour:02d}:00:00Z",
        "ends_at": f"2031-03-04T{hour + 1:02d}:00:00Z",
        "timezone": "UTC",
    })
    assert response.status_code == 200, response.text
    return response.json()


def test_calendar_visibility_filters_every_read_surface_and_deleted_parents(client: TestClient) -> None:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    viewer = auth(client, "viewer", "viewer123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200

    organization = _calendar(client, ops, f"Organization {suffix}", "organization")
    private = _calendar(client, ops, f"Private {suffix}", "private")
    team = _calendar(client, ops, f"Reserved team {suffix}", "team")
    deleted = _calendar(client, ops, f"Deleted {suffix}", "organization")
    organization_event = _event(client, ops, organization["id"], f"Organization event {suffix}", 9)
    private_event = _event(client, ops, private["id"], f"Private event {suffix}", 11)
    team_event = _event(client, ops, team["id"], f"Team event {suffix}", 13)
    deleted_event = _event(client, ops, deleted["id"], f"Deleted event {suffix}", 15)
    assert client.delete(
        f"/api/calendar/calendars/{deleted['id']}",
        headers={**ops, "If-Match": deleted["etag"]},
    ).status_code == 200

    viewer_calendar_ids = {row["id"] for row in client.get("/api/calendar/calendars", headers=viewer).json()}
    assert organization["id"] in viewer_calendar_ids
    assert {private["id"], team["id"], deleted["id"]}.isdisjoint(viewer_calendar_ids)
    admin_calendar_ids = {row["id"] for row in client.get("/api/calendar/calendars", headers=admin).json()}
    assert {organization["id"], private["id"], team["id"]}.issubset(admin_calendar_ids)

    visible_events = client.get(f"/api/calendar/events?{WINDOW}", headers=viewer)
    assert visible_events.status_code == 200, visible_events.text
    visible_event_ids = {row["id"] for row in visible_events.json()}
    assert organization_event["id"] in visible_event_ids
    assert {private_event["id"], team_event["id"], deleted_event["id"]}.isdisjoint(visible_event_ids)
    owner_events = client.get(f"/api/calendar/events?{WINDOW}", headers=ops).json()
    assert deleted_event["id"] not in {row["id"] for row in owner_events}

    for hidden_event in (private_event, team_event, deleted_event):
        detail = client.get(f"/api/calendar/events/{hidden_event['id']}", headers=viewer)
        assert detail.status_code == 404
        assert detail.json()["detail"] == "calendar event not found"

    freebusy = client.get(f"/api/calendar/freebusy?{WINDOW}", headers=viewer)
    assert freebusy.status_code == 200, freebusy.text
    busy_rows = freebusy.json()["busy"]
    assert {
        "start": "2031-03-04T09:00:00+00:00",
        "end": "2031-03-04T10:00:00+00:00",
    } in busy_rows
    assert all(set(row) == {"start", "end"} for row in busy_rows)

    exported = client.get(f"/api/calendar/ics/export?{WINDOW}", headers=viewer)
    assert exported.status_code == 200, exported.text
    assert f"SUMMARY:Organization event {suffix}" in exported.text
    assert f"SUMMARY:Private event {suffix}" not in exported.text
    assert f"SUMMARY:Team event {suffix}" not in exported.text
    assert f"SUMMARY:Deleted event {suffix}" not in exported.text


def test_hidden_calendar_event_and_reminder_mutations_are_generic_not_found(client: TestClient) -> None:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    trader = auth(client, "trader", "trader123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200

    private = _calendar(client, ops, f"Private mutation {suffix}", "private")
    event = _event(client, ops, private["id"], f"Protected event {suffix}", 10)
    event_detail = client.get(f"/api/calendar/events/{event['id']}", headers=ops)
    reminder = client.post(f"/api/calendar/events/{event['id']}/reminders", headers={
        **ops,
        "If-Match": event_detail.headers["ETag"],
    }, json={
        "reminder_type": "in_app",
        "trigger_minutes_before": 30,
    })
    assert reminder.status_code == 200, reminder.text
    reminder_id = reminder.json()["reminder_id"]

    update = client.patch(f"/api/calendar/events/{event['id']}", headers=trader, json={"title": "Leaked update"})
    assert update.status_code == 400
    assert update.json()["detail"] == {"error": "calendar event not found"}

    hidden_delete = client.delete(f"/api/calendar/reminders/{reminder_id}", headers=trader)
    missing_delete = client.delete("/api/calendar/reminders/00000000-0000-0000-0000-000000000000", headers=trader)
    assert hidden_delete.status_code == missing_delete.status_code == 400
    assert hidden_delete.json() == missing_delete.json() == {
        "detail": {"error": "calendar reminder not found"},
    }

    detail = client.get(f"/api/calendar/events/{event['id']}", headers=ops)
    assert detail.status_code == 200, detail.text
    assert detail.json()["title"] == f"Protected event {suffix}"
    assert [row["id"] for row in detail.json()["reminders"]] == [reminder_id]

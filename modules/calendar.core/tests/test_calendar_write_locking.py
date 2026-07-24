from __future__ import annotations

from typing import Any
from uuid import uuid4

import pytest
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Session
from starlette.testclient import TestClient

from tests.helpers import auth
from uok.host.database import engine
from uok.host.security import parse_token
from uok.kernel.security import Actor
from uok_calendar_core.concurrency import (
    locked_event_and_reminder_for_update,
    locked_event_for_update,
)
from uok_calendar_core.models import Calendar, CalendarEvent, CalendarReminder, utcnow


class _RecordingSession:
    def __init__(self, responses: list[Any]):
        self.responses = list(responses)
        self.statements: list[Any] = []

    def scalar(self, statement: Any) -> Any:
        self.statements.append(statement)
        return self.responses.pop(0)


def _sql(statement: Any) -> str:
    return " ".join(str(statement.compile(
        dialect=postgresql.dialect(),
        compile_kwargs={"literal_binds": True},
    )).split())


def _actor() -> Actor:
    return Actor("user-1", "admin", "org-1", "platform_admin")


def _calendar() -> Calendar:
    return Calendar(
        id="calendar-1",
        organization_id="org-1",
        owner_user_id="user-1",
        name="Calendar",
        visibility_scope="organization",
        timezone="UTC",
        status="active",
    )


def test_event_and_reminder_lock_chains_are_parent_first_and_refresh_rows() -> None:
    calendar = _calendar()
    event = CalendarEvent(
        id="event-1",
        organization_id="org-1",
        calendar_id=calendar.id,
    )
    reminder = CalendarReminder(
        id="reminder-1",
        organization_id="org-1",
        event_id=event.id,
    )

    event_session = _RecordingSession([calendar.id, calendar, event])
    assert locked_event_for_update(event_session, _actor(), event.id) is event  # type: ignore[arg-type]
    event_sql = [_sql(statement) for statement in event_session.statements]
    assert "FOR UPDATE" not in event_sql[0]
    assert "FROM calendars" in event_sql[1] and event_sql[1].endswith("FOR UPDATE")
    assert "FROM calendar_events" in event_sql[2] and event_sql[2].endswith("FOR UPDATE")
    assert event_session.statements[1].get_execution_options()["populate_existing"] is True
    assert event_session.statements[2].get_execution_options()["populate_existing"] is True

    reminder_session = _RecordingSession([event.id, calendar.id, calendar, event, reminder])
    locked_event, locked_reminder = locked_event_and_reminder_for_update(  # type: ignore[arg-type]
        reminder_session,
        _actor(),
        reminder.id,
    )
    assert (locked_event, locked_reminder) == (event, reminder)
    reminder_sql = [_sql(statement) for statement in reminder_session.statements]
    locking_sql = [statement for statement in reminder_sql if "FOR UPDATE" in statement]
    assert [
        "FROM calendars" in locking_sql[0],
        "FROM calendar_events" in locking_sql[1],
        "FROM calendar_reminders" in locking_sql[2],
    ] == [True, True, True]
    for statement in reminder_session.statements[2:]:
        assert statement.get_execution_options()["populate_existing"] is True


def test_event_writer_refreshes_cached_parent_and_rejects_deleted_state(client: TestClient) -> None:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    calendar = client.post("/api/calendar/calendars", headers=ops, json={
        "name": f"Lock refresh {suffix}",
        "timezone": "UTC",
        "visibility_scope": "organization",
    }).json()
    event = client.post("/api/calendar/events", headers=ops, json={
        "calendar_id": calendar["id"],
        "title": f"Lock refresh event {suffix}",
        "starts_at": "2034-01-04T09:00:00Z",
        "ends_at": "2034-01-04T10:00:00Z",
        "timezone": "UTC",
    }).json()
    actor = parse_token(ops["Authorization"].split(" ", 1)[1])

    with Session(bind=engine, expire_on_commit=False) as writer:
        cached = writer.get(Calendar, calendar["id"])
        assert cached is not None and cached.status == "active"
        writer.commit()
        with Session(bind=engine) as deleter:
            current = deleter.get(Calendar, calendar["id"])
            assert current is not None
            current.status = "deleted"
            current.deleted_at = utcnow()
            current.updated_at = utcnow()
            deleter.commit()

        assert cached.status == "active"
        with pytest.raises(ValueError, match="calendar event not found"):
            locked_event_for_update(writer, actor, event["id"])
        assert cached.status == "deleted"

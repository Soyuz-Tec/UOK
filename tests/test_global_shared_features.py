from __future__ import annotations

from types import SimpleNamespace

from sqlalchemy import select

from uok.data_exchange import csv_dict_rows, safe_spreadsheet_cell
from uok.db import SessionLocal
from uok.models import EventRecord
from uok.module_events import emit_module_event


def test_data_exchange_guards_csv_rows_and_spreadsheet_cells() -> None:
    rows = csv_dict_rows("name,email\nAlice,alice@example.test\n", 1024, 5)

    assert rows == [(2, {"name": "Alice", "email": "alice@example.test"})]
    assert safe_spreadsheet_cell("=1+1") == "'=1+1"
    assert safe_spreadsheet_cell(" plain ") == " plain "


def test_module_event_helper_records_actor_and_sequence(client) -> None:
    actor = SimpleNamespace(user_id="user-test", username="tester", organization_id="org-test")
    with SessionLocal() as db:
        emit_module_event(db, actor, "SharedFeatureTested", "SharedFeature", "feature-1", {"ok": True})
        db.commit()
        event = db.scalar(select(EventRecord).where(EventRecord.event_type == "SharedFeatureTested"))

    assert event is not None
    assert event.organization_id == "org-test"
    assert event.sequence >= 1
    assert "actor_username" in event.payload_json

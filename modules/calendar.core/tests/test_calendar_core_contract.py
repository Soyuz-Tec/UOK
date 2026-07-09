from __future__ import annotations

from datetime import datetime, timezone

from uok.module_manifest_loader import load_module_manifests
from uok_calendar_core.recurrence import validate_rrule
from uok_calendar_core.validation import as_utc_datetime, valid_timezone


def test_calendar_manifest_declares_core_extensions():
    manifest = load_module_manifests()["calendar.core"]
    assert manifest["api_router"] == "uok_calendar_core.api:router"
    assert manifest["command_handlers"] == "uok_calendar_core.commands:command_handlers"
    assert manifest["command_permissions"] == "uok_calendar_core.commands:command_permissions"
    assert "calendar.read" in manifest["permissions"]


def test_calendar_timezone_validation_accepts_iana_name():
    assert valid_timezone("America/New_York") == "America/New_York"


def test_calendar_datetimes_must_be_timezone_aware():
    value = as_utc_datetime("2026-07-09T14:00:00-04:00", "starts_at")
    assert value.tzinfo == timezone.utc


def test_calendar_rrule_normalization_is_limited():
    start = datetime(2026, 7, 9, 14, 0, tzinfo=timezone.utc)
    assert validate_rrule("FREQ=WEEKLY;COUNT=4", start) == "FREQ=WEEKLY;COUNT=4"

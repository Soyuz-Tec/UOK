from __future__ import annotations

from datetime import datetime, timezone
from time import perf_counter
from zoneinfo import ZoneInfo

import pytest

from uok_calendar_core.recurrence import (
    expanded_starts,
    rrule_for_export,
    validate_recurrence_until_limit,
    validate_rrule,
)


def test_weekly_recurrence_preserves_local_wall_clock_across_dst() -> None:
    starts_at = datetime(2026, 3, 1, 14, 0, tzinfo=timezone.utc)

    rows = expanded_starts(
        "FREQ=WEEKLY;COUNT=4",
        starts_at,
        datetime(2026, 3, 1, tzinfo=timezone.utc),
        datetime(2026, 4, 1, tzinfo=timezone.utc),
        timezone_name="America/New_York",
    )

    local_rows = [row.astimezone(ZoneInfo("America/New_York")) for row in rows]
    assert [row.hour for row in local_rows] == [9, 9, 9, 9]
    assert [row.hour for row in rows] == [14, 13, 13, 13]


def test_stored_recurrence_until_is_an_inclusive_occurrence_boundary() -> None:
    starts_at = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)
    until = datetime(2026, 1, 15, 9, 0, tzinfo=timezone.utc)

    rows = expanded_starts(
        "FREQ=WEEKLY",
        starts_at,
        datetime(2026, 1, 1, tzinfo=timezone.utc),
        datetime(2026, 2, 1, tzinfo=timezone.utc),
        recurrence_until=until,
    )

    assert rows == [
        datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc),
        datetime(2026, 1, 8, 9, 0, tzinfo=timezone.utc),
        datetime(2026, 1, 15, 9, 0, tzinfo=timezone.utc),
    ]


def test_ics_rule_combines_count_and_stored_end_without_overexpanding() -> None:
    starts_at = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)

    rule = rrule_for_export(
        "FREQ=WEEKLY;COUNT=4",
        starts_at,
        "UTC",
        datetime(2026, 1, 15, 9, 0, tzinfo=timezone.utc),
    )

    assert rule == "FREQ=WEEKLY;UNTIL=20260115T090000Z"


def test_all_day_export_uses_date_until_and_count_must_be_positive() -> None:
    starts_at = datetime(2026, 7, 13, 4, 0, tzinfo=timezone.utc)
    rule = rrule_for_export(
        "FREQ=WEEKLY",
        starts_at,
        "America/New_York",
        datetime(2026, 7, 27, 4, 0, tzinfo=timezone.utc),
        all_day=True,
    )
    assert rule == "FREQ=WEEKLY;UNTIL=20260727"

    with pytest.raises(ValueError, match="COUNT must be between 1 and 366"):
        expanded_starts(
            "FREQ=DAILY;COUNT=0",
            starts_at,
            starts_at,
            datetime(2026, 8, 1, tzinfo=timezone.utc),
            timezone_name="America/New_York",
        )


def test_open_series_normalize_to_finite_count_and_preserve_maximum_count() -> None:
    starts_at = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)

    assert validate_rrule("FREQ=DAILY", starts_at) == "FREQ=DAILY;COUNT=366"
    assert validate_rrule("FREQ=DAILY;COUNT=366", starts_at) == "FREQ=DAILY;COUNT=366"
    assert rrule_for_export("FREQ=DAILY", starts_at, "UTC", None) == "FREQ=DAILY;COUNT=366"


def test_explicit_and_embedded_boundaries_reject_more_than_366_occurrences() -> None:
    starts_at = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)
    validate_recurrence_until_limit(
        "FREQ=DAILY", starts_at, "UTC", datetime(2027, 1, 1, 9, 0, tzinfo=timezone.utc),
    )

    with pytest.raises(ValueError, match="more than 366 effective occurrences"):
        validate_recurrence_until_limit(
            "FREQ=DAILY", starts_at, "UTC", datetime(2027, 1, 2, 9, 0, tzinfo=timezone.utc),
        )
    with pytest.raises(ValueError, match="more than 366 effective occurrences"):
        validate_rrule("FREQ=DAILY;UNTIL=99990101T090000Z", starts_at)


def test_rule_rejects_rfc_incompatible_count_and_until_pair() -> None:
    starts_at = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)

    with pytest.raises(ValueError, match="must not contain both COUNT and UNTIL"):
        validate_rrule("FREQ=DAILY;COUNT=2;UNTIL=20260102T090000Z", starts_at)


def test_recurrence_horizon_allows_annual_max_but_rejects_sparse_centuries() -> None:
    starts_at = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)

    assert validate_rrule("FREQ=YEARLY;COUNT=366", starts_at) == "FREQ=YEARLY;COUNT=366"
    with pytest.raises(ValueError, match="cannot span more than 366 years"):
        validate_rrule("FREQ=YEARLY;INTERVAL=2;COUNT=366", starts_at)


def test_legacy_far_future_read_and_export_are_bounded() -> None:
    starts_at = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)
    started = perf_counter()
    rows = expanded_starts(
        "FREQ=DAILY",
        starts_at,
        datetime(9999, 1, 1, tzinfo=timezone.utc),
        datetime(9999, 1, 2, tzinfo=timezone.utc),
    )
    assert rows == []
    assert perf_counter() - started < 1.0

    started = perf_counter()
    with pytest.raises(ValueError, match="more than 366 effective occurrences"):
        rrule_for_export("FREQ=DAILY;UNTIL=99990101T090000Z", starts_at, "UTC", None)
    assert perf_counter() - started < 1.0


def test_impossible_month_day_combination_fails_before_dateutil_iteration() -> None:
    starts_at = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)
    started = perf_counter()
    with pytest.raises(ValueError, match="do not identify a valid calendar date"):
        validate_rrule("FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30", starts_at)
    assert perf_counter() - started < 0.5

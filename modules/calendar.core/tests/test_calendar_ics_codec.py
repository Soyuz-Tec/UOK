from __future__ import annotations

from datetime import date, datetime, timezone
from types import SimpleNamespace

import pytest

from uok_calendar_core.ics_codec import _date_values, _fold
from uok_calendar_core import ics_timezone


def test_ics_folding_uses_utf8_octets_and_preserves_content() -> None:
    source = "SUMMARY:" + ("Réunion " * 20)

    folded = _fold(source)

    assert all(len(line.encode("utf-8")) <= 75 for line in folded)
    assert folded[0] + "".join(line[1:] for line in folded[1:]) == source


def test_all_day_ics_uses_exclusive_date_end_in_event_timezone() -> None:
    event = SimpleNamespace(
        timezone="America/New_York",
        starts_at=datetime(2026, 7, 13, 13, 0, tzinfo=timezone.utc),
        ends_at=datetime(2026, 7, 13, 14, 0, tzinfo=timezone.utc),
    )

    assert _date_values(event) == ("20260713", "20260714")


def test_vtimezone_serialized_size_ceiling_fails_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    class OversizedTimezone:
        def to_ical(self) -> bytes:
            return b"X" * (ics_timezone.MAX_VTIMEZONE_BYTES + 1)

    def oversized(*_args: object, **_kwargs: object) -> OversizedTimezone:
        return OversizedTimezone()

    ics_timezone._timezone_lines.cache_clear()
    monkeypatch.setattr(ics_timezone.Timezone, "from_tzid", oversized)
    with pytest.raises(ValueError, match="timezone component exceeds the export size limit"):
        ics_timezone._timezone_lines(
            "America/New_York",
            date(2026, 1, 1),
            date(2027, 1, 1),
        )
    ics_timezone._timezone_lines.cache_clear()

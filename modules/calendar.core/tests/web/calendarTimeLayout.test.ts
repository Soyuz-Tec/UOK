import { describe, expect, it } from "vitest";

import { layoutCalendarDay } from "../../web/src/calendarTimeLayout";
import type { CalendarEventRecord } from "../../web/src/calendarTypes";

function event(id: string, start: string, end: string, allDay = false): CalendarEventRecord {
  return {
    id,
    calendar_id: "calendar-1",
    title: id,
    status: "confirmed",
    occurrence_start: start,
    occurrence_end: end,
    timezone: "UTC",
    transparency: "busy",
    all_day: allDay,
  };
}

describe("calendar time layout", () => {
  const day = new Date(2026, 6, 10);

  it("renders a timed event once with exact wall-clock geometry", () => {
    const layout = layoutCalendarDay([event("review", "2026-07-10T10:30:00", "2026-07-10T12:15:00")], day);
    expect(layout.timed).toHaveLength(1);
    expect(layout.timed[0]).toMatchObject({ startMinute: 630, endMinute: 735, lane: 0, laneCount: 1 });
  });

  it("clips a midnight-spanning event to each visible day", () => {
    const overnight = event("overnight", "2026-07-09T20:00:00", "2026-07-10T10:00:00");
    expect(layoutCalendarDay([overnight], day).timed[0]).toMatchObject({ startMinute: 0, endMinute: 600 });
    expect(layoutCalendarDay([overnight], new Date(2026, 6, 9)).timed[0]).toMatchObject({ startMinute: 1200, endMinute: 1440 });
  });

  it("assigns overlap lanes and separates all-day events", () => {
    const layout = layoutCalendarDay([
      event("left", "2026-07-10T09:00:00", "2026-07-10T11:00:00"),
      event("right", "2026-07-10T10:00:00", "2026-07-10T12:00:00"),
      event("all-day", "2026-07-10T00:00:00", "2026-07-11T00:00:00", true),
    ], day);
    expect(layout.timed.map(({ lane, laneCount }) => ({ lane, laneCount }))).toEqual([{ lane: 0, laneCount: 2 }, { lane: 1, laneCount: 2 }]);
    expect(layout.allDay.map((row) => row.id)).toEqual(["all-day"]);
  });
});

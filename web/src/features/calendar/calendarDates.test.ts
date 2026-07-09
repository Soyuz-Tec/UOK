import { describe, expect, it } from "vitest";

import { dayKey, eventsForDay, monthCells, rangeForView } from "./calendarDates";
import type { CalendarEventRecord } from "./calendarTypes";

describe("calendar date helpers", () => {
  it("builds a stable six-week month grid", () => {
    const cells = monthCells(new Date(2026, 6, 9));
    expect(cells).toHaveLength(42);
    expect(dayKey(cells[0])).toBe("2026-06-28");
    expect(dayKey(cells[41])).toBe("2026-08-08");
  });

  it("returns view windows for day, week, and month", () => {
    expect(dayKey(rangeForView("day", new Date(2026, 6, 9)).from)).toBe("2026-07-09");
    expect(dayKey(rangeForView("week", new Date(2026, 6, 9)).from)).toBe("2026-07-05");
    expect(dayKey(rangeForView("month", new Date(2026, 6, 9)).from)).toBe("2026-06-28");
  });

  it("finds events that overlap a visible day", () => {
    const events: CalendarEventRecord[] = [{
      id: "event-1",
      calendar_id: "calendar-1",
      title: "Review",
      status: "confirmed",
      occurrence_start: "2026-07-10T10:00:00.000Z",
      occurrence_end: "2026-07-10T11:00:00.000Z",
      timezone: "UTC",
      transparency: "busy",
    }];
    expect(eventsForDay(events, new Date("2026-07-10T12:00:00")).map((event) => event.title)).toEqual(["Review"]);
  });
});

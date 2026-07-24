import { describe, expect, it } from "vitest";

import { filterCalendarEvents } from "../../web/src/calendarFilters";
import type { CalendarEventRecord } from "../../web/src/calendarTypes";

const baseEvent: CalendarEventRecord = {
  id: "event-1",
  calendar_id: "calendar-1",
  title: "Operations review",
  status: "confirmed",
  occurrence_start: "2026-07-09T09:00:00Z",
  occurrence_end: "2026-07-09T10:00:00Z",
  timezone: "UTC",
  transparency: "busy",
};

describe("filterCalendarEvents", () => {
  it("filters by text, canceled state, and availability", () => {
    const events = [
      baseEvent,
      { ...baseEvent, id: "event-2", title: "Planning block", status: "canceled" },
      { ...baseEvent, id: "event-3", title: "Focus time", transparency: "free", location: "Desk" },
    ];

    expect(filterCalendarEvents(events, "review", "active", "all").map((event) => event.id)).toEqual(["event-1"]);
    expect(filterCalendarEvents(events, "", "canceled", "all").map((event) => event.id)).toEqual(["event-2"]);
    expect(filterCalendarEvents(events, "desk", "active", "free").map((event) => event.id)).toEqual(["event-3"]);
  });
});

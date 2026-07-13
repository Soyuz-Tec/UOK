import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

import { CalendarTimeGrid } from "../../web/src/CalendarTimeGrid";
import type { CalendarEventRecord } from "../../web/src/calendarTypes";

describe("CalendarTimeGrid", () => {
  it("renders each timed event once, a separate all-day lane, and every hour target", () => {
    const events: CalendarEventRecord[] = [
      {
        id: "timed",
        calendar_id: "calendar-1",
        title: "Design review",
        status: "confirmed",
        occurrence_start: "2026-07-10T10:00:00",
        occurrence_end: "2026-07-10T12:00:00",
        timezone: "UTC",
        transparency: "busy",
      },
      {
        id: "all-day",
        calendar_id: "calendar-1",
        title: "Release day",
        status: "confirmed",
        occurrence_start: "2026-07-10T00:00:00",
        occurrence_end: "2026-07-11T00:00:00",
        timezone: "UTC",
        transparency: "busy",
        all_day: true,
      },
    ];

    const { container } = render(
      <CalendarTimeGrid
        view="day"
        cursorDate={new Date(2026, 6, 10)}
        events={events}
        calendarColors={{ "calendar-1": "#2563EB" }}
        onSelectDay={vi.fn()}
        onSelectEvent={vi.fn()}
      />
    );

    expect(screen.getAllByRole("button", { name: /Design review/ })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Release day" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Create event on/ })).toHaveLength(24);
    const seven = container.querySelector<HTMLButtonElement>('[data-calendar-day="0"][data-calendar-hour="7"]');
    const eight = container.querySelector<HTMLButtonElement>('[data-calendar-day="0"][data-calendar-hour="8"]');
    expect(seven).toHaveAttribute("tabindex", "0");
    expect(eight).toHaveAttribute("tabindex", "-1");
    fireEvent.keyDown(seven!, { key: "ArrowDown" });
    expect(seven).toHaveAttribute("tabindex", "-1");
    expect(eight).toHaveAttribute("tabindex", "0");
    expect(container.querySelectorAll('.calendar-hour-target[tabindex="0"]')).toHaveLength(1);
  });
});

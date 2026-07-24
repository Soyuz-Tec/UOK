import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UokLocalizationProvider } from "@uok/shared/localization";
import { CalendarMonthView } from "../../web/src/CalendarMonthView";
import type { CalendarEventRecord } from "../../web/src/calendarTypes";

const cursorDate = new Date(2026, 6, 10);
const colors = { "calendar-1": "#2563EB" };

describe("CalendarMonthView", () => {
  afterEach(cleanup);

  it("keeps month cells compact and opens the selected day from overflow", () => {
    const onOpenDay = vi.fn();
    render(
      <CalendarMonthView
        cursorDate={cursorDate}
        events={eventsOnJuly10(6)}
        calendarColors={colors}
        onSelectDay={vi.fn()}
        onOpenDay={onOpenDay}
        onSelectEvent={vi.fn()}
      />,
    );

    const dayCell = screen.getByRole("button", { name: "10" }).closest('[role="gridcell"]');
    expect(dayCell).not.toBeNull();
    const scoped = within(dayCell as HTMLElement);
    expect(scoped.getAllByRole("button")).toHaveLength(5);
    expect(scoped.getByText("Event 1")).toBeVisible();
    expect(scoped.getByText("Event 3")).toBeVisible();
    expect(scoped.queryByText("Event 4")).not.toBeInTheDocument();

    const overflow = scoped.getByRole("button", { name: "Open 3 more events on Jul 10, 2026" });
    expect(overflow).toHaveTextContent("+3 more");
    fireEvent.click(overflow);

    expect(onOpenDay).toHaveBeenCalledTimes(1);
    expect(onOpenDay.mock.calls[0][0]).toEqual(new Date(2026, 6, 10));
  });

  it("localizes the overflow count and accessible command", () => {
    render(
      <UokLocalizationProvider locale="ar">
        <CalendarMonthView
          cursorDate={cursorDate}
          events={eventsOnJuly10(5)}
          calendarColors={colors}
          onSelectDay={vi.fn()}
          onOpenDay={vi.fn()}
          onSelectEvent={vi.fn()}
        />
      </UokLocalizationProvider>,
    );

    const overflow = screen.getByRole("button", { name: /فتح ٢ من الأحداث الإضافية/ });
    expect(overflow).toHaveTextContent("+٢ المزيد");
  });
});

function eventsOnJuly10(count: number): CalendarEventRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `event-${index + 1}`,
    calendar_id: "calendar-1",
    title: `Event ${index + 1}`,
    status: "confirmed",
    occurrence_start: `2026-07-10T${String(index + 9).padStart(2, "0")}:00:00`,
    occurrence_end: `2026-07-10T${String(index + 10).padStart(2, "0")}:00:00`,
    timezone: "UTC",
    transparency: "busy",
  }));
}

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UokLocalizationProvider } from "@uok/shared/localization";
import { CalendarAgendaView } from "../../web/src/CalendarAgendaView";
import { CalendarMonthView } from "../../web/src/CalendarMonthView";
import { CalendarTimeGrid } from "../../web/src/CalendarTimeGrid";
import type { CalendarEventRecord } from "../../web/src/calendarTypes";

const events: CalendarEventRecord[] = [
  eventRecord("canceled", "Canceled review", "canceled", true, 0, 24),
  eventRecord("tentative", "Tentative review", "tentative", false, 10, 11),
];
const colors = { "calendar-1": "#2563EB" };
const cursorDate = new Date(2026, 6, 10);

describe("Calendar event semantic status", () => {
  afterEach(cleanup);

  it.each(["month", "agenda", "week", "day"] as const)("shows localized canceled and tentative status in %s", (view) => {
    render(
      <UokLocalizationProvider locale="ar">
        {view === "month" ? (
          <CalendarMonthView cursorDate={cursorDate} events={events} calendarColors={colors} onSelectDay={vi.fn()} onOpenDay={vi.fn()} onSelectEvent={vi.fn()} />
        ) : view === "agenda" ? (
          <CalendarAgendaView events={events} calendarColors={colors} onSelectEvent={vi.fn()} />
        ) : (
          <CalendarTimeGrid view={view} cursorDate={cursorDate} events={events} calendarColors={colors} onSelectDay={vi.fn()} onSelectEvent={vi.fn()} />
        )}
      </UokLocalizationProvider>,
    );

    const canceled = screen.getByRole("button", { name: /Canceled review.*الحالة: ملغى/ });
    const tentative = screen.getByRole("button", { name: /Tentative review.*الحالة: مبدئي/ });
    const canceledBadge = canceled.querySelector(".calendar-event-status");
    const tentativeBadge = tentative.querySelector(".calendar-event-status");
    expect(canceledBadge).toBeVisible();
    expect(tentativeBadge).toBeVisible();
    expect(canceledBadge).toHaveTextContent("ملغى");
    expect(tentativeBadge).toHaveTextContent("مبدئي");
    expect(canceledBadge).toHaveClass("canceled");
    expect(tentativeBadge).toHaveClass("tentative");
  });
});

function eventRecord(id: string, title: string, status: string, allDay: boolean, startHour: number, endHour: number): CalendarEventRecord {
  const start = `2026-07-${allDay ? "10" : "10"}T${String(startHour).padStart(2, "0")}:00:00`;
  const endDay = endHour === 24 ? "11" : "10";
  const normalizedEndHour = endHour === 24 ? 0 : endHour;
  return {
    id,
    calendar_id: "calendar-1",
    title,
    status,
    occurrence_start: start,
    occurrence_end: `2026-07-${endDay}T${String(normalizedEndHour).padStart(2, "0")}:00:00`,
    timezone: "UTC",
    transparency: "busy",
    all_day: allDay,
  };
}

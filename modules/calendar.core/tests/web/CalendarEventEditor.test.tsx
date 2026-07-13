import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CalendarEventEditor } from "../../web/src/CalendarEventEditor";
import { draftFromEvent, emptyDraft } from "../../web/src/calendarDrafts";

describe("CalendarEventEditor", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("prevents dismissal and editing while a committed save is pending", () => {
    render(
      <CalendarEventEditor
        open
        draft={{ ...emptyDraft(new Date(2026, 6, 10), 9, "calendar-1"), title: "Review" }}
        calendars={[{ id: "calendar-1", name: "Operations", status: "active", timezone: "UTC" }]}
        busyAction="save"
        onDraftChange={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onClose={vi.fn()}
        onRestore={vi.fn()}
      />
    );

    const dialog = screen.getByRole("dialog", { name: "New event" });
    expect(within(dialog).getByRole("button", { name: "Close New event" })).toBeDisabled();
    expect(within(dialog).getByLabelText("Title")).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Working" })).toBeDisabled();
  });

  it("explains the finite default when recurrence has no end boundary", () => {
    render(
      <CalendarEventEditor
        open
        draft={{ ...emptyDraft(new Date(2026, 6, 10), 9, "calendar-1"), title: "Daily review", recurrence: "DAILY" }}
        calendars={[{ id: "calendar-1", name: "Operations", status: "active", timezone: "UTC" }]}
        busyAction=""
        onDraftChange={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onClose={vi.fn()}
        onRestore={vi.fn()}
      />
    );

    expect(within(screen.getByRole("dialog", { name: "New event" })).getByText("Without a repeat-until date, UOK limits this series to 366 occurrences.")).toBeInTheDocument();
  });

  it.each([
    ["confirmed", "Cancel series", "Cancel this entire recurring series? Every occurrence will be canceled.", "cancel"],
    ["canceled", "Restore series", "Restore this entire recurring series? Every occurrence will be restored.", "restore"],
  ] as const)("labels and confirms a %s whole-series lifecycle action", (status, actionLabel, confirmation, action) => {
    const onCancel = vi.fn();
    const onRestore = vi.fn();
    const confirm = vi.spyOn(globalThis, "confirm").mockReturnValue(true);
    const draft = {
      ...emptyDraft(new Date(2026, 6, 10), 9, "calendar-1"),
      id: "event-1",
      title: "Weekly review",
      recurrence: "WEEKLY" as const,
      recurrenceRule: "FREQ=WEEKLY;BYDAY=FR",
    };

    render(
      <CalendarEventEditor
        open
        draft={draft}
        calendars={[{ id: "calendar-1", name: "Operations", status: "active", timezone: "UTC" }]}
        selectedEvent={{
          id: "event-1",
          calendar_id: "calendar-1",
          title: "Weekly review",
          status,
          occurrence_start: "2026-07-10T13:00:00Z",
          occurrence_end: "2026-07-10T14:00:00Z",
          timezone: "UTC",
          transparency: "busy",
          recurrence_rule: draft.recurrenceRule,
        }}
        busyAction=""
        onDraftChange={vi.fn()}
        onSave={vi.fn()}
        onCancel={onCancel}
        onClose={vi.fn()}
        onRestore={onRestore}
      />
    );

    const dialog = screen.getByRole("dialog", { name: "Edit recurring series" });
    expect(within(dialog).getByText("Changes, cancellation, and restoration apply to the entire recurring series.")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: actionLabel }));
    expect(confirm).toHaveBeenCalledWith(confirmation);
    expect(action === "cancel" ? onCancel : onRestore).toHaveBeenCalledOnce();
  });

  it("redraws untouched canonical instants when the event timezone changes", () => {
    const selectedEvent = {
      id: "event-1",
      calendar_id: "calendar-1",
      title: "Follow the sun",
      status: "confirmed",
      starts_at: "2026-07-10T13:00:00Z",
      ends_at: "2026-07-10T14:00:00Z",
      occurrence_start: "2026-07-10T13:00:00Z",
      occurrence_end: "2026-07-10T14:00:00Z",
      recurrence_until: "2026-08-10T13:00:00Z",
      timezone: "America/New_York",
      transparency: "busy" as const,
    };
    const onDraftChange = vi.fn();
    render(
      <CalendarEventEditor
        open
        draft={draftFromEvent(selectedEvent)}
        calendars={[{ id: "calendar-1", name: "Operations", status: "active", timezone: "UTC" }]}
        selectedEvent={selectedEvent}
        busyAction=""
        onDraftChange={onDraftChange}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onClose={vi.fn()}
        onRestore={vi.fn()}
      />,
    );

    fireEvent.change(within(screen.getByRole("dialog", { name: "Edit event" })).getByLabelText("Time zone"), { target: { value: "Asia/Kolkata" } });
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
      timezone: "Asia/Kolkata",
      startsAt: "2026-07-10T18:30",
      endsAt: "2026-07-10T19:30",
      recurrenceUntil: "2026-08-10T18:30",
    }));
  });
});

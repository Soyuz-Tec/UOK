import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ModuleStatus } from "@uok/shared/types";

import { CalendarWorkspace } from "../../web/src/CalendarWorkspace";

const installedCalendar: ModuleStatus = {
  name: "calendar.core",
  status: "installed",
  recorded_status: "installed",
  reconciliation_required: false,
  maturity: "runtime_proven",
  version: "1.0.0",
  kind: "capability_module",
  installable: true,
  uninstallable: true,
  updatable: true,
  maintainable: true,
  required: false,
  lifecycle: ["available", "installed", "disabled", "upgraded", "uninstalled"],
  lifecycle_state_declared: true,
  dependencies: [],
  dependents: [],
};

describe("CalendarWorkspace", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      const body = path.includes("/api/calendar/calendars")
        ? [{ id: "calendar-1", name: "Operations", status: "active", timezone: "UTC" }]
        : path.includes("/api/calendar/freebusy")
          ? { busy: [{ event_id: "event-1", start: "2026-07-09T11:00:00Z", end: "2026-07-09T12:00:00Z", title: "Dispatch review" }] }
          : path.includes("/api/calendar/events/event-1")
            ? {
                id: "event-1",
                calendar_id: "calendar-1",
                title: "Dispatch review",
                description: "Daily schedule check",
                location: "Control room",
                status: "confirmed",
                occurrence_start: "2026-07-09T11:00:00Z",
                occurrence_end: "2026-07-09T12:00:00Z",
                timezone: "UTC",
                transparency: "busy",
                reminders: [{ id: "reminder-1", reminder_type: "in_app", trigger_minutes_before: 30 }],
                participants: [{ id: "participant-1", email: "ops@example.test", display_name: "Ops" }],
              }
            : [{
                id: "event-1",
                calendar_id: "calendar-1",
                title: "Dispatch review",
                status: "confirmed",
                occurrence_start: "2026-07-09T11:00:00Z",
                occurrence_end: "2026-07-09T12:00:00Z",
                timezone: "UTC",
                transparency: "busy",
              }];
      return { ok: true, status: 200, json: async () => body } as Response;
    }));
  });

  it("renders a traditional calendar workspace and opens event details", async () => {
    render(<CalendarWorkspace token="token" moduleRows={[installedCalendar]} busyAction="" onInstall={() => undefined} />);

    expect(await screen.findByRole("group", { name: "Calendar view" })).toBeInTheDocument();
    const commandBar = screen.getByLabelText("Calendar controls");
    expect(within(commandBar).getByRole("group", { name: "Calendar controls query" })).toBeInTheDocument();
    expect(within(commandBar).getByRole("group", { name: "Calendar controls context" })).toBeInTheDocument();
    expect(within(commandBar).getByRole("group", { name: "Calendar controls actions" })).toBeInTheDocument();
    expect(within(commandBar).getByRole("textbox", { name: "Search events" })).toBeInTheDocument();
    expect(within(commandBar).getAllByRole("button", { name: "New event" })).toHaveLength(1);
    expect(within(commandBar).getByRole("button", { name: "Refresh calendar" })).toBeInTheDocument();
    expect(within(commandBar).getByRole("button", { name: "Export ICS" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("Operations").length).toBeGreaterThan(0));
    expect(await screen.findByText("Dispatch review")).toBeInTheDocument();
    expect(screen.getByText("1 busy blocks")).toBeInTheDocument();

    fireEvent.click(within(commandBar).getByRole("button", { name: "New event" }));
    const newEventEditor = screen.getByLabelText("Event editor");
    expect(within(newEventEditor).getByRole("heading", { name: "New event" })).toBeInTheDocument();
    expect(within(newEventEditor).getByLabelText("Title")).toHaveValue("");
    fireEvent.click(within(newEventEditor).getByRole("button", { name: "Close event editor" }));

    fireEvent.click(screen.getAllByText("Dispatch review")[0]);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Edit event" })).toBeInTheDocument());
    expect(screen.getByDisplayValue("Control room")).toBeInTheDocument();
    expect(screen.getByText("1 active reminders")).toBeInTheDocument();
  });
});

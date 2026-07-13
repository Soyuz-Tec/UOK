import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  afterEach(cleanup);

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      const body = path.includes("/api/calendar/calendars")
        ? [
            { id: "calendar-1", name: "Operations", color: "#2563eb", status: "active", timezone: "UTC" },
            { id: "calendar-2", name: "Engineering", color: "invalid", status: "active", timezone: "America/New_York" },
          ]
        : path.includes("/api/calendar/freebusy")
          ? { busy: [{ start: "2026-07-09T11:00:00Z", end: "2026-07-09T12:00:00Z" }] }
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
      return {
        ok: true,
        status: 200,
        json: async () => body,
        headers: { get: (name: string) => name.toLowerCase() === "etag" && path.includes("/api/calendar/events/event-1") ? '"calendar-event-sha256-test"' : null },
      } as Response;
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
    const moreActions = within(commandBar).getByRole("button", { name: "More actions" });
    fireEvent.click(moreActions);
    const actionsMenu = screen.getByRole("dialog", { name: "More actions" });
    expect(within(actionsMenu).getByRole("button", { name: "Refresh" })).toBeInTheDocument();
    expect(within(actionsMenu).getByRole("button", { name: "Export ICS" })).toBeInTheDocument();
    fireEvent.click(moreActions);
    await waitFor(() => expect(screen.getAllByText("Operations").length).toBeGreaterThan(0));
    expect(await screen.findByText("Dispatch review")).toBeInTheDocument();
    expect(screen.getByText("1 busy blocks")).toBeInTheDocument();

    const newEventButton = within(commandBar).getByRole("button", { name: "New event" });
    newEventButton.focus();
    fireEvent.click(newEventButton);
    const newEventEditor = screen.getByRole("dialog", { name: "New event" });
    expect(within(newEventEditor).getByRole("heading", { name: "New event" })).toBeInTheDocument();
    expect(within(newEventEditor).getByLabelText("Title")).toHaveValue("");
    expect(within(newEventEditor).getByRole("button", { name: "Move New event" })).toBeInTheDocument();
    expect(within(newEventEditor).getByLabelText("Calendar")).toHaveValue("calendar-1");
    fireEvent.click(within(newEventEditor).getByRole("button", { name: "Create event" }));
    expect(within(newEventEditor).getByRole("alert")).toHaveTextContent("Enter a title before saving.");
    fireEvent.click(within(newEventEditor).getByRole("button", { name: "Close New event" }));
    await waitFor(() => expect(newEventButton).toHaveFocus());

    fireEvent.click(screen.getAllByText("Dispatch review")[0]);

    const editDialog = await screen.findByRole("dialog", { name: "Edit event" });
    expect(within(editDialog).getByDisplayValue("Control room")).toBeInTheDocument();
    expect(within(editDialog).getByText(/1 saved reminder.*UOK delivery is not enabled yet/)).toBeInTheDocument();
  });

  it("switches between one calendar and the safe all-calendar overlay", async () => {
    const fetchMock = vi.mocked(fetch);
    render(<CalendarWorkspace token="token" moduleRows={[installedCalendar]} busyAction="" onInstall={() => undefined} />);

    const allCalendars = await screen.findByRole("radio", { name: /All calendars/ });
    expect(screen.getByRole("radio", { name: /Operations/ })).toBeChecked();
    fireEvent.click(allCalendars);

    await waitFor(() => expect(allCalendars).toBeChecked());
    await waitFor(() => {
      const eventCalls = fetchMock.mock.calls.map(([input]) => String(input)).filter((path) => path.includes("/api/calendar/events?"));
      expect(eventCalls.some((path) => !new URL(path, "http://uok.local").searchParams.has("calendar_id"))).toBe(true);
    });
  });

  it("defaults a new event to the selected calendar timezone and visible wall hour", async () => {
    render(<CalendarWorkspace token="token" moduleRows={[installedCalendar]} busyAction="" onInstall={() => undefined} />);

    const engineering = await screen.findByRole("radio", { name: /Engineering/ });
    fireEvent.click(engineering);
    await waitFor(() => expect(engineering).toBeChecked());
    fireEvent.click(screen.getByRole("button", { name: "New event" }));

    const dialog = screen.getByRole("dialog", { name: "New event" });
    expect(within(dialog).getByLabelText("Time zone")).toHaveValue("America/New_York");
    expect((within(dialog).getByLabelText("Starts") as HTMLInputElement).value).toMatch(/T09:00$/);
  });
});

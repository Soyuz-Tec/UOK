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
    const eventStart = new Date();
    eventStart.setHours(11, 0, 0, 0);
    const eventEnd = new Date(eventStart);
    eventEnd.setHours(12, 0, 0, 0);
    const occurrenceStart = eventStart.toISOString();
    const occurrenceEnd = eventEnd.toISOString();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      const body = path.includes("/api/calendar/capabilities")
        ? { read: true, manage: true, create: true, delete: true, restore: true }
        : path.includes("/api/calendar/calendars")
        ? [
            { id: "calendar-1", name: "Operations", color: "#2563eb", status: "active", timezone: "UTC" },
            { id: "calendar-2", name: "Engineering", color: "invalid", status: "active", timezone: "America/New_York" },
          ]
        : path.includes("/api/calendar/freebusy")
          ? { busy: [{ start: occurrenceStart, end: occurrenceEnd }] }
          : path.includes("/api/calendar/events/event-1")
            ? {
                id: "event-1",
                calendar_id: "calendar-1",
                title: "Dispatch review",
                description: "Daily schedule check",
                location: "Control room",
                status: "confirmed",
                occurrence_start: occurrenceStart,
                occurrence_end: occurrenceEnd,
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
                occurrence_start: occurrenceStart,
                occurrence_end: occurrenceEnd,
                timezone: "UTC",
                transparency: "busy",
              }];
      return {
        ok: true,
        status: 200,
        json: async () => body,
        headers: { get: (name: string) => name.toLowerCase() === "etag" && path.includes("/api/calendar/events/event-1") ? '"calendar-event-sha256-test"' : null },
      } as unknown as Response;
    }));
  });

  it("renders a traditional calendar workspace and opens event details", async () => {
    render(<CalendarWorkspace token="token" moduleRows={[installedCalendar]} busyAction="" onInstall={() => undefined} />);

    expect(await screen.findByRole("group", { name: "Calendar view" })).toBeInTheDocument();
    const commandBar = screen.getByLabelText("Calendar controls");
    expect(within(commandBar).getByRole("group", { name: "Calendar controls query" })).toBeInTheDocument();
    const commandContext = within(commandBar).getByRole("group", { name: "Calendar controls context" });
    expect(commandContext).toBeInTheDocument();
    expect(within(commandBar).getByRole("group", { name: "Calendar controls actions" })).toBeInTheDocument();
    expect(within(commandBar).getByRole("textbox", { name: "Search events" })).toBeInTheDocument();
    expect(within(commandBar).getAllByRole("button", { name: "New event" })).toHaveLength(1);
    const moreActions = within(commandBar).getByRole("button", { name: "More actions" });
    fireEvent.click(moreActions);
    const actionsMenu = screen.getByRole("dialog", { name: "More actions" });
    expect(within(actionsMenu).getByRole("button", { name: "Refresh" })).toBeInTheDocument();
    expect(within(actionsMenu).getByRole("button", { name: "Export ICS" })).toBeInTheDocument();
    fireEvent.click(moreActions);
    await waitFor(() => expect(within(commandContext).getByRole("button", { name: "Calendar display: Operations" })).toBeInTheDocument());
    expect(within(commandContext).getAllByRole("button", { name: /Choose date:/ })).toHaveLength(1);
    expect(screen.queryByLabelText("Calendar side panel")).not.toBeInTheDocument();
    expect(document.querySelector(".calendar-layout")).not.toBeInTheDocument();
    expect(document.querySelector(".calendar-summary")).not.toBeInTheDocument();
    expect(await screen.findByText("Dispatch review")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveClass("visually-hidden");
    expect(screen.getByRole("status")).toHaveTextContent("1 busy block");

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

    const commandContext = within(screen.getByLabelText("Calendar controls")).getByRole("group", { name: "Calendar controls context" });
    const scopeTrigger = await within(commandContext).findByRole("button", { name: "Calendar display: Operations" });
    fireEvent.click(scopeTrigger);
    const allCalendars = screen.getByRole("radio", { name: /All calendars/ });
    expect(screen.getByRole("radio", { name: /Operations/ })).toBeChecked();
    fireEvent.click(allCalendars);

    await waitFor(() => expect(scopeTrigger).toHaveAccessibleName("Calendar display: All calendars"));
    expect(scopeTrigger).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => {
      const eventCalls = fetchMock.mock.calls.map(([input]) => String(input)).filter((path) => path.includes("/api/calendar/events?"));
      expect(eventCalls.some((path) => !new URL(path, "http://uok.local").searchParams.has("calendar_id"))).toBe(true);
    });
  });

  it("defaults a new event to the selected calendar timezone and visible wall hour", async () => {
    render(<CalendarWorkspace token="token" moduleRows={[installedCalendar]} busyAction="" onInstall={() => undefined} />);

    const commandContext = within(screen.getByLabelText("Calendar controls")).getByRole("group", { name: "Calendar controls context" });
    const scopeTrigger = await within(commandContext).findByRole("button", { name: "Calendar display: Operations" });
    fireEvent.click(scopeTrigger);
    const engineering = screen.getByRole("radio", { name: /Engineering/ });
    fireEvent.click(engineering);
    await waitFor(() => expect(scopeTrigger).toHaveAccessibleName("Calendar display: Engineering"));
    fireEvent.click(screen.getByRole("button", { name: "New event" }));

    const dialog = screen.getByRole("dialog", { name: "New event" });
    expect(within(dialog).getByLabelText("Time zone")).toHaveValue("America/New_York");
    expect((within(dialog).getByLabelText("Starts") as HTMLInputElement).value).toMatch(/T09:00$/);
  });

  it("soft deletes the selected calendar and falls back to the next visible calendar", async () => {
    let calendars = [
      { id: "calendar-1", name: "Operations", color: "#2563eb", status: "active", timezone: "UTC", etag: '"calendar-sha256-operations"', user_managed: true, can_delete: true, can_restore: false },
      { id: "calendar-2", name: "Engineering", color: null, status: "active", timezone: "UTC", etag: '"calendar-sha256-engineering"', user_managed: true, can_delete: true, can_restore: false },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      let body: unknown = [];
      if (path === "/api/calendar/capabilities") body = { read: true, manage: true, create: true, delete: true, restore: true };
      else if (path === "/api/calendar/calendars/calendar-1" && init?.method === "DELETE") {
        calendars = calendars.map((row) => row.id === "calendar-1"
          ? { ...row, status: "deleted", etag: '"calendar-sha256-operations-deleted"', can_delete: false, can_restore: true }
          : row);
        body = calendars[0];
      } else if (path === "/api/calendar/calendars/calendar-1/restore" && init?.method === "POST") {
        calendars = calendars.map((row) => row.id === "calendar-1"
          ? { ...row, status: "active", etag: '"calendar-sha256-operations-restored"', can_delete: true, can_restore: false }
          : row);
        body = calendars[0];
      } else if (path.startsWith("/api/calendar/calendars")) body = path.includes("include_deleted=true") ? calendars : calendars.filter((row) => row.status !== "deleted");
      else if (path.startsWith("/api/calendar/freebusy?")) body = { busy: [] };
      return {
        ok: true,
        status: 200,
        json: async () => body,
        headers: { get: () => null },
      } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<CalendarWorkspace token="token" moduleRows={[installedCalendar]} busyAction="" onInstall={() => undefined} />);

    const trigger = await screen.findByRole("button", { name: "Calendar display: Operations" });
    fireEvent.click(trigger);
    const deleteButton = await screen.findByRole("button", { name: "Delete calendar" });
    await waitFor(() => expect(deleteButton).toBeEnabled());
    fireEvent.click(deleteButton);
    const dialog = screen.getByRole("alertdialog", { name: "Delete calendar" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete calendar" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/calendar/calendars/calendar-1",
      expect.objectContaining({ method: "DELETE", headers: expect.objectContaining({ "If-Match": '"calendar-sha256-operations"' }) }),
    ));
    await waitFor(() => expect(trigger).toHaveAccessibleName("Calendar display: Engineering"));
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.getByRole("status")).toHaveTextContent("Deleted Operations. Its events remain retained for audit.");

    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("button", { name: "Restore calendar: Operations" }));
    const restoreDialog = screen.getByRole("alertdialog", { name: "Restore calendar" });
    fireEvent.click(within(restoreDialog).getByRole("button", { name: "Restore calendar" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/calendar/calendars/calendar-1/restore",
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ "If-Match": '"calendar-sha256-operations-deleted"' }) }),
    ));
    await waitFor(() => expect(trigger).toHaveAccessibleName("Calendar display: Operations"));
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.getByRole("status")).toHaveTextContent("Restored Operations. Its retained events are active again.");
  });
});

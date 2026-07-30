import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ModuleStatus } from "@uok/shared/types";

import { CalendarWorkspace } from "../../web/src/CalendarWorkspace";
import type { CalendarEventRecord } from "../../web/src/calendarTypes";

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

const calendar = { id: "calendar-1", name: "Operations", color: "#2563eb", status: "active", timezone: "UTC" };

describe("CalendarWorkspace integrity", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps the newest event selection when detail responses finish out of order", async () => {
    const first = eventRecord("event-1", "First event", 9);
    const second = eventRecord("event-2", "Second event", 11);
    const firstDetail = deferred<Response>();
    const secondDetail = deferred<Response>();
    stubCalendarFetch([first, second], (path) => {
      if (path === "/api/calendar/events/event-1") return firstDetail.promise;
      if (path === "/api/calendar/events/event-2") return secondDetail.promise;
    });
    renderWorkspace();

    fireEvent.click(await screen.findByRole(
      "button",
      { name: /First event/ },
      { timeout: 4_000 },
    ));
    fireEvent.click(screen.getByRole("button", { name: /Second event/ }));
    await act(async () => {
      secondDetail.resolve(detailResponse(second));
      await secondDetail.promise;
    });
    const dialog = await screen.findByRole("dialog", { name: "Edit event" });
    expect(within(dialog).getByLabelText("Title")).toHaveValue("Second event");

    await act(async () => {
      firstDetail.resolve(detailResponse(first));
      await firstDetail.promise;
    });
    await waitFor(() => expect(within(dialog).getByLabelText("Title")).toHaveValue("Second event"));
  });

  it("does not let a pending event detail replace a newly opened editor", async () => {
    const existing = eventRecord("event-1", "Existing event", 9);
    const pendingDetail = deferred<Response>();
    stubCalendarFetch([existing], (path) => path === "/api/calendar/events/event-1" ? pendingDetail.promise : undefined);
    renderWorkspace();

    fireEvent.click(await screen.findByRole(
      "button",
      { name: /Existing event/ },
      { timeout: 4_000 },
    ));
    fireEvent.click(screen.getByRole("button", { name: "New event" }));
    const dialog = screen.getByRole("dialog", { name: "New event" });
    expect(within(dialog).getByLabelText("Title")).toHaveValue("");

    await act(async () => {
      pendingDetail.resolve(detailResponse(existing));
      await pendingDetail.promise;
    });
    await waitFor(() => expect(screen.getByRole("dialog", { name: "New event" })).toBe(dialog));
    expect(within(dialog).getByLabelText("Title")).toHaveValue("");
  });

  it.each([
    ["confirmed", "Cancel event", "/api/calendar/events/event-1/cancel", "Cancellation denied"],
    ["canceled", "Restore event", "/api/calendar/events/event-1/restore", "Restoration denied"],
  ] as const)("surfaces a failed %s lifecycle command inside the editor", async (status, label, endpoint, errorText) => {
    const event = eventRecord("event-1", "Lifecycle event", 9);
    const fetchMock = stubCalendarFetch([event], (path) => {
      if (path === "/api/calendar/events/event-1") return detailResponse({ ...event, status });
      if (path === endpoint) return jsonResponse({ detail: errorText }, false, 403);
    });
    renderWorkspace();

    fireEvent.click(await screen.findByRole(
      "button",
      { name: /Lifecycle event/ },
      { timeout: 4_000 },
    ));
    const dialog = await screen.findByRole("dialog", { name: "Edit event" });
    fireEvent.click(within(dialog).getByRole("button", { name: label }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(errorText);
    const lifecycleCall = fetchMock.mock.calls.find(([input]) => String(input) === endpoint);
    expect((lifecycleCall?.[1]?.headers as Record<string, string>)["If-Match"]).toBe('"calendar-event-event-1"');
  });

  it("keeps stale lifecycle guidance inside the editor", async () => {
    const event = eventRecord("event-1", "Stale lifecycle event", 9);
    stubCalendarFetch([event], (path) => {
      if (path === "/api/calendar/events/event-1") return detailResponse(event);
      if (path === "/api/calendar/events/event-1/cancel") return jsonResponse({
        error: { message: "The Calendar event changed after it was loaded.", repair: "Reload the event and retry." },
      }, false, 412, '"calendar-event-newer"');
    });
    renderWorkspace();

    fireEvent.click(await screen.findByRole(
      "button",
      { name: /Stale lifecycle event/ },
      { timeout: 4_000 },
    ));
    const dialog = await screen.findByRole("dialog", { name: "Edit event" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel event" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("The Calendar event changed after it was loaded.");
    expect(dialog).toBeInTheDocument();
  });

  it("reports an ICS export failure without starting a download", async () => {
    const event = eventRecord("event-1", "Export event", 9);
    const fetchMock = stubCalendarFetch([event], (path) => path.startsWith("/api/calendar/ics/export?")
      ? jsonResponse({ detail: "Export denied" }, false, 403)
      : undefined);
    renderWorkspace();

    await screen.findByRole(
      "button",
      { name: /Export event/ },
      { timeout: 4_000 },
    );
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "More actions" })).getByRole("button", { name: "Export ICS" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "More actions" })).not.toBeInTheDocument());
    const alert = await screen.findByRole("alert", undefined, { timeout: 4_000 });
    expect(alert).toHaveTextContent("Export denied");
    expect(alert).not.toHaveClass("visually-hidden");
    const status = screen.getByRole("status");
    expect(status).toHaveClass("visually-hidden");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
    expect(fetchMock.mock.calls.some(([input]) => String(input).startsWith("/api/calendar/ics/export?"))).toBe(true);
  });

  it.each([
    ["Mars/Olympus", "2026-07-10T09:00", "2026-07-10T10:00", "not a valid IANA time zone"],
    ["America/New_York", "2026-03-08T02:30", "2026-03-08T03:30", "does not exist in America/New_York"],
    ["America/New_York", "2026-11-01T01:30", "2026-11-01T02:30", "occurs twice in America/New_York"],
  ])("shows an honest inline error for unsafe local time input in %s", async (timezone, startsAt, endsAt, errorText) => {
    const fetchMock = stubCalendarFetch([]);
    renderWorkspace();

    fireEvent.click(await screen.findByRole(
      "button",
      { name: "New event" },
      { timeout: 4_000 },
    ));
    const dialog = screen.getByRole("dialog", { name: "New event" });
    fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: "DST review" } });
    fireEvent.change(within(dialog).getByLabelText("Time zone"), { target: { value: timezone } });
    fireEvent.change(within(dialog).getByLabelText("Starts"), { target: { value: startsAt } });
    fireEvent.change(within(dialog).getByLabelText("Ends"), { target: { value: endsAt } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create event" }));

    expect(within(dialog).getByRole("alert")).toHaveTextContent(errorText);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });
});

function renderWorkspace() {
  return render(<CalendarWorkspace token="token" moduleRows={[installedCalendar]} busyAction="" onInstall={() => undefined} />);
}

function eventRecord(id: string, title: string, hour: number): CalendarEventRecord {
  const start = new Date();
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start);
  end.setHours(hour + 1);
  return {
    id,
    calendar_id: calendar.id,
    title,
    status: "confirmed",
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    occurrence_start: start.toISOString(),
    occurrence_end: end.toISOString(),
    timezone: "UTC",
    transparency: "busy",
  };
}

function stubCalendarFetch(events: CalendarEventRecord[], custom?: (path: string, init?: RequestInit) => Response | Promise<Response> | undefined) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const customResponse = custom?.(path, init);
    if (customResponse) return Promise.resolve(customResponse);
    if (path === "/api/calendar/calendars") return Promise.resolve(jsonResponse([calendar]));
    if (path.startsWith("/api/calendar/freebusy?")) return Promise.resolve(jsonResponse({ busy: [] }));
    if (path.startsWith("/api/calendar/events?")) return Promise.resolve(jsonResponse(events));
    const event = events.find((row) => path === `/api/calendar/events/${row.id}`);
    return Promise.resolve(event ? detailResponse(event) : jsonResponse({}));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function detailResponse(event: CalendarEventRecord) {
  return jsonResponse(event, true, 200, `"calendar-event-${event.id}"`);
}

function jsonResponse(body: unknown, ok = true, status = 200, etag: string | null = null) {
  return {
    ok,
    status,
    json: async () => body,
    headers: { get: (name: string) => name.toLowerCase() === "etag" ? etag : null },
  } as Response;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

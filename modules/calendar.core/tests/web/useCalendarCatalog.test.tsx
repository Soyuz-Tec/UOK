import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CalendarApiError } from "../../web/src/calendarClient";
import { useCalendarCatalog } from "../../web/src/useCalendarCatalog";

afterEach(() => vi.restoreAllMocks());

describe("useCalendarCatalog lifecycle", () => {
  it("reloads authoritative state after a stale delete without reapplying it", async () => {
    let current = calendar('"calendar-sha256-initial"', "Original name");
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === "/api/calendar/capabilities") return json({ read: true, manage: true, create: true, delete: true, restore: true });
      if (path.startsWith("/api/calendar/calendars") && init?.method === "DELETE") {
        current = calendar('"calendar-sha256-current"', "Renamed elsewhere");
        return json({
          error: {
            code: "stale_precondition",
            message: "The Calendar changed after it was loaded.",
            repair: "Reload the Calendar list and explicitly confirm delete again.",
          },
        }, 412, current.etag);
      }
      if (path.startsWith("/api/calendar/calendars")) return json([current]);
      if (path.startsWith("/api/calendar/events?")) return json([]);
      if (path.startsWith("/api/calendar/freebusy?")) return json({ busy: [] });
      return json({ detail: "Unexpected request" }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);
    const cursorDate = new Date("2026-08-01T00:00:00Z");
    const { result } = renderHook(() => useCalendarCatalog({
      token: "token",
      operational: true,
      timezone: "UTC",
      view: "month",
      cursorDate,
      onRefreshStart: vi.fn(),
      onDeleteSuccess: vi.fn(),
    }));
    await waitFor(() => expect(result.current.calendars[0]?.etag).toBe('"calendar-sha256-initial"'));

    let failure: unknown;
    await act(async () => {
      try {
        await result.current.deleteCalendar(result.current.calendars[0]);
      } catch (error) {
        failure = error;
      }
    });

    expect(failure).toBeInstanceOf(CalendarApiError);
    expect(result.current.calendars[0]).toMatchObject({ name: "Renamed elsewhere", etag: '"calendar-sha256-current"' });
    expect(result.current.workspaceError).toContain("explicitly confirm delete again");
    const deletes = fetchMock.mock.calls.filter(([, init]) => init?.method === "DELETE");
    expect(deletes).toHaveLength(1);
    expect(new Headers(deletes[0][1]?.headers).get("If-Match")).toBe('"calendar-sha256-initial"');
  });

  it("fails closed when a Calendar lifecycle projection is missing", async () => {
    const malformed = {
      id: "calendar-1", name: "Untrusted projection", color: null, status: "active", timezone: "UTC",
      etag: '"calendar-sha256-present"',
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const path = String(input);
      if (path === "/api/calendar/capabilities") return json({ read: true, manage: true, create: true, delete: true, restore: true });
      if (path.startsWith("/api/calendar/calendars")) return json([malformed]);
      if (path.startsWith("/api/calendar/events?")) return json([]);
      if (path.startsWith("/api/calendar/freebusy?")) return json({ busy: [] });
      return json({ detail: "Unexpected request" }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);
    const cursorDate = new Date("2026-08-01T00:00:00Z");
    const { result } = renderHook(() => useCalendarCatalog({
      token: "token",
      operational: true,
      timezone: "UTC",
      view: "month",
      cursorDate,
      onRefreshStart: vi.fn(),
      onDeleteSuccess: vi.fn(),
    }));
    await waitFor(() => expect(result.current.calendars).toHaveLength(1));

    await act(async () => {
      await result.current.deleteCalendar(result.current.calendars[0]);
    });

    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "DELETE")).toHaveLength(0);
  });
});

function calendar(etag: string, name: string) {
  return {
    id: "calendar-1", name, color: null, status: "active", timezone: "UTC", etag,
    user_managed: true, can_delete: true, can_restore: false,
  };
}

function json(body: unknown, status = 200, etag: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...(etag ? { ETag: etag } : {}) },
  });
}

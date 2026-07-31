import { afterEach, describe, expect, it, vi } from "vitest";

import { type CalendarApiError, calendarJson } from "../../web/src/calendarClient";

afterEach(() => vi.restoreAllMocks());

describe("calendarJson", () => {
  it("normalizes structured lifecycle repair guidance into an Error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: {
        code: "stale_precondition",
        message: "The Calendar changed after it was loaded.",
        repair: "Reload the Calendar list and confirm delete again.",
      },
    }), {
      status: 412,
      headers: { "Content-Type": "application/json", ETag: '"calendar-sha256-current"' },
    })));

    await expect(calendarJson("token", "/api/calendar/calendars/calendar-1", { method: "DELETE" }))
      .rejects.toMatchObject({
        name: "CalendarApiError",
        status: 412,
        responseEtag: '"calendar-sha256-current"',
        message: "The Calendar changed after it was loaded. Reload the Calendar list and confirm delete again.",
      } satisfies Partial<CalendarApiError>);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { setPlanningResourceCalendar } from "./planningResourceCalendarApi";
import type { PlanningStrongEtag } from "./planningApi";

afterEach(() => vi.unstubAllGlobals());

describe("Planning resource calendar API", () => {
  it("sends one stable idempotency key and strong precondition to the typed route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ revision: 8, correlation_id: "command-1", schedule: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json", ETag: '"planning-r8-sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"' },
    }));
    vi.stubGlobal("fetch", fetchMock);
    await setPlanningResourceCalendar("token", "project-1", "resource-1", {
      working_days: [1, 2, 3, 4, 5], holidays: ["2026-08-04"], default_capacity_percent: 50,
    }, {
      ifMatch: '"planning-r7-sha256-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"' as PlanningStrongEtag,
      idempotencyKey: "resource-calendar-intent-1",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [path, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/planning/projects/project-1/resources/resource-1/calendar");
    const headers = new Headers(options.headers);
    expect(headers.get("Idempotency-Key")).toBe("resource-calendar-intent-1");
    expect(headers.get("If-Match")).toContain("planning-r7-sha256");
  });
});

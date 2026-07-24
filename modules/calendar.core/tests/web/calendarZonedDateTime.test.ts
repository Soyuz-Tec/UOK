import { describe, expect, it } from "vitest";

import { resolveZonedInput, zonedInputValue } from "../../web/src/calendarZonedDateTime";

describe("Calendar IANA wall-time conversion", () => {
  it("formats and resolves timed values without using the browser zone", () => {
    expect(zonedInputValue("2026-07-10T13:00:00Z", "America/New_York")).toBe("2026-07-10T09:00");
    expect(zonedInputValue("2026-07-10T13:00:00Z", "Asia/Kolkata")).toBe("2026-07-10T18:30");

    const newYork = resolveZonedInput("2026-07-10T09:00", "America/New_York");
    const kolkata = resolveZonedInput("2026-07-10T18:30", "Asia/Kolkata");
    expect(newYork.ok && newYork.date.toISOString()).toBe("2026-07-10T13:00:00.000Z");
    expect(kolkata.ok && kolkata.date.toISOString()).toBe("2026-07-10T13:00:00.000Z");
  });

  it("rejects invalid zones, daylight-saving gaps, and new ambiguous folds", () => {
    expect(resolveZonedInput("2026-07-10T09:00", "Mars/Olympus")).toEqual({ ok: false, issue: "invalid_timezone" });
    expect(resolveZonedInput("2026-03-08T02:30", "America/New_York")).toEqual({ ok: false, issue: "nonexistent" });
    expect(resolveZonedInput("2026-11-01T01:30", "America/New_York")).toEqual({ ok: false, issue: "ambiguous" });
  });

  it("round-trips a canonical fold only when the displayed wall time matches its zone", () => {
    const result = resolveZonedInput(
      "2026-11-01T12:00",
      "Asia/Kolkata",
      "2026-11-01T06:30:00Z",
      "Asia/Kolkata",
    );
    expect(result.ok && result.date.toISOString()).toBe("2026-11-01T06:30:00.000Z");
    const oldWallInNewZone = resolveZonedInput(
      "2026-11-01T01:30",
      "Asia/Kolkata",
      "2026-11-01T06:30:00Z",
      "America/New_York",
    );
    expect(oldWallInNewZone.ok && oldWallInNewZone.date.toISOString()).toBe("2026-10-31T20:00:00.000Z");
  });
});

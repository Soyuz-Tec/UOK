import { describe, expect, it } from "vitest";

import { calendarColorMap, calendarEventStyle, resolvedCalendarColor } from "../../web/src/calendarPresentation";

describe("calendar presentation", () => {
  it("accepts six-digit hex colors and rejects arbitrary CSS", () => {
    expect(resolvedCalendarColor("#2563eb")).toBe("#2563EB");
    expect(resolvedCalendarColor("red")).toBe("var(--uok-accent)");
    expect(resolvedCalendarColor("url(https://example.test/a)")).toBe("var(--uok-accent)");
  });

  it("maps calendar identity colors to event styles", () => {
    const colors = calendarColorMap([{ id: "calendar-1", name: "Operations", color: "#16a34a", status: "active", timezone: "UTC" }]);
    expect(colors).toEqual({ "calendar-1": "#16A34A" });
    expect(calendarEventStyle("calendar-1", colors)).toEqual({ "--calendar-event-color": "#16A34A" });
  });
});

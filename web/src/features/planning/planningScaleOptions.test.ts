import { describe, expect, it } from "vitest";

import { adjacentTimelineScale } from "./planningScaleOptions";

describe("planning scale options", () => {
  it("steps through timeline scales for controlled wheel zoom", () => {
    expect(adjacentTimelineScale("month", "in")).toBe("week");
    expect(adjacentTimelineScale("month", "out")).toBe("quarter");
    expect(adjacentTimelineScale("hour", "in")).toBe("hour");
    expect(adjacentTimelineScale("year", "out")).toBe("year");
  });
});

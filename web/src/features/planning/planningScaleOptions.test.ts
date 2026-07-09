import { describe, expect, it } from "vitest";

import { adjacentTimelineScale } from "./planningScaleOptions";

describe("planning scale options", () => {
  it("steps through timeline scales for controlled wheel zoom", () => {
    expect(adjacentTimelineScale("month", "in")).toBe("stage");
    expect(adjacentTimelineScale("stage", "in")).toBe("sprint");
    expect(adjacentTimelineScale("sprint", "in")).toBe("week");
    expect(adjacentTimelineScale("month", "out")).toBe("quarter");
    expect(adjacentTimelineScale("hour", "in")).toBe("minute");
    expect(adjacentTimelineScale("minute", "in")).toBe("minute");
    expect(adjacentTimelineScale("year", "out")).toBe("year");
  });
});

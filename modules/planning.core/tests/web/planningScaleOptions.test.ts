import { describe, expect, it } from "vitest";

import { adjacentTimelineScale, nextTimelineZoom } from "../../web/src/planningScaleOptions";

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

  it("adjusts day-column zoom without changing timeline scale", () => {
    expect(nextTimelineZoom(1, "out")).toBeLessThan(1);
    expect(nextTimelineZoom(1, "in")).toBeGreaterThan(1);
    expect(nextTimelineZoom(0.55, "out")).toBe(0.55);
    expect(nextTimelineZoom(1.9, "in")).toBe(1.9);
  });
});

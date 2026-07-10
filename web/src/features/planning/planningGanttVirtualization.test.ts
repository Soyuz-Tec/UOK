import { describe, expect, it } from "vitest";

import { planningVirtualWindow, planningVirtualizationThreshold } from "./planningGanttVirtualization";

const layouts = Array.from({ length: 500 }, (_, index) => ({ taskId: `task-${index}`, top: index * 48, height: 48 }));

describe("planning Gantt virtualization", () => {
  it("keeps small schedules fully rendered", () => {
    const small = layouts.slice(0, planningVirtualizationThreshold);
    expect(planningVirtualWindow(small, 4_000, 640)).toEqual({ start: 0, end: small.length });
  });

  it("returns an overscanned window for large schedules", () => {
    const first = planningVirtualWindow(layouts, 0, 640);
    const middle = planningVirtualWindow(layouts, 12_000, 640);
    const last = planningVirtualWindow(layouts, 24_000, 640);

    expect(first.start).toBe(0);
    expect(first.end).toBeLessThan(40);
    expect(middle.start).toBeGreaterThan(200);
    expect(middle.end - middle.start).toBeLessThan(40);
    expect(last.end).toBe(500);
  });
});

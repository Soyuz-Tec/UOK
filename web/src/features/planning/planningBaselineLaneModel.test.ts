import { describe, expect, it } from "vitest";

import { planningBaselineLane } from "./planningBaselineLaneModel";
import type { PlanningTask } from "./types";

describe("planning baseline lane model", () => {
  it("models late baseline variance with a non-color code", () => {
    const lane = planningBaselineLane(task({ baseline_end: "2026-08-04", end: "2026-08-06", end_variance_days: 2 }), new Date("2026-08-01T00:00:00"), "day", 40);

    expect(lane).toMatchObject({
      code: "BL +2d",
      status: "late",
      varianceWidth: 80,
      varianceX: 160,
      width: 160,
      x: 0,
    });
    expect(lane?.label).toContain("end variance 2 days");
  });

  it("returns no lane when no baseline exists", () => {
    expect(planningBaselineLane(task({ baseline_start: null, baseline_end: null }), new Date("2026-08-01T00:00:00"), "day", 40)).toBeNull();
  });
});

function task(overrides: Partial<PlanningTask>): PlanningTask {
  return {
    id: "task-1",
    project_id: "project-1",
    title: "Build schedule",
    task_type: "task",
    status: "planned",
    start: "2026-08-01",
    end: "2026-08-05",
    duration_days: 5,
    progress: 20,
    sort_order: 1,
    critical: false,
    baseline_start: "2026-08-01",
    baseline_end: "2026-08-05",
    start_variance_days: 0,
    end_variance_days: 0,
    ...overrides,
  };
}

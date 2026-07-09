import { describe, expect, it } from "vitest";

import { projectRangeScrollLeft, selectedTaskScrollLeft } from "./planningTimelineNavigation";
import type { PlanningTask } from "./types";

describe("selectedTaskScrollLeft", () => {
  it("centers a selected task with left context", () => {
    expect(selectedTaskScrollLeft(task("2026-08-10"), new Date("2026-08-01T00:00:00"), "day", 52, 260)).toBe(338);
  });

  it("does not request a negative scroll position", () => {
    expect(selectedTaskScrollLeft(task("2026-08-02"), new Date("2026-08-01T00:00:00"), "day", 52, 260)).toBe(0);
  });
});

describe("projectRangeScrollLeft", () => {
  it("aligns a project range with visible padding when it fits", () => {
    expect(projectRangeScrollLeft("2026-08-10", "2026-08-12", new Date("2026-08-01T00:00:00"), "day", 52, 520)).toBe(286);
  });

  it("anchors a wide project range at the project start", () => {
    expect(projectRangeScrollLeft("2026-08-10", "2026-08-30", new Date("2026-08-01T00:00:00"), "day", 52, 260)).toBe(468);
  });
});

function task(start: string): PlanningTask {
  return {
    id: "task",
    project_id: "project",
    parent_task_id: null,
    wbs: "1",
    title: "Task",
    task_type: "task",
    status: "planned",
    start,
    end: start,
    duration_days: 1,
    progress: 0,
    sort_order: 1,
    critical: false,
    total_slack_days: 0,
  };
}

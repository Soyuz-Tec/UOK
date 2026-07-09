import { describe, expect, it } from "vitest";

import { timelineCreateDraft, timelineTaskPayload } from "./planningTimelineCreateModel";
import type { PlanningTask } from "./types";

describe("timelineCreateDraft", () => {
  it("maps a dragged timeline range to inclusive dates", () => {
    expect(timelineCreateDraft(120, 230, new Date("2026-08-01T00:00:00"), "day", 52)).toMatchObject({
      start: "2026-08-03",
      end: "2026-08-05",
      x: 120,
      width: 110,
    });
  });

  it("normalizes reverse drags", () => {
    expect(timelineCreateDraft(230, 120, new Date("2026-08-01T00:00:00"), "day", 52)).toMatchObject({
      start: "2026-08-03",
      end: "2026-08-05",
      x: 120,
      width: 110,
    });
  });
});

describe("timelineTaskPayload", () => {
  it("creates a server-validated task proposal after the existing sort order", () => {
    expect(timelineTaskPayload([task(2), task(7)], "2026-08-03", "2026-08-05")).toEqual({
      title: "Timeline task",
      start: "2026-08-03",
      end: "2026-08-05",
      progress: 0,
      status: "planned",
      sort_order: 8,
      task_type: "task",
      parent_task_id: undefined,
    });
  });
});

function task(sortOrder: number): PlanningTask {
  return {
    id: `task-${sortOrder}`,
    project_id: "project",
    parent_task_id: null,
    wbs: String(sortOrder),
    title: "Task",
    task_type: "task",
    status: "planned",
    start: "2026-08-01",
    end: "2026-08-02",
    duration_days: 2,
    progress: 0,
    sort_order: sortOrder,
    critical: false,
    total_slack_days: 0,
  };
}

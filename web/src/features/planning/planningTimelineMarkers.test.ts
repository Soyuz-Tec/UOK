import { describe, expect, it } from "vitest";

import { taskTimelineMarkers } from "./planningTimelineMarkers";
import type { PlanningTask } from "./types";

describe("planning timeline markers", () => {
  it("derives deadline, variance, and milestone markers from visible tasks", () => {
    expect(taskTimelineMarkers([
      task("task-1", "Define scope", "task", true, 0),
      task("task-2", "Build baseline", "task", true, 2),
      task("task-3", "Approve milestone", "milestone", false, 0),
      task("summary", "Phase", "summary", true, 3),
    ])).toEqual([
      expect.objectContaining({ code: "DUE", kind: "deadline", label: "Deadline: Define scope" }),
      expect.objectContaining({ code: "VAR", kind: "variance", label: "Baseline variance: Build baseline" }),
      expect.objectContaining({ code: "MS", kind: "milestone", label: "Milestone: Approve milestone" }),
    ]);
  });
});

function task(id: string, title: string, taskType: PlanningTask["task_type"], critical: boolean, endVariance: number): PlanningTask {
  return {
    id,
    project_id: "project-1",
    version: 1,
    title,
    task_type: taskType,
    status: "planned",
    start: "2026-08-01",
    end: id === "task-3" ? "2026-08-13" : id === "task-2" ? "2026-08-10" : "2026-08-03",
    duration_days: 1,
    progress: 0,
    sort_order: 1,
    critical,
    end_variance_days: endVariance,
  };
}

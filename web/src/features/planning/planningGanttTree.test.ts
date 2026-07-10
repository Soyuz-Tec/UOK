import { describe, expect, it } from "vitest";

import { summaryTaskIds, visibleRows } from "./planningGanttTree";
import type { PlanningTask } from "./types";

describe("planning Gantt tree rows", () => {
  it("hides descendants of collapsed summary tasks", () => {
    const tasks = [
      task("summary", "Summary", "summary", null),
      task("child-summary", "Child summary", "summary", "summary"),
      task("leaf", "Leaf", "task", "child-summary"),
      task("outside", "Outside", "task", null),
    ];

    expect(summaryTaskIds(tasks)).toEqual(["summary", "child-summary"]);
    expect(visibleRows(tasks, new Set(["child-summary"])).map((row) => row.id)).toEqual(["summary", "child-summary", "outside"]);
    expect(visibleRows(tasks, new Set(["summary"])).map((row) => row.id)).toEqual(["summary", "outside"]);
  });
});

function task(id: string, title: string, taskType: PlanningTask["task_type"], parentTaskId: string | null): PlanningTask {
  return {
    id,
    project_id: "project-1",
    version: 1,
    parent_task_id: parentTaskId,
    wbs: id,
    title,
    task_type: taskType,
    status: "planned",
    start: "2026-08-01",
    end: "2026-08-02",
    duration_days: 2,
    progress: 0,
    sort_order: 1,
    critical: false,
    total_slack_days: 0,
  };
}

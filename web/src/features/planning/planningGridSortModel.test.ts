import { describe, expect, it } from "vitest";

import { nextPlanningGridSort, sortPlanningTasks, type PlanningGridSort } from "./planningGridSortModel";
import type { PlanningTask } from "./types";

const tasks = [
  task("scope", "1.10", "Define scope", "planned", "2026-08-01", 20, false),
  task("build", "1.2", "Build schedule", "blocked", "2026-08-05", 80, true),
  task("review", "1.3", "Review", "complete", "2026-08-03", 100, false),
];

describe("planning grid sort model", () => {
  it("toggles sort direction for a selected column", () => {
    expect(nextPlanningGridSort(null, "start")).toEqual({ columnId: "start", direction: "asc" });
    expect(nextPlanningGridSort({ columnId: "start", direction: "asc" }, "start")).toEqual({ columnId: "start", direction: "desc" });
    expect(nextPlanningGridSort({ columnId: "start", direction: "desc" }, "status")).toEqual({ columnId: "status", direction: "asc" });
  });

  it("sorts text, date, numeric, and assigned-resource columns", () => {
    const assigned = new Map([["build", "Planner"]]);
    expect(ids(sort("wbs", "asc"))).toEqual(["build", "review", "scope"]);
    expect(ids(sort("start", "desc"))).toEqual(["build", "review", "scope"]);
    expect(ids(sort("progress", "desc"))).toEqual(["review", "build", "scope"]);
    expect(ids(sortPlanningTasks(tasks, { columnId: "assigned", direction: "desc" }, assigned))).toEqual(["build", "scope", "review"]);
  });
});

function sort(columnId: string, direction: NonNullable<PlanningGridSort>["direction"]) {
  return sortPlanningTasks(tasks, { columnId, direction }, new Map());
}

function ids(rows: PlanningTask[]) {
  return rows.map((task) => task.id);
}

function task(id: string, wbs: string, title: string, status: PlanningTask["status"], start: string, progress: number, critical: boolean): PlanningTask {
  return {
    id,
    project_id: "project-1",
    version: 1,
    title,
    task_type: "task",
    status,
    start,
    end: start,
    duration_days: 1,
    progress,
    sort_order: 1,
    critical,
    wbs,
  };
}

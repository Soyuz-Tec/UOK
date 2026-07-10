import { describe, expect, it } from "vitest";

import { planningResourceWorkloads } from "./planningWorkloadModel";
import type { PlanningSchedule, PlanningTask } from "./types";

describe("planning workload model", () => {
  it("expands resource assignments into daily workload and overload counts", () => {
    const workload = planningResourceWorkloads(schedule())[0];

    expect(workload).toMatchObject({
      overloadedDays: 2,
      peakAllocation: 130,
      resourceName: "Planner",
      taskCount: 2,
      totalAssignment: 130,
    });
    expect(workload.days.map((day) => [day.date, day.allocation])).toEqual([
      ["2026-08-01", 80],
      ["2026-08-02", 130],
      ["2026-08-03", 130],
      ["2026-08-04", 50],
    ]);
    expect(workload.days[1].taskTitles).toEqual(["Scope", "Build"]);
  });
});

function schedule(): PlanningSchedule {
  return {
    project: { id: "project-1", name: "Project", status: "planned", start: "2026-08-01", end: "2026-08-08", revision: 1 },
    tasks: [task("scope", "Scope", "2026-08-01", "2026-08-03"), task("build", "Build", "2026-08-02", "2026-08-04")],
    dependencies: [],
    resources: [{ id: "resource-1", project_id: "project-1", name: "Planner", role: "Scheduling" }],
    assignments: [
      { id: "assignment-1", task_id: "scope", resource_id: "resource-1", allocation_percent: 80 },
      { id: "assignment-2", task_id: "build", resource_id: "resource-1", allocation_percent: 50 },
    ],
    links: [],
    baselines: [],
    calendar: { name: "Standard", working_days: [1, 2, 3, 4, 5], holidays: [] },
    validation: { ok: true, violations: [], warnings: [] },
  };
}

function task(id: string, title: string, start: string, end: string): PlanningTask {
  return {
    id,
    project_id: "project-1",
    version: 1,
    parent_task_id: null,
    wbs: id,
    title,
    task_type: "task",
    status: "planned",
    start,
    end,
    duration_days: 2,
    progress: 0,
    sort_order: 1,
    critical: false,
    total_slack_days: 0,
  };
}

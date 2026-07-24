import { describe, expect, it } from "vitest";

import { planningResourceWorkloads } from "../../web/src/planningWorkloadModel";
import type { PlanningSchedule, PlanningTask } from "../../web/src/types";

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

  it("uses server-validated resource capacity instead of a fixed 100 percent threshold", () => {
    const value = schedule();
    value.calculation = {
      engine_version: "uok-cpm-2", project_start: "2026-08-01", calculated_finish: "2026-08-04", target_finish: "2026-08-08", target_variance_days: 0,
      independent_validation: { ok: true, violations: [] },
      resource_capacity: {
        engine_version: "uok-resource-capacity-2", default_capacity_percent: 100, overallocated_count: 1,
        independent_validation: { ok: true, violations: [] },
        load_points: [{ resource_id: "resource-1", date: "2026-08-01", allocation_percent: 80, capacity_percent: 50, task_ids: ["scope"], overallocated: true }],
      },
    };
    const workload = planningResourceWorkloads(value)[0];
    expect(workload.overloadedDays).toBe(1);
    expect(workload.days[0]).toMatchObject({ allocation: 80, capacity: 50, overallocated: true });
  });
});

function schedule(): PlanningSchedule {
  return {
    project: { id: "project-1", name: "Project", status: "active", start: "2026-08-01", end: "2026-08-08", target_finish: "2026-08-08", calculated_finish: "2026-08-08", revision: 1 },
    tasks: [task("scope", "Scope", "2026-08-01", "2026-08-03"), task("build", "Build", "2026-08-02", "2026-08-04")],
    dependencies: [],
    resources: [{ id: "resource-1", project_id: "project-1", name: "Planner", role: "Scheduling", resource_type: "human", capacity_value: 1, capacity_unit: "fte", canonical_target_kind: null, canonical_target_id: null, canonical_resolution: null, effective_start: null, effective_end: null, calendar: null }],
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

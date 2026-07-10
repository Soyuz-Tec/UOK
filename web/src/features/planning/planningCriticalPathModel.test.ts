import { describe, expect, it } from "vitest";

import { planningCriticalPathSummary, planningTargetVarianceLabel } from "./planningCriticalPathModel";
import type { PlanningSchedule, PlanningTask } from "./types";

describe("planning critical path model", () => {
  it("summarizes critical and zero-slack tasks in schedule order", () => {
    const summary = planningCriticalPathSummary(schedule());

    expect(summary.criticalCount).toBe(2);
    expect(summary.zeroSlackCount).toBe(2);
    expect(summary.calculatedFinish).toBe("2026-08-14");
    expect(summary.targetFinish).toBe("2026-08-12");
    expect(summary.targetVarianceDays).toBe(2);
    expect(summary.engineVersion).toBe("uok-cpm-1");
    expect(summary.items).toEqual([
      { id: "scope", label: "Define scope", slack: 0, wbs: "1.1", window: "2026-08-01 to 2026-08-03" },
      { id: "build", label: "Build Gantt", slack: 0, wbs: "1.2", window: "2026-08-04 to 2026-08-08" },
    ]);
  });

  it("renders target variance without hiding negative float", () => {
    expect(planningTargetVarianceLabel(2)).toBe("2d late");
    expect(planningTargetVarianceLabel(-3)).toBe("3d early");
    expect(planningTargetVarianceLabel(0)).toBe("On target");
    expect(planningTargetVarianceLabel(null)).toBe("Not calculated");
  });
});

function schedule(): PlanningSchedule {
  return {
    project: { id: "project-1", name: "Project", status: "planned", start: "2026-08-01", end: "2026-08-12", revision: 1 },
    tasks: [
      task("review", "Review", "1.3", "2026-08-09", "2026-08-12", false, 2),
      task("build", "Build Gantt", "1.2", "2026-08-04", "2026-08-08", true, 0),
      task("scope", "Define scope", "1.1", "2026-08-01", "2026-08-03", true, 0),
    ],
    dependencies: [],
    resources: [],
    assignments: [],
    baselines: [],
    calculation: {
      engine_version: "uok-cpm-1",
      project_start: "2026-08-01",
      calculated_finish: "2026-08-14",
      target_finish: "2026-08-12",
      target_variance_days: 2,
      independent_validation: { ok: true, violations: [] },
    },
    calendar: { name: "Standard", working_days: [1, 2, 3, 4, 5], holidays: [] },
    validation: { ok: true, violations: [], warnings: [] },
  };
}

function task(id: string, title: string, wbs: string, start: string, end: string, critical: boolean, slack: number): PlanningTask {
  return {
    id,
    project_id: "project-1",
    version: 1,
    parent_task_id: null,
    wbs,
    title,
    task_type: "task",
    status: "planned",
    start,
    end,
    duration_days: 2,
    progress: 0,
    sort_order: 1,
    critical,
    total_slack_days: slack,
  };
}

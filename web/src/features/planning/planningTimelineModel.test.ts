import { describe, expect, it } from "vitest";

import { projectScheduleView, type PlanningFilterState } from "./planningTimelineModel";
import type { PlanningSchedule, PlanningTask } from "./types";

const summary = task("summary", "1", "Pilot delivery", "summary", "planned", false);
const scope = task("scope", "1.1", "Define schedule scope", "task", "planned", true);
const build = task("build", "1.2", "Build pump schedule", "task", "blocked", false);
const milestone = task("review", "1.3", "Pilot review", "milestone", "planned", true);

const schedule: PlanningSchedule = {
  project: { id: "project-1", name: "Project", status: "active", start: "2026-08-01", end: "2026-08-10" },
  tasks: [summary, scope, build, milestone],
  dependencies: [
    { id: "dep-1", project_id: "project-1", predecessor_task_id: "scope", successor_task_id: "build", dependency_type: "finish_to_start", lag_days: 0 },
    { id: "dep-2", project_id: "project-1", predecessor_task_id: "build", successor_task_id: "review", dependency_type: "finish_to_start", lag_days: 0 },
  ],
  calendar: { name: "Standard", working_days: [1, 2, 3, 4, 5], holidays: [] },
  resources: [{ id: "resource-1", project_id: "project-1", name: "Planner", role: "Scheduling" }],
  assignments: [{ id: "assignment-1", task_id: "build", resource_id: "resource-1", allocation_percent: 100 }],
  baselines: [],
  validation: { ok: true, violations: [] },
};

describe("planning schedule view filters", () => {
  it("filters by task query and keeps parent summaries", () => {
    const visible = projectScheduleView(schedule, filters({ query: "pump" }), true);
    expect(visible.tasks.map((task) => task.id)).toEqual(["summary", "build"]);
    expect(visible.dependencies).toEqual([]);
  });

  it("filters by status and resource assignment", () => {
    const visible = projectScheduleView(schedule, filters({ resourceId: "resource-1", status: "blocked" }), true);
    expect(visible.tasks.map((task) => task.id)).toEqual(["summary", "build"]);
  });

  it("filters by milestones and visible dependencies", () => {
    const visible = projectScheduleView(schedule, filters({ mode: "milestones" }), true);
    expect(visible.tasks.map((task) => task.id)).toEqual(["summary", "review"]);
    expect(visible.dependencies).toEqual([]);
  });
});

function filters(overrides: Partial<PlanningFilterState> = {}): PlanningFilterState {
  return { mode: "all", query: "", resourceId: "", status: "", ...overrides };
}

function task(id: string, wbs: string, title: string, taskType: PlanningTask["task_type"], status: string, critical: boolean): PlanningTask {
  return {
    id,
    project_id: "project-1",
    parent_task_id: id === "summary" ? null : "summary",
    wbs,
    title,
    task_type: taskType,
    status,
    start: "2026-08-01",
    end: "2026-08-02",
    duration_days: 2,
    progress: 0,
    sort_order: Number(wbs.replace(/\D/g, "")) || 0,
    critical,
  };
}

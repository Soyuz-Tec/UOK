import { describe, expect, it } from "vitest";

import { planningHistoryDiff, planningLevelHistory } from "./planningHistory";
import type { PlanningSchedule, PlanningTask } from "./types";

describe("planning history", () => {
  it("builds reversible task edit steps from schedule read-model deltas", () => {
    const before = schedule([task({ progress: 10 })]);
    const after = schedule([task({ progress: 70, status: "in_progress" })]);

    const entry = planningHistoryDiff(before, after, "Edit task");

    expect(entry).toMatchObject({
      label: "Edit task",
      undo: [{ kind: "update-task", taskId: "task-1", payload: { progress: 10, status: "planned", cascade: false } }],
      redo: [{ kind: "update-task", taskId: "task-1", payload: { progress: 70, status: "in_progress", cascade: false } }],
    });
  });

  it("builds create/delete task history when no dependency identity would be lost", () => {
    const before = schedule([]);
    const after = schedule([task({ title: "New task" })]);

    const entry = planningHistoryDiff(before, after, "Create task");

    expect(entry?.undo).toEqual([{ kind: "delete-task", taskId: "task-1", match: { title: "New task", start: "2026-08-03", end: "2026-08-05", sort_order: 1 } }]);
    expect(entry?.redo).toEqual([{ kind: "create-task", projectId: "project-1", payload: expect.objectContaining({ title: "New task", task_type: "task" }) }]);
  });

  it("skips unsafe task delete history when dependencies would reference old task ids", () => {
    const before: PlanningSchedule = {
      ...schedule([task({}), task({ id: "task-2", title: "Successor" })]),
      dependencies: [{ id: "dep-1", project_id: "project-1", predecessor_task_id: "task-1", successor_task_id: "task-2", dependency_type: "finish_to_start", lag_days: 0 }],
    };

    expect(planningHistoryDiff(before, schedule([task({ id: "task-2", title: "Successor" })]), "Delete task")).toBeNull();
  });

  it("uses a resource leveling command for redo and task date restores for undo", () => {
    const before = schedule([task({ start: "2026-08-03", end: "2026-08-05" })]);
    const after = schedule([task({ start: "2026-08-06", end: "2026-08-10" })]);

    expect(planningLevelHistory(before, after)).toMatchObject({
      label: "Level resources",
      undo: [{ kind: "update-task", taskId: "task-1", payload: { start: "2026-08-03", end: "2026-08-05", cascade: false } }],
      redo: [{ kind: "level-resources", projectId: "project-1" }],
    });
  });
});

function schedule(tasks: PlanningTask[]): PlanningSchedule {
  return {
    project: { id: "project-1", name: "Project", status: "active", start: "2026-08-01", end: "2026-08-30", revision: 1 },
    tasks,
    dependencies: [],
    calendar: { name: "Standard", working_days: [1, 2, 3, 4, 5], holidays: [] },
    resources: [],
    assignments: [],
    links: [],
    baselines: [],
    validation: { ok: true, violations: [], warnings: [] },
  };
}

function task(overrides: Partial<PlanningTask>): PlanningTask {
  return {
    id: "task-1",
    project_id: "project-1",
    version: 1,
    title: "Task",
    task_type: "task",
    status: "planned",
    start: "2026-08-03",
    end: "2026-08-05",
    duration_days: 3,
    progress: 0,
    sort_order: 1,
    critical: false,
    ...overrides,
  };
}

import { describe, expect, it } from "vitest";

import { planningTaskMenuMutation } from "../../web/src/planningTaskMenuModel";
import type { PlanningTask } from "../../web/src/types";

const task: PlanningTask = {
  id: "task-1",
  project_id: "project-1",
  version: 1,
  parent_task_id: "summary-1",
  title: "Drill borehole",
  task_type: "task",
  status: "planned",
  start: "2026-08-03",
  end: "2026-08-05",
  duration_days: 3,
  progress: 25,
  sort_order: 2,
  critical: false,
};

describe("planning task context menu model", () => {
  it("builds create payloads for add below and duplicate actions", () => {
    expect(planningTaskMenuMutation("add-below", task)).toMatchObject({
      kind: "create",
      payload: { title: "New task", parent_task_id: "summary-1", sort_order: 3, task_type: "task" },
    });
    expect(planningTaskMenuMutation("duplicate", task)).toMatchObject({
      kind: "create",
      payload: { title: "Drill borehole copy", progress: 25, status: "planned" },
    });
  });

  it("converts normal tasks to milestones and rejects invalid child actions", () => {
    expect(planningTaskMenuMutation("convert-milestone", task)).toEqual({ kind: "update", taskId: "task-1", payload: { task_type: "milestone", end: "2026-08-03" } });
    expect(planningTaskMenuMutation("add-child", task)).toBeNull();
    expect(planningTaskMenuMutation("add-child", { ...task, task_type: "summary" })).toMatchObject({ kind: "create", payload: { parent_task_id: "task-1" } });
  });

  it("maps status and delete actions to server mutations", () => {
    expect(planningTaskMenuMutation("mark-complete", task)).toEqual({ kind: "update", taskId: "task-1", payload: { status: "complete", progress: 100 } });
    expect(planningTaskMenuMutation("mark-blocked", task)).toEqual({ kind: "update", taskId: "task-1", payload: { status: "blocked" } });
    expect(planningTaskMenuMutation("delete", task)).toEqual({ kind: "delete", taskId: "task-1" });
  });
});

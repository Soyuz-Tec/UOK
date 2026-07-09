import { describe, expect, it } from "vitest";

import { finishDrag, type DragState } from "./planningGanttModel";
import type { PlanningTask } from "./types";

const task: PlanningTask = {
  id: "task-1",
  project_id: "project-1",
  title: "Schedule task",
  task_type: "task",
  status: "planned",
  start: "2026-08-03",
  end: "2026-08-05",
  duration_days: 3,
  progress: 40,
  sort_order: 1,
  critical: false,
};

describe("planning Gantt drag model", () => {
  it("moves a task by timeline cells", () => {
    const reschedules: string[][] = [];
    finishDrag(120, drag("move"), 60, "day", [task], (taskId, start, end) => reschedules.push([taskId, start, end]), () => undefined);
    expect(reschedules).toEqual([["task-1", "2026-08-04", "2026-08-06"]]);
  });

  it("resizes task start and end dates without crossing over", () => {
    const reschedules: string[][] = [];
    finishDrag(0, drag("resize-start"), 60, "day", [task], (taskId, start, end) => reschedules.push([taskId, start, end]), () => undefined);
    finishDrag(300, drag("resize-end"), 60, "day", [task], (taskId, start, end) => reschedules.push([taskId, start, end]), () => undefined);
    expect(reschedules).toEqual([
      ["task-1", "2026-08-02", "2026-08-05"],
      ["task-1", "2026-08-03", "2026-08-09"],
    ]);
  });

  it("updates progress from drag distance", () => {
    const progresses: number[] = [];
    finishDrag(150, { ...drag("progress"), barWidth: 200 }, 60, "day", [task], () => undefined, (_taskId, progress) => progresses.push(progress));
    expect(progresses).toEqual([85]);
  });
});

function drag(mode: DragState["mode"]): DragState {
  return { taskId: "task-1", mode, startX: 60 };
}

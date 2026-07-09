import { describe, expect, it } from "vitest";

import { buildTimeline, finishDrag, taskStatusIndicator, type DragState } from "./planningGanttModel";
import type { PlanningSchedule, PlanningTask } from "./types";

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

  it("snaps hour-scale date changes to whole days", () => {
    const reschedules: string[][] = [];
    finishDrag(195, drag("move"), 34, "hour", [task], (taskId, start, end) => reschedules.push([taskId, start, end]), () => undefined);
    expect(reschedules).toEqual([["task-1", "2026-08-04", "2026-08-06"]]);
  });
});

describe("planning Gantt scales", () => {
  it("builds owned minute, hour, sprint, stage, quarter, and year timeline units", () => {
    const minuteLabels = buildTimeline(schedule(), "minute", "standard").units.map((unit) => unit.label);
    expect(minuteLabels.slice(0, 3)).toEqual(["00:00", "00:30", "01:00"]);
    const hourLabels = buildTimeline(schedule(), "hour", "standard").units.map((unit) => unit.label);
    expect(hourLabels.slice(0, 4)).toEqual(["00", "06", "12", "18"]);
    expect(hourLabels.at(-2)).toBe("18");
    expect(buildTimeline(schedule(), "sprint", "standard").units[0]).toMatchObject({ label: "S16", group: "2026" });
    expect(buildTimeline(schedule(), "stage", "standard").units[0]).toMatchObject({ label: "Stage 8", group: "2026" });
    expect(buildTimeline(schedule(), "quarter", "standard").units[0]).toMatchObject({ label: "Q3", group: "2026" });
    expect(buildTimeline(schedule(), "year", "standard").units[0]).toMatchObject({ label: "2026", group: "2026" });
  });
});

describe("planning Gantt status indicators", () => {
  it("returns non-color status codes for task state", () => {
    expect(taskStatusIndicator({ ...task, progress: 0 }).code).toBe("OPEN");
    expect(taskStatusIndicator(task).code).toBe("WORK");
    expect(taskStatusIndicator({ ...task, progress: 100 }).code).toBe("DONE");
    expect(taskStatusIndicator({ ...task, status: "blocked", progress: 0 }).code).toBe("HOLD");
    expect(taskStatusIndicator({ ...task, critical: true }, true).code).toBe("CRIT");
  });
});

function drag(mode: DragState["mode"]): DragState {
  return { taskId: "task-1", mode, startX: 60 };
}

function schedule(): PlanningSchedule {
  return {
    project: { id: "project-1", name: "Project", status: "planned", start: "2026-08-03", end: "2026-09-09" },
    tasks: [task],
    dependencies: [],
    resources: [],
    assignments: [],
    baselines: [],
    calendar: { name: "Standard", working_days: [1, 2, 3, 4, 5], holidays: [] },
    validation: { ok: true, violations: [], warnings: [] },
  };
}

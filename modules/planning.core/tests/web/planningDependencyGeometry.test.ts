import { describe, expect, it } from "vitest";

import {
  buildPlanningDependencyRoutes,
  planningDependencyCompactLabel,
  planningDependencyLagLabel,
  planningDependencyPorts,
} from "../../web/src/planningDependencyGeometry";
import type { PlanningDependency, PlanningDependencyType, PlanningTask } from "../../web/src/types";

describe("Planning dependency geometry", () => {
  it("routes FS, SS, FF, and SF from their correct task-bar ports", () => {
    const types: PlanningDependencyType[] = ["finish_to_start", "start_to_start", "finish_to_finish", "start_to_finish"];
    const dependencies = types.map((dependency_type, index) => dependency(`dep-${index}`, "source", "target", dependency_type));
    const routes = route(dependencies, [task("source", "2026-01-02", "2026-01-04"), task("target", "2026-01-08", "2026-01-10")], rows("source", "target"));
    const byType = new Map(routes.map((item) => [item.dependency.dependency_type, item]));

    expect(planningDependencyPorts("finish_to_start")).toEqual({ source: "finish", target: "start" });
    expect(planningDependencyPorts("start_to_start")).toEqual({ source: "start", target: "start" });
    expect(planningDependencyPorts("finish_to_finish")).toEqual({ source: "finish", target: "finish" });
    expect(planningDependencyPorts("start_to_finish")).toEqual({ source: "start", target: "finish" });
    expect([byType.get("finish_to_start")?.sourceX, byType.get("finish_to_start")?.targetX]).toEqual([80, 140]);
    expect([byType.get("start_to_start")?.sourceX, byType.get("start_to_start")?.targetX]).toEqual([20, 140]);
    expect([byType.get("finish_to_finish")?.sourceX, byType.get("finish_to_finish")?.targetX]).toEqual([80, 200]);
    expect([byType.get("start_to_finish")?.sourceX, byType.get("start_to_finish")?.targetX]).toEqual([20, 200]);
    for (const result of routes) {
      const points = pathPoints(result.path);
      expect(points[1][0] < result.sourceX).toBe(result.sourcePort === "start");
      expect(points.at(-2)![0] < result.targetX).toBe(result.targetPort === "start");
      expect(points.at(-1)).toEqual([result.targetX, result.targetY]);
    }
  });

  it("describes zero lag, positive lag, and negative lead without changing schedule facts", () => {
    expect(planningDependencyCompactLabel("finish_to_start", 0)).toBe("FS");
    expect(planningDependencyCompactLabel("start_to_start", 3)).toBe("SS +3d");
    expect(planningDependencyCompactLabel("finish_to_finish", -2)).toBe("FF -2d");
    expect(planningDependencyLagLabel(0)).toBe("No lag");
    expect(planningDependencyLagLabel(3)).toBe("Lag 3 days");
    expect(planningDependencyLagLabel(-1)).toBe("Lead 1 day");
  });

  it("uses an exterior route for reversed and overlapping bars while preserving the target arrow direction", () => {
    const source = task("source", "2026-01-08", "2026-01-10");
    const target = task("target", "2026-01-05", "2026-01-09");
    const [result] = route([dependency("reversed", "source", "target", "finish_to_start")], [source, target], rows("source", "target"));

    expect(result.laneX).toBeGreaterThan(200);
    expect(result.path).not.toMatch(/NaN|Infinity/);
    expect(result.path).toMatch(new RegExp(`L ${result.targetX} ${result.targetY}$`));
    expect(result.sourcePort).toBe("finish");
    expect(result.targetPort).toBe("start");
  });

  it("keeps an adjacent one-cell FS link in the local gap instead of detouring around the target bar", () => {
    const source = task("source", "2026-08-03", "2026-08-03");
    const target = task("target", "2026-08-05", "2026-08-11");
    const [result] = buildPlanningDependencyRoutes({
      dependencies: [dependency("adjacent", "source", "target", "finish_to_start")],
      tasks: [source, target],
      rowLayoutByTask: rows("source", "target"),
      chartStart: new Date("2026-08-01T00:00:00"),
      scale: "day",
      cellWidth: 52,
      headerHeight: 66,
    });

    expect(result.sourceX).toBeLessThan(result.laneX);
    expect(result.laneX).toBeLessThan(result.targetX);
    expect(result.laneX).toBeLessThan(300);
  });

  it("assigns stable, separate lanes when vertical dependency spans collide", () => {
    const tasks = [
      task("source-a", "2026-01-02", "2026-01-04"),
      task("source-b", "2026-01-02", "2026-01-04"),
      task("target-a", "2026-01-08", "2026-01-10"),
      task("target-b", "2026-01-08", "2026-01-10"),
    ];
    const layouts = rowMap(tasks.map((item, index) => [item.id, index * 40]));
    const dependencies = [
      dependency("a-lane", "source-a", "target-a", "finish_to_start"),
      dependency("b-lane", "source-b", "target-b", "finish_to_start"),
    ];
    const first = route(dependencies, tasks, layouts);
    const reordered = route([...dependencies].reverse(), tasks, layouts);
    const firstById = new Map(first.map((item) => [item.dependency.id, item]));
    const reorderedById = new Map(reordered.map((item) => [item.dependency.id, item]));

    expect(firstById.get("a-lane")?.laneX).not.toBe(firstById.get("b-lane")?.laneX);
    expect(reorderedById.get("a-lane")?.path).toBe(firstById.get("a-lane")?.path);
    expect(reorderedById.get("b-lane")?.path).toBe(firstById.get("b-lane")?.path);
  });

  it("routes outside the visible bars when an intermediate task blocks the direct corridor", () => {
    const tasks = [
      task("source", "2026-01-02", "2026-01-04"),
      task("obstacle", "2026-01-05", "2026-01-07"),
      task("target", "2026-01-08", "2026-01-10"),
    ];
    const layouts = rowMap(tasks.map((item, index) => [item.id, index * 40]));
    const [result] = route([dependency("around", "source", "target", "finish_to_start")], tasks, layouts);

    expect(result.laneX).toBeGreaterThan(200);
    expect(result.path).toMatch(new RegExp(`L ${result.targetX} ${result.targetY}$`));
  });

  it("keeps exterior lanes and their labels inside the supplied timeline width", () => {
    const tasks = [task("source", "2026-01-08", "2026-01-10"), task("target", "2026-01-05", "2026-01-09")];
    const dependencies = Array.from({ length: 4 }, (_, index) => dependency(`bounded-${index}`, "source", "target", "finish_to_start"));
    const routes = buildPlanningDependencyRoutes({
      dependencies,
      tasks,
      rowLayoutByTask: rows("source", "target"),
      chartStart: new Date("2026-01-01T00:00:00"),
      scale: "day",
      cellWidth: 20,
      headerHeight: 54,
      timelineWidth: 240,
    });

    expect(new Set(routes.map((result) => result.laneX)).size).toBe(4);
    expect(routes.every((result) => result.labelX >= 32 && result.labelX <= 208)).toBe(true);
  });

  it("keeps the 500-row route model inside a bounded unit-test budget", () => {
    const tasks = Array.from({ length: 500 }, (_, index) => {
      const date = addDays("2026-01-01", index);
      return task(`task-${index}`, date, date);
    });
    const dependencies = tasks.slice(1).map((item, index) => dependency(`dep-${index}`, tasks[index].id, item.id, "finish_to_start"));
    const layouts = rowMap(tasks.map((item, index) => [item.id, index * 40]));
    const started = performance.now();
    const routes = route(dependencies, tasks, layouts);

    expect(routes).toHaveLength(499);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

function route(dependencies: PlanningDependency[], tasks: PlanningTask[], rowLayoutByTask: ReturnType<typeof rowMap>) {
  return buildPlanningDependencyRoutes({ dependencies, tasks, rowLayoutByTask, chartStart: new Date("2026-01-01T00:00:00"), scale: "day", cellWidth: 20, headerHeight: 54 });
}

function task(id: string, start: string, end: string): PlanningTask {
  return {
    id,
    project_id: "project-1",
    version: 1,
    parent_task_id: null,
    wbs: id,
    title: id,
    task_type: "task",
    status: "planned",
    start,
    end,
    duration_days: 1,
    progress: 0,
    sort_order: 1,
    critical: false,
  };
}

function dependency(id: string, predecessor_task_id: string, successor_task_id: string, dependency_type: PlanningDependencyType, lag_days = 0): PlanningDependency {
  return { id, project_id: "project-1", predecessor_task_id, successor_task_id, dependency_type, lag_days };
}

function rows(...taskIds: string[]) {
  return rowMap(taskIds.map((taskId, index) => [taskId, index * 40]));
}

function rowMap(entries: Array<[string, number]>) {
  return new Map(entries.map(([taskId, top]) => [taskId, { taskId, top, height: 40 }]));
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function pathPoints(path: string) {
  return Array.from(path.matchAll(/[ML] (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g), (match) => [Number(match[1]), Number(match[2])]);
}

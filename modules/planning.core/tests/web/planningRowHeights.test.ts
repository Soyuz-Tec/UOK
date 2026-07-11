import { describe, expect, it } from "vitest";

import { clampPlanningRowHeight, fitPlanningRowHeight, planningRowHeightStorageKey, planningRowLayoutMap, planningRowLayouts } from "../../web/src/planningRowHeights";
import type { PlanningTask } from "../../web/src/types";

describe("planning row heights", () => {
  it("builds cumulative row layouts with per-task overrides", () => {
    const { layouts, totalHeight } = planningRowLayouts([task("a"), task("b"), task("c")], 50, { b: 72 });

    expect(layouts).toEqual([
      { taskId: "a", top: 0, height: 50 },
      { taskId: "b", top: 50, height: 72 },
      { taskId: "c", top: 122, height: 50 },
    ]);
    expect(totalHeight).toBe(172);
    expect(planningRowLayoutMap(layouts).get("b")).toMatchObject({ top: 50, height: 72 });
  });

  it("clamps resized and fitted row heights", () => {
    expect(clampPlanningRowHeight(12)).toBe(34);
    expect(clampPlanningRowHeight(120)).toBe(96);
    expect(fitPlanningRowHeight(80, 50)).toBe(84);
    expect(fitPlanningRowHeight(20, 50)).toBe(50);
  });

  it("scopes persisted row heights by project", () => {
    expect(planningRowHeightStorageKey("project-1")).toContain("project-1");
    expect(planningRowHeightStorageKey("project-1")).not.toBe(planningRowHeightStorageKey("project-2"));
  });
});

function task(id: string): PlanningTask {
  return {
    id,
    project_id: "project-1",
    version: 1,
    parent_task_id: null,
    wbs: id,
    title: `Task ${id}`,
    task_type: "task",
    status: "planned",
    start: "2026-08-01",
    end: "2026-08-02",
    duration_days: 2,
    progress: 0,
    sort_order: 1,
    critical: false,
    total_slack_days: 0,
  };
}

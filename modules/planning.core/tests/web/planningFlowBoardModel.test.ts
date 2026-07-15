import { describe, expect, it } from "vitest";

import { planningFlowDropTarget, planningFlowLanes, planningFlowTargets } from "../../web/src/planningFlowBoardModel";
import { planningSchedule } from "./planningFlowBoardFixtures";

describe("planningFlowBoardModel", () => {
  it("uses the server-published lane order and preserves task order within each lane", () => {
    const schedule = planningSchedule();

    expect(planningFlowLanes(schedule).map((lane) => [lane.status, lane.tasks.map((task) => task.id)])).toEqual([
      ["planned", ["scope", "release"]],
      ["in_progress", ["build"]],
      ["blocked", []],
      ["complete", []],
    ]);
  });

  it("offers only server-published transition targets in server order", () => {
    const schedule = planningSchedule();

    expect(planningFlowTargets(schedule, schedule.tasks[0]).map((status) => status.status)).toEqual([
      "in_progress", "blocked", "complete",
    ]);
    expect(planningFlowTargets({ ...schedule, task_flow: undefined }, schedule.tasks[0])).toEqual([]);
  });

  it("resolves drop targets from the current schedule instead of drag payload data", () => {
    const schedule = planningSchedule();

    expect(planningFlowDropTarget(schedule, "scope", "in_progress")?.status).toBe("in_progress");
    expect(planningFlowDropTarget(schedule, "scope", "planned")).toBeUndefined();
    expect(planningFlowDropTarget(schedule, "unknown", "in_progress")).toBeUndefined();
    expect(planningFlowDropTarget({ ...schedule, task_flow: undefined }, "scope", "in_progress")).toBeUndefined();
  });
});

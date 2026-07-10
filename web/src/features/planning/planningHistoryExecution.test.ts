import { describe, expect, it } from "vitest";

import { planningHistoryBatchSupported } from "./planningHistoryExecution";
import type { PlanningHistoryStep } from "./planningHistory";

describe("planning history batch execution", () => {
  it("allows bounded multi-task restores through the atomic endpoint", () => {
    const steps: PlanningHistoryStep[] = [
      { kind: "update-task", taskId: "task-1", payload: { progress: 10 } },
      { kind: "update-task", taskId: "task-2", payload: { progress: 20 } },
    ];

    expect(planningHistoryBatchSupported(steps)).toBe(true);
  });

  it("keeps unsupported destructive history entries fail closed", () => {
    const steps: PlanningHistoryStep[] = [
      { kind: "update-task", taskId: "task-1", payload: { progress: 10 } },
      { kind: "delete-task", taskId: "task-2", match: { title: "Task 2" } },
    ];

    expect(planningHistoryBatchSupported(steps)).toBe(false);
    expect(planningHistoryBatchSupported([])).toBe(false);
  });
});

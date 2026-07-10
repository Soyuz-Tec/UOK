import { afterEach, describe, expect, it, vi } from "vitest";

import { executePlanningHistoryBatch, planningHistoryBatchSupported } from "./planningHistoryExecution";
import type { PlanningHistoryStep } from "./planningHistory";
import type { PlanningSchedule } from "./types";
import type { PlanningStrongEtag } from "./planningApi";

afterEach(() => vi.unstubAllGlobals());

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

  it("references the original command when applying a safe inverse", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ correlation_id: "undo-command", schedule: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json", ETag: strongEtag(3) },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const schedule = { project: { id: "project-1" } } as PlanningSchedule;
    const steps: PlanningHistoryStep[] = [{ kind: "update-task", taskId: "task-1", payload: { progress: 10 } }];

    await executePlanningHistoryBatch("token", schedule, steps, strongEtag(2), "11111111-1111-4111-8111-111111111111", "Undo Edit task");

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body.source_command_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(body.reason).toBe("Undo Edit task");
    expect(body.operations).toHaveLength(1);
  });
});

function strongEtag(revision: number) {
  return `"planning-r${revision}-sha256-${"a".repeat(64)}"` as PlanningStrongEtag;
}

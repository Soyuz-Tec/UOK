import { afterEach, describe, expect, it, vi } from "vitest";

import { batchPlanningOperations, batchPlanningTaskUpdates } from "../../web/src/planningBatchApi";
import type { PlanningStrongEtag } from "../../web/src/planningApi";

const etag1 = strongEtag(1, "a");
const etag2 = strongEtag(2, "b");

afterEach(() => vi.unstubAllGlobals());

describe("Planning atomic batch API", () => {
  it("sends one ordered task batch with stable operation identities", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ operation_results: [], schedule: {} }, 200, etag2));
    vi.stubGlobal("fetch", fetchMock);

    await batchPlanningTaskUpdates("token", "project-1", [
      { taskId: "task-1", payload: { progress: 40 } },
      { taskId: "task-2", payload: { status: "complete", progress: 100 } },
    ], { ifMatch: etag1, idempotencyKey: "planning-task-batch-intent-1" }, {
      sourceCommandId: "11111111-1111-4111-8111-111111111111",
      reason: "Undo task edits",
    });

    const [path, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(request.headers);
    const body = JSON.parse(String(request.body));
    expect(path).toBe("/api/planning/projects/project-1/mutations:batch");
    expect(headers.get("If-Match")).toBe(etag1);
    expect(headers.get("Idempotency-Key")).toBe("planning-task-batch-intent-1");
    expect(body.source_command_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(body.reason).toBe("Undo task edits");
    expect(body.operations).toEqual([
      { operation_id: "1:planning-task-batch-intent-1", kind: "update_task", payload: { task_id: "task-1", progress: 40 } },
      { operation_id: "2:planning-task-batch-intent-1", kind: "update_task", payload: { task_id: "task-2", status: "complete", progress: 100 } },
    ]);
  });

  it("sends the generated ten-kind discriminated contract without erasing payload types", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ operation_results: [], schedule: {} }, 200, etag2));
    vi.stubGlobal("fetch", fetchMock);
    const operations = [
      { operation_id: "1", kind: "update_task" as const, payload: { task_id: "task-1", progress: 30 } },
      { operation_id: "2", kind: "create_dependency" as const, payload: { predecessor_task_id: "task-1", successor_task_id: "task-2", dependency_type: "finish_to_start" as const, lag_days: 0 } },
      { operation_id: "3", kind: "update_dependency" as const, payload: { dependency_id: "dep-1", lag_days: 1 } },
      { operation_id: "4", kind: "remove_dependency" as const, payload: { dependency_id: "dep-1" } },
      { operation_id: "5", kind: "assign_resource" as const, payload: { task_id: "task-1", resource_id: "resource-1", allocation_percent: 80 } },
      { operation_id: "6", kind: "unassign_resource" as const, payload: { task_id: "task-1", resource_id: "resource-1" } },
      { operation_id: "7", kind: "set_calendar" as const, payload: { name: "Standard", working_days: [1, 2, 3, 4, 5], holidays: [], ignored_periods: [] } },
      { operation_id: "8", kind: "create_link" as const, payload: { scope_type: "task" as const, task_id: "task-1", relationship: "implements" as const, blocking: false, target: { kind: "operation" as const, id: "operation-1" } } },
      { operation_id: "9", kind: "remove_link" as const, payload: { link_id: "link-1" } },
      { operation_id: "10", kind: "transition_gate" as const, payload: { task_id: "task-1", requirement_id: "requirement-1", action: "submit" as const } },
    ];

    await batchPlanningOperations("token", "project-1", { reason: "Apply one governed proposal", operations }, {
      ifMatch: etag1,
      idempotencyKey: "planning-mixed-batch-intent-1",
    });

    const [path, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/planning/projects/project-1/mutations:batch");
    expect(JSON.parse(String(request.body)).operations.map((item: { kind: string }) => item.kind)).toEqual([
      "update_task", "create_dependency", "update_dependency", "remove_dependency", "assign_resource",
      "unassign_resource", "set_calendar", "create_link", "remove_link", "transition_gate",
    ]);
  });
});

function jsonResponse(value: unknown, status = 200, etag?: PlanningStrongEtag) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (etag) headers.set("ETag", etag);
  return new Response(JSON.stringify(value), { status, headers });
}

function strongEtag(revision: number, character: string) {
  return `"planning-r${revision}-sha256-${character.repeat(64)}"` as PlanningStrongEtag;
}

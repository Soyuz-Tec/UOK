import { afterEach, describe, expect, it, vi } from "vitest";

import { planningCommand, updatePlanningTask } from "./planningApi";

describe("Planning API idempotency", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes one explicit mutation intent key unchanged to a REST write", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: "ok" }));
    vi.stubGlobal("fetch", fetchMock);

    await updatePlanningTask(
      "token",
      "task-1",
      { progress: 40 },
      { idempotencyKey: "planning-task-intent-1" },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/planning/tasks/task-1",
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({
          Authorization: "Bearer token",
          "Idempotency-Key": "planning-task-intent-1",
        }),
      }),
    );
  });

  it("passes one explicit mutation intent key unchanged to the command gateway", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ result: {}, status: "succeeded" }));
    vi.stubGlobal("fetch", fetchMock);

    await planningCommand(
      "token",
      "LevelPlanningResources",
      { project_id: "project-1" },
      "planning-level",
      { idempotencyKey: "planning-level-intent-1" },
    );

    const [, request] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(request.body))).toMatchObject({
      command_type: "LevelPlanningResources",
      idempotency_key: "planning-level-intent-1",
    });
  });
});

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

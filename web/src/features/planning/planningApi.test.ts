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

  it("reuses one generated REST key when a lost response triggers a network retry", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("{", { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValue(jsonResponse({ status: "ok" }));
    vi.stubGlobal("fetch", fetchMock);

    await updatePlanningTask("token", "task-1", { progress: 60 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstKey = fetchMock.mock.calls[0][1].headers["Idempotency-Key"];
    const secondKey = fetchMock.mock.calls[1][1].headers["Idempotency-Key"];
    expect(firstKey).toMatch(/^planning-task-update:/);
    expect(secondKey).toBe(firstKey);
  });

  it("reuses one generated command key when a lost response triggers a network retry", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("network response lost"))
      .mockResolvedValue(jsonResponse({ result: {}, status: "succeeded" }));
    vi.stubGlobal("fetch", fetchMock);

    await planningCommand("token", "LevelPlanningResources", { project_id: "project-1" }, "planning-level");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1][1].body));
    expect(firstBody.idempotency_key).toMatch(/^planning-level:/);
    expect(secondBody.idempotency_key).toBe(firstBody.idempotency_key);
  });

  it("does not retry an HTTP conflict response", async () => {
    const error = { detail: { error: "idempotency conflict" } };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(error), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(updatePlanningTask("token", "task-1", { progress: 80 })).rejects.toEqual(error);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

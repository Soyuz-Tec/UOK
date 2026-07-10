import { afterEach, describe, expect, it, vi } from "vitest";

import {
  batchPlanningTaskUpdates,
  comparePlanningBaselines,
  createPlanningProject,
  loadPlanningCapabilities,
  loadPlanningBaseline,
  loadPlanningSchedule,
  PlanningApiError,
  PlanningPreconditionError,
  planningCommand,
  type PlanningStrongEtag,
  updatePlanningTask,
} from "./planningApi";

const etag1 = strongEtag(1, "a");
const etag2 = strongEtag(2, "b");

describe("Planning API concurrency and idempotency", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("captures the strong schedule ETag with the read model", async () => {
    const schedule = { project: { id: "project-1", revision: 1 }, tasks: [] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(schedule, 200, etag1)));

    await expect(loadPlanningSchedule("token", "project-1")).resolves.toEqual({ schedule, etag: etag1 });
  });

  it("loads the server-derived Planning capability matrix", async () => {
    const capabilities = { read: true, edit: false, baseline_create: false, level: false, link: false, gate_approve: false, admin: false, review_only: true };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(capabilities));
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadPlanningCapabilities("token")).resolves.toEqual(capabilities);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/planning/capabilities");
  });

  it("uses typed immutable baseline detail and comparison reads", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ id: "baseline-1", completeness: "complete", integrity: { verified: true } }))
      .mockResolvedValueOnce(jsonResponse({ supported: true, changes: { tasks: { changed: ["task-1"] } } }));
    vi.stubGlobal("fetch", fetchMock);

    await loadPlanningBaseline("token", "project-1", "baseline-1");
    await comparePlanningBaselines("token", "project-1", "baseline-1", "baseline-2");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/planning/projects/project-1/baselines/baseline-1");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/planning/projects/project-1/baselines/compare?left_baseline_id=baseline-1&right_baseline_id=baseline-2");
  });

  it("sends exact If-Match and one explicit intent key to a REST write", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: "ok" }, 200, etag2));
    vi.stubGlobal("fetch", fetchMock);

    await updatePlanningTask("token", "task-1", { progress: 40 }, {
      ifMatch: etag1,
      idempotencyKey: "planning-task-intent-1",
    });

    const [path, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(request.headers);
    expect(path).toBe("/api/planning/tasks/task-1");
    expect(request.method).toBe("PATCH");
    expect(headers.get("Authorization")).toBe("Bearer token");
    expect(headers.get("Idempotency-Key")).toBe("planning-task-intent-1");
    expect(headers.get("If-Match")).toBe(etag1);
  });

  it("sends one ordered task batch with stable operation identities", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ operation_results: [], schedule: {} }, 200, etag2));
    vi.stubGlobal("fetch", fetchMock);

    await batchPlanningTaskUpdates("token", "project-1", [
      { taskId: "task-1", payload: { progress: 40 } },
      { taskId: "task-2", payload: { status: "complete", progress: 100 } },
    ], { ifMatch: etag1, idempotencyKey: "planning-task-batch-intent-1" });

    const [path, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(request.headers);
    const body = JSON.parse(String(request.body));
    expect(path).toBe("/api/planning/projects/project-1/mutations:batch");
    expect(headers.get("If-Match")).toBe(etag1);
    expect(headers.get("Idempotency-Key")).toBe("planning-task-batch-intent-1");
    expect(body.operations).toEqual([
      { operation_id: "1:planning-task-batch-intent-1", kind: "update_task", payload: { task_id: "task-1", progress: 40 } },
      { operation_id: "2:planning-task-batch-intent-1", kind: "update_task", payload: { task_id: "task-2", status: "complete", progress: 100 } },
    ]);
  });

  it("reuses If-Match and the generated key when a lost response triggers one retry", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("{", { status: 200, headers: { "Content-Type": "application/json", ETag: etag2 } }))
      .mockResolvedValue(jsonResponse({ status: "ok" }, 200, etag2));
    vi.stubGlobal("fetch", fetchMock);

    await updatePlanningTask("token", "task-1", { progress: 60 }, { ifMatch: etag1 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstHeaders = new Headers(fetchMock.mock.calls[0][1].headers);
    const secondHeaders = new Headers(fetchMock.mock.calls[1][1].headers);
    expect(firstHeaders.get("Idempotency-Key")).toMatch(/^planning-task-update:/);
    expect(secondHeaders.get("Idempotency-Key")).toBe(firstHeaders.get("Idempotency-Key"));
    expect(firstHeaders.get("If-Match")).toBe(etag1);
    expect(secondHeaders.get("If-Match")).toBe(etag1);
  });

  it("maps stale writes to a typed 412 error without transport retry", async () => {
    const fetchMock = vi.fn().mockResolvedValue(preconditionResponse(412, "stale_precondition"));
    vi.stubGlobal("fetch", fetchMock);

    const request = updatePlanningTask("token", "task-1", { progress: 80 }, { ifMatch: etag1 });

    await expect(request).rejects.toBeInstanceOf(PlanningPreconditionError);
    await expect(request).rejects.toMatchObject({
      status: 412,
      detail: { code: "stale_precondition", current_revision: 2, current_etag: etag2 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps a missing precondition response to a typed 428 error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(preconditionResponse(428, "precondition_required")));

    await expect(updatePlanningTask("token", "task-1", { progress: 80 }, { ifMatch: etag1 })).rejects.toMatchObject({
      status: 428,
      detail: { code: "precondition_required", reload_url: "/api/planning/projects/project-1/schedule" },
    });
  });

  it("keeps an HTTP 409 outside stale-write recovery", async () => {
    const error = { detail: { error: "idempotency conflict" } };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(error, 409));
    vi.stubGlobal("fetch", fetchMock);

    const request = updatePlanningTask("token", "task-1", { progress: 80 }, { ifMatch: etag1 });
    await expect(request).rejects.toBeInstanceOf(PlanningApiError);
    await expect(request).rejects.toMatchObject({ status: 409, message: "idempotency conflict" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends If-Match through the generic Planning command path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ result: {}, status: "succeeded" }, 200, etag2));
    vi.stubGlobal("fetch", fetchMock);

    await planningCommand("token", "LevelPlanningResources", { project_id: "project-1" }, "planning-level", {
      ifMatch: etag1,
      idempotencyKey: "planning-level-intent-1",
    });

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = new Headers(request.headers);
    expect(headers.get("If-Match")).toBe(etag1);
    expect(JSON.parse(String(request.body))).toMatchObject({ idempotency_key: "planning-level-intent-1" });
  });

  it("creates a new aggregate without If-Match and captures its initial ETag", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "project-1", revision: 1 }, 200, etag1));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createPlanningProject("token", { name: "Plan", start: "2026-08-01", end: "2026-08-02" }, {
      idempotencyKey: "planning-project-intent-1",
    })).resolves.toMatchObject({ data: { id: "project-1" }, etag: etag1 });

    const headers = new Headers(fetchMock.mock.calls[0][1].headers);
    expect(headers.get("Idempotency-Key")).toBe("planning-project-intent-1");
    expect(headers.has("If-Match")).toBe(false);
  });
});

function preconditionResponse(status: 412 | 428, code: string) {
  return jsonResponse({
    error: {
      code,
      message: "The schedule changed.",
      repair: "Reload and review.",
      current_revision: 2,
      current_etag: etag2,
      object_ids: ["project-1"],
      reload_url: "/api/planning/projects/project-1/schedule",
    },
  }, status, etag2);
}

function jsonResponse(value: unknown, status = 200, etag?: PlanningStrongEtag) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (etag) headers.set("ETag", etag);
  return new Response(JSON.stringify(value), { status, headers });
}

function strongEtag(revision: number, character: string) {
  return `"planning-r${revision}-sha256-${character.repeat(64)}"` as PlanningStrongEtag;
}

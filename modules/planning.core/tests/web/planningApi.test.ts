import { afterEach, describe, expect, it, vi } from "vitest";

import {
  comparePlanningBaselines,
  createPlanningLink,
  createPlanningProject,
  loadPlanningCapabilities,
  loadPlanningBaseline,
  loadPlanningSchedule,
  PlanningApiError,
  PlanningDomainError,
  PlanningPreconditionError,
  planningCommand,
  removePlanningLink,
  transitionPlanningProject,
  type PlanningStrongEtag,
  updatePlanningTask,
  updatePlanningTaskDates,
} from "../../web/src/planningApi";

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
    const capabilities = { read: true, edit: false, baseline_create: false, level: false, link: false, gate_approve: false, admin: false, analyze: false, analysis_approve: false, review_only: true };
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

  it("sends typed execution dates through their dedicated concurrency-guarded route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ task: { id: "task-1" } }, 200, etag2));
    vi.stubGlobal("fetch", fetchMock);

    await updatePlanningTaskDates("token", "task-1", {
      forecast_end: "2026-08-12",
      actual_start: "2026-08-10",
      reason: "Observed operating start",
    }, { ifMatch: etag1, idempotencyKey: "planning-task-dates-1" });

    const [path, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/planning/tasks/task-1/dates");
    expect(JSON.parse(String(request.body))).toEqual({ forecast_end: "2026-08-12", actual_start: "2026-08-10", reason: "Observed operating start" });
    expect(new Headers(request.headers).get("If-Match")).toBe(etag1);
    expect(new Headers(request.headers).get("Idempotency-Key")).toBe("planning-task-dates-1");
  });

  it("uses typed revision-aware create and remove requests for Planning links", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ id: "link-1", resolution: { status: "ready" } }, 201, etag2))
      .mockResolvedValueOnce(jsonResponse({ id: "link-1", removed: true }, 200, etag1));
    vi.stubGlobal("fetch", fetchMock);

    await createPlanningLink("token", "project-1", {
      scope_type: "task",
      task_id: "task-1",
      relationship: "owned_by",
      target: { kind: "party", id: "party-1" },
    }, { ifMatch: etag1, idempotencyKey: "planning-link-create-1" });
    await removePlanningLink("token", "project-1", "link-1", { ifMatch: etag2, idempotencyKey: "planning-link-remove-1" });

    const [createPath, createRequest] = fetchMock.mock.calls[0] as [string, RequestInit];
    const [removePath, removeRequest] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(createPath).toBe("/api/planning/projects/project-1/links");
    expect(JSON.parse(String(createRequest.body))).toMatchObject({ relationship: "owned_by", target: { kind: "party", id: "party-1" } });
    expect(new Headers(createRequest.headers).get("If-Match")).toBe(etag1);
    expect(removePath).toBe("/api/planning/projects/project-1/links/link-1");
    expect(removeRequest.method).toBe("DELETE");
    expect(new Headers(removeRequest.headers).get("Idempotency-Key")).toBe("planning-link-remove-1");
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

  it.each([
    [400, "planning_validation_failed", "progress"],
    [403, "permission_denied", null],
    [409, "idempotency_conflict", "idempotency_key"],
  ])("maps HTTP %i to a typed domain error without transport retry", async (status, code, field) => {
    const fetchMock = vi.fn().mockResolvedValue(domainResponse(status, code, field));
    vi.stubGlobal("fetch", fetchMock);

    const request = updatePlanningTask("token", "task-1", { progress: 80 }, { ifMatch: etag1 });
    await expect(request).rejects.toBeInstanceOf(PlanningDomainError);
    await expect(request).rejects.toMatchObject({
      status,
      message: `${code} message`,
      detail: {
        code,
        field,
        object_ids: ["project-1", "task-1"],
        repair: "Correct the request.",
        current_revision: 2,
        correlation_id: "command-correlation-1",
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps an unstructured HTTP failure as the generic API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ detail: { error: "legacy conflict" } }, 409)));

    await expect(updatePlanningTask("token", "task-1", { progress: 80 }, { ifMatch: etag1 })).rejects.toBeInstanceOf(PlanningApiError);
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

  it("transitions a project through the strict reasoned endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "project-1", status: "archived", revision: 2 }, 200, etag2));
    vi.stubGlobal("fetch", fetchMock);

    await transitionPlanningProject("token", "project-1", {
      target_status: "archived", reason: "Plan retained for audit",
    }, { ifMatch: etag1, idempotencyKey: "planning-transition-intent-1" });

    expect(fetchMock.mock.calls[0][0]).toBe("/api/planning/projects/project-1/transitions");
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(request.headers).get("If-Match")).toBe(etag1);
    expect(JSON.parse(String(request.body))).toEqual({ target_status: "archived", reason: "Plan retained for audit" });
  });
});

function preconditionResponse(status: 412 | 428, code: string) {
  return jsonResponse({
    error: {
      code,
      message: "The schedule changed.",
      field: "If-Match",
      repair: "Reload and review.",
      current_revision: 2,
      current_etag: etag2,
      object_ids: ["project-1"],
      reload_url: "/api/planning/projects/project-1/schedule",
      correlation_id: "precondition-correlation-1",
    },
  }, status, etag2);
}

function domainResponse(status: number, code: string, field: string | null) {
  return jsonResponse({
    error: {
      code,
      message: `${code} message`,
      field,
      object_ids: ["project-1", "task-1"],
      repair: "Correct the request.",
      current_revision: 2,
      correlation_id: "command-correlation-1",
    },
  }, status);
}

function jsonResponse(value: unknown, status = 200, etag?: PlanningStrongEtag) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (etag) headers.set("ETag", etag);
  return new Response(JSON.stringify(value), { status, headers });
}

function strongEtag(revision: number, character: string) {
  return `"planning-r${revision}-sha256-${character.repeat(64)}"` as PlanningStrongEtag;
}

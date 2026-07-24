import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PlanningStrongEtag } from "../../web/src/planningApi";
import type { PlanningProject, PlanningSchedule } from "../../web/src/types";
import { usePlanningWorkspaceMutations } from "../../web/src/usePlanningWorkspaceMutations";

const etag1 = strongEtag(1, "a");
const etag2 = strongEtag(2, "b");
const etag3 = strongEtag(3, "c");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("usePlanningWorkspaceMutations concurrency recovery", () => {
  it("keeps an inverse revision-aware and references the original command", async () => {
    const batchRequests: RequestInit[] = [];
    let scheduleReads = 0;
    const sourceCommandId = "11111111-1111-4111-8111-111111111111";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const path = String(input);
      if (path === "/api/planning/projects") return jsonResponse([schedule(1).project]);
      if (path.endsWith("/schedule")) {
        scheduleReads += 1;
        if (scheduleReads === 1) return jsonResponse(schedule(1), 200, etag1);
        if (scheduleReads === 2) return jsonResponse(schedule(2, "Own edit"), 200, etag2);
        return jsonResponse(schedule(3, "Remote edit"), 200, etag3);
      }
      if (path === "/api/planning/tasks/task-1") {
        return jsonResponse({ task: { id: "task-1" }, correlation_id: sourceCommandId }, 200, etag2);
      }
      if (path.endsWith("/mutations:batch")) {
        batchRequests.push(init);
        return preconditionResponse(etag3, 3);
      }
      throw new Error(`Unexpected Planning test request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(usePlanningHarness);
    await waitFor(() => expect(result.current.actions.scheduleEtag).toBe(etag1));
    await act(async () => {
      await result.current.actions.saveTask("task-1", { title: "Own edit" });
    });
    await waitFor(() => expect(result.current.actions.history.canUndo).toBe(true));
    expect(result.current.selectedTaskId).toBe("task-1");

    await act(async () => {
      await result.current.actions.runHistory("undo");
    });

    await waitFor(() => expect(result.current.actions.staleRecovery).toMatchObject({ label: "Undo Edit task", reloadFailed: false }));
    expect(result.current.schedule?.project.revision).toBe(3);
    expect(result.current.schedule?.tasks[0].title).toBe("Remote edit");
    expect(batchRequests).toHaveLength(1);
    const body = JSON.parse(String(batchRequests[0].body));
    expect(body.source_command_id).toBe(sourceCommandId);
    expect(body.reason).toBe("Undo Edit task");
    expect(result.current.actions.history.canUndo).toBe(false);
  });

  it("surfaces structured domain repair and audit details", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/planning/projects") return jsonResponse([schedule(1).project]);
      if (path.endsWith("/schedule")) return jsonResponse(schedule(1), 200, etag1);
      if (path === "/api/planning/tasks/task-1") return jsonResponse({
        error: {
          code: "planning_validation_failed",
          message: "progress must be between 0 and 100",
          field: "progress",
          object_ids: ["project-1", "task-1"],
          repair: "Set progress to a value from 0 to 100.",
          current_revision: 1,
          correlation_id: "command-correlation-1",
        },
      }, 400);
      throw new Error(`Unexpected Planning test request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(usePlanningHarness);
    await waitFor(() => expect(result.current.actions.scheduleEtag).toBe(etag1));
    await act(async () => {
      await result.current.actions.saveTask("task-1", { progress: 101 });
    });

    expect(result.current.actions.status).toEqual({
      status: "error",
      http_status: 400,
      code: "planning_validation_failed",
      message: "progress must be between 0 and 100",
      field: "progress",
      object_ids: ["project-1", "task-1"],
      repair: "Set progress to a value from 0 to 100.",
      current_revision: 1,
      correlation_id: "command-correlation-1",
    });
  });

  it("reloads a stale schedule and re-applies only after explicit confirmation", async () => {
    const mutationRequests: RequestInit[] = [];
    let scheduleReads = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const path = String(input);
      if (path === "/api/planning/projects") return jsonResponse([schedule(1).project]);
      if (path.endsWith("/schedule")) {
        scheduleReads += 1;
        if (scheduleReads === 1) return jsonResponse(schedule(1), 200, etag1);
        if (scheduleReads === 2) return jsonResponse(schedule(2, "Changed by another planner"), 200, etag2);
        return jsonResponse(schedule(3, "Reapplied task edit"), 200, etag3);
      }
      if (path === "/api/planning/tasks/task-1") {
        mutationRequests.push(init);
        if (mutationRequests.length === 1) return preconditionResponse();
        return jsonResponse({ task: { id: "task-1", version: 3 } }, 200, etag3);
      }
      throw new Error(`Unexpected Planning test request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(usePlanningHarness);
    await waitFor(() => expect(result.current.actions.scheduleEtag).toBe(etag1));

    await act(async () => {
      await result.current.actions.saveTask("task-1", { title: "Reapplied task edit" });
    });

    await waitFor(() => expect(result.current.actions.staleRecovery).toMatchObject({ label: "Edit task", reloadFailed: false }));
    expect(result.current.schedule?.project.revision).toBe(2);
    expect(result.current.schedule?.tasks[0].title).toBe("Changed by another planner");
    expect(mutationRequests).toHaveLength(1);
    expect(new Headers(mutationRequests[0].headers).get("If-Match")).toBe(etag1);

    await act(async () => {
      await result.current.actions.reapplyStaleMutation();
    });

    await waitFor(() => expect(result.current.actions.staleRecovery).toBeNull());
    expect(result.current.actions.scheduleEtag).toBe(etag3);
    expect(result.current.schedule?.project.revision).toBe(3);
    expect(mutationRequests).toHaveLength(2);
    const firstHeaders = new Headers(mutationRequests[0].headers);
    const secondHeaders = new Headers(mutationRequests[1].headers);
    expect(secondHeaders.get("If-Match")).toBe(etag2);
    expect(secondHeaders.get("Idempotency-Key")).not.toBe(firstHeaders.get("Idempotency-Key"));
  });

  it("returns a rejected outcome when stale recovery reloads the requested remote status", async () => {
    let scheduleReads = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/planning/projects") return jsonResponse([schedule(1).project]);
      if (path.endsWith("/schedule")) {
        scheduleReads += 1;
        const current = schedule(scheduleReads === 1 ? 1 : 2);
        if (scheduleReads > 1) current.tasks[0].status = "in_progress";
        return jsonResponse(current, 200, scheduleReads === 1 ? etag1 : etag2);
      }
      if (path === "/api/planning/tasks/task-1") return preconditionResponse();
      throw new Error(`Unexpected Planning test request: ${path}`);
    }));

    const { result } = renderHook(usePlanningHarness);
    await waitFor(() => expect(result.current.actions.scheduleEtag).toBe(etag1));
    let applied = true;
    await act(async () => {
      applied = await result.current.actions.saveTaskWithOutcome("task-1", { status: "in_progress" });
    });

    expect(applied).toBe(false);
    expect(result.current.schedule?.tasks[0].status).toBe("in_progress");
    expect(result.current.actions.staleRecovery).toMatchObject({ label: "Edit task", reloadFailed: false });
  });

  it("submits bulk updates as one atomic batch and reloads once", async () => {
    const batchRequests: RequestInit[] = [];
    let scheduleReads = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const path = String(input);
      if (path === "/api/planning/projects") return jsonResponse([schedule(1).project]);
      if (path.endsWith("/schedule")) {
        scheduleReads += 1;
        return scheduleReads === 1 ? jsonResponse(schedule(1), 200, etag1) : jsonResponse(schedule(2, "Bulk update applied"), 200, etag2);
      }
      if (path.endsWith("/mutations:batch")) {
        batchRequests.push(init);
        return jsonResponse({ correlation_id: "batch-1", previous_revision: 1, revision: 2, operation_results: [], schedule: schedule(2) }, 200, etag2);
      }
      throw new Error(`Unexpected Planning test request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(usePlanningHarness);
    await waitFor(() => expect(result.current.actions.scheduleEtag).toBe(etag1));
    await act(async () => {
      await result.current.actions.saveTaskBatch([
        { taskId: "task-1", payload: { progress: 25 } },
        { taskId: "task-2", payload: { progress: 25 } },
      ]);
    });

    expect(batchRequests).toHaveLength(1);
    expect(new Headers(batchRequests[0].headers).get("If-Match")).toBe(etag1);
    const body = JSON.parse(String(batchRequests[0].body));
    expect(body.operations).toHaveLength(2);
    expect(body.operations).toEqual([
      expect.objectContaining({ kind: "update_task", payload: { task_id: "task-1", progress: 25 } }),
      expect.objectContaining({ kind: "update_task", payload: { task_id: "task-2", progress: 25 } }),
    ]);
    expect(result.current.actions.status).toMatchObject({ status: "validated", action: "bulk_task_update", tasks: 2 });
    expect(result.current.actions.bulkUpdatesAvailable).toBe(true);
    expect(result.current.schedule?.project.revision).toBe(2);
  });
});

function usePlanningHarness() {
  const [projects, setProjects] = useState<PlanningProject[]>([]);
  const [scheduleState, setSchedule] = useState<PlanningSchedule | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState("project-1");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const actions = usePlanningWorkspaceMutations({
    token: "token",
    operational: true,
    schedule: scheduleState,
    selectedProjectId,
    setProjects,
    setSchedule,
    setSelectedProjectId,
    setSelectedTaskId,
  });
  return { actions, projects, schedule: scheduleState, selectedProjectId, selectedTaskId };
}

function schedule(revision: number, title = "Original task"): PlanningSchedule {
  return {
    project: { id: "project-1", name: "Project", status: "active", start: "2026-08-01", end: "2026-08-30", target_finish: "2026-08-30", calculated_finish: "2026-08-30", revision },
    tasks: [{
      id: "task-1",
      project_id: "project-1",
      version: revision,
      parent_task_id: null,
      wbs: "1",
      title,
      task_type: "task",
      status: "planned",
      start: "2026-08-01",
      end: "2026-08-02",
      duration_days: 2,
      progress: 0,
      sort_order: 1,
      critical: false,
    }],
    dependencies: [],
    resources: [],
    assignments: [],
    links: [],
    baselines: [],
    validation: { ok: true, violations: [] },
  };
}

function preconditionResponse(etag = etag2, revision = 2) {
  return jsonResponse({
    error: {
      code: "stale_precondition",
      message: "The Planning schedule changed after it was loaded.",
      field: "If-Match",
      repair: "Review and explicitly reapply or keep the current version.",
      current_revision: revision,
      current_etag: etag,
      object_ids: ["project-1"],
      reload_url: "/api/planning/projects/project-1/schedule",
      correlation_id: "stale-correlation-1",
    },
  }, 412, etag);
}

function jsonResponse(value: unknown, status = 200, etag?: PlanningStrongEtag) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (etag) headers.set("ETag", etag);
  return new Response(JSON.stringify(value), { status, headers });
}

function strongEtag(revision: number, character: string) {
  return `"planning-r${revision}-sha256-${character.repeat(64)}"` as PlanningStrongEtag;
}

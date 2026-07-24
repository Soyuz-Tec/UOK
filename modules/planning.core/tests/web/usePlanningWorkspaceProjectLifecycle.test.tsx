import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PlanningStrongEtag } from "../../web/src/planningApi";
import type { PlanningProject, PlanningSchedule } from "../../web/src/types";
import { usePlanningWorkspaceMutations } from "../../web/src/usePlanningWorkspaceMutations";

const etag1 = `"planning-r1-sha256-${"a".repeat(64)}"` as PlanningStrongEtag;
const etag2 = `"planning-r2-sha256-${"b".repeat(64)}"` as PlanningStrongEtag;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Planning project lifecycle workspace actions", () => {
  it("keeps an archived-only catalog readable on initial load", async () => {
    const archived = { ...project("project-archived", "Archived plan"), status: "archived" as const };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/planning/projects") return jsonResponse([archived]);
      if (path === "/api/planning/projects/project-archived/schedule") return jsonResponse(schedule(archived), 200, etag1);
      throw new Error(`Unexpected Planning test request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => usePlanningHarness(""));

    await waitFor(() => expect(result.current.schedule?.project.status).toBe("archived"));
    expect(result.current.selectedProjectId).toBe("project-archived");
    expect(result.current.actions.scheduleEtag).toBe(etag1);
  });

  it("archives with reason and concurrency metadata, then selects the next active project", async () => {
    const first = project("project-1", "Primary");
    const second = project("project-2", "Fallback");
    let archived = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const path = String(input);
      if (path === "/api/planning/projects/project-1/transitions") {
        archived = true;
        return jsonResponse({ ...first, status: "archived", revision: 2 }, 200, etag2);
      }
      if (path === "/api/planning/projects") {
        return jsonResponse(archived ? [{ ...first, status: "archived", revision: 2 }, second] : [first, second]);
      }
      if (path === "/api/planning/projects/project-1/schedule") return jsonResponse(schedule(first), 200, etag1);
      if (path === "/api/planning/projects/project-2/schedule") return jsonResponse(schedule(second), 200, etag1);
      throw new Error(`Unexpected Planning test request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => usePlanningHarness("project-1"));
    await waitFor(() => expect(result.current.schedule?.project.id).toBe("project-1"));
    let fallback = "";
    await act(async () => { fallback = await result.current.actions.deleteProject("Duplicate planning record"); });

    expect(fallback).toBe("project-2");
    expect(result.current.selectedProjectId).toBe("project-2");
    expect(result.current.schedule?.project.id).toBe("project-2");
    expect(result.current.actions.staleRecovery).toBeNull();
    expect(result.current.actions.status).toMatchObject({ action: "project_archived", selected_project_id: "project-2" });

    const request = fetchMock.mock.calls.find(([path]) => path === "/api/planning/projects/project-1/transitions")?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      expected_revision: 1,
      target_status: "archived",
      reason: "Duplicate planning record",
    });
    const headers = new Headers(request.headers);
    expect(headers.get("If-Match")).toBe(etag1);
    expect(headers.get("Idempotency-Key")).toMatch(/^planning-project-transition:/);
  });

  it("reloads stale project state without enabling generic mutation reapply", async () => {
    const first = project("project-1", "Primary");
    const latest = { ...first, revision: 2, name: "Primary updated elsewhere" };
    let scheduleReads = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/planning/projects/project-1/transitions") return jsonResponse({
        error: {
          code: "stale_precondition",
          message: "The Planning schedule changed after it was loaded.",
          field: "If-Match",
          object_ids: [first.id],
          repair: "Review the latest schedule.",
          current_revision: 2,
          current_etag: etag2,
          reload_url: `/api/planning/projects/${first.id}/schedule`,
          correlation_id: "stale-delete-1",
        },
      }, 412, etag2);
      if (path === "/api/planning/projects") return jsonResponse([first]);
      if (path === "/api/planning/projects/project-1/schedule") {
        scheduleReads += 1;
        return scheduleReads === 1 ? jsonResponse(schedule(first), 200, etag1) : jsonResponse(schedule(latest), 200, etag2);
      }
      throw new Error(`Unexpected Planning test request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => usePlanningHarness("project-1"));
    await waitFor(() => expect(result.current.actions.scheduleEtag).toBe(etag1));
    await act(async () => {
      await expect(result.current.actions.deleteProject("No longer needed")).rejects.toThrow();
    });

    expect(result.current.schedule?.project).toMatchObject({ revision: 2, name: "Primary updated elsewhere" });
    expect(result.current.actions.scheduleEtag).toBe(etag2);
    expect(result.current.actions.staleRecovery).toBeNull();
    expect(result.current.actions.status).toMatchObject({
      status: "error",
      code: "stale_precondition",
      repair: "The latest schedule is loaded. Review it, then confirm Delete project again.",
    });
    expect(fetchMock.mock.calls.filter(([path]) => path === "/api/planning/projects/project-1/transitions")).toHaveLength(1);
  });

  it("restores an archived project through the same reasoned transition contract", async () => {
    const archived = { ...project("project-1", "Archived plan"), status: "archived" as const };
    const active = { ...archived, status: "active" as const, revision: 2 };
    let restored = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const path = String(input);
      if (path === "/api/planning/projects/project-1/transitions") {
        restored = true;
        return jsonResponse(active, 200, etag2);
      }
      if (path === "/api/planning/projects") return jsonResponse([restored ? active : archived]);
      if (path === "/api/planning/projects/project-1/schedule") return jsonResponse(schedule(restored ? active : archived), 200, restored ? etag2 : etag1);
      throw new Error(`Unexpected Planning test request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => usePlanningHarness("project-1"));
    await waitFor(() => expect(result.current.schedule?.project.status).toBe("archived"));
    await act(async () => { await result.current.actions.restoreProject("Planning work resumed"); });

    expect(result.current.selectedProjectId).toBe("project-1");
    expect(result.current.schedule?.project.status).toBe("active");
    expect(result.current.actions.status).toMatchObject({ action: "project_restored" });
    const request = fetchMock.mock.calls.find(([path]) => path === "/api/planning/projects/project-1/transitions")?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      expected_revision: 1,
      target_status: "active",
      reason: "Planning work resumed",
    });
  });

  it("rejects stale confirmed task deletion after reloading without enabling generic reapply", async () => {
    const first = project("project-1", "Primary");
    const initialSchedule = scheduleWithTask(first, "Delivery task");
    const latestSchedule = scheduleWithTask({ ...first, revision: 2 }, "Delivery task changed elsewhere");
    let scheduleReads = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/planning/tasks/task-1") return jsonResponse({
        error: {
          code: "stale_precondition",
          message: "The Planning schedule changed after it was loaded.",
          field: "If-Match",
          object_ids: [first.id, "task-1"],
          repair: "Review the latest schedule.",
          current_revision: 2,
          current_etag: etag2,
          reload_url: `/api/planning/projects/${first.id}/schedule`,
          correlation_id: "stale-task-delete-1",
        },
      }, 412, etag2);
      if (path === "/api/planning/projects") return jsonResponse([first]);
      if (path === "/api/planning/projects/project-1/schedule") {
        scheduleReads += 1;
        return scheduleReads === 1 ? jsonResponse(initialSchedule, 200, etag1) : jsonResponse(latestSchedule, 200, etag2);
      }
      throw new Error(`Unexpected Planning test request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => usePlanningHarness("project-1"));
    await waitFor(() => expect(result.current.actions.scheduleEtag).toBe(etag1));
    await act(async () => {
      await expect(result.current.actions.removeTask("task-1")).rejects.toThrow("confirm Delete task again");
    });

    expect(result.current.schedule?.tasks[0].title).toBe("Delivery task changed elsewhere");
    expect(result.current.actions.scheduleEtag).toBe(etag2);
    expect(result.current.actions.staleRecovery).toBeNull();
    expect(result.current.actions.status).toMatchObject({
      status: "stale",
      code: "stale_precondition",
      repair: "The latest schedule is loaded. Review it, then confirm Delete task again.",
    });
    expect(fetchMock.mock.calls.filter(([path]) => path === "/api/planning/tasks/task-1")).toHaveLength(1);
  });
});

function usePlanningHarness(selectedProjectId: string) {
  const [projects, setProjects] = useState<PlanningProject[]>([]);
  const [scheduleState, setSchedule] = useState<PlanningSchedule | null>(null);
  const [selected, setSelectedProjectId] = useState(selectedProjectId);
  const [, setSelectedTaskId] = useState("");
  const actions = usePlanningWorkspaceMutations({
    token: "token",
    operational: true,
    schedule: scheduleState,
    selectedProjectId: selected,
    setProjects,
    setSchedule,
    setSelectedProjectId,
    setSelectedTaskId,
  });
  return { actions, projects, schedule: scheduleState, selectedProjectId: selected };
}

function project(id: string, name: string): PlanningProject {
  return {
    id, name, status: "active", start: "2026-08-01", end: "2026-08-30",
    target_finish: "2026-08-30", calculated_finish: "2026-08-30", revision: 1,
  };
}

function schedule(row: PlanningProject): PlanningSchedule {
  return {
    project: row,
    tasks: [], dependencies: [], resources: [], assignments: [], links: [], baselines: [],
    validation: { ok: true, violations: [] },
  };
}

function scheduleWithTask(row: PlanningProject, title: string): PlanningSchedule {
  return {
    ...schedule(row),
    tasks: [{
      id: "task-1", project_id: row.id, version: row.revision, parent_task_id: null, wbs: "1", title,
      task_type: "task", status: "planned", start: "2026-08-01", end: "2026-08-02", duration_days: 2,
      progress: 0, sort_order: 1, critical: false,
    }],
  };
}

function jsonResponse(value: unknown, status = 200, etag?: PlanningStrongEtag) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (etag) headers.set("ETag", etag);
  return new Response(JSON.stringify(value), { status, headers });
}

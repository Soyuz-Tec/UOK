import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PlanningStrongEtag } from "../../web/src/planningApi";
import type { PlanningProject, PlanningSchedule } from "../../web/src/types";
import { usePlanningWorkspaceMutations } from "../../web/src/usePlanningWorkspaceMutations";

const etag1 = `"planning-r1-sha256-${"a".repeat(64)}"` as PlanningStrongEtag;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("usePlanningWorkspaceMutations project creation", () => {
  it("creates, selects, and loads a real Planning project", async () => {
    const createdProject: PlanningProject = {
      ...schedule().project,
      id: "project-2",
      name: "Delivery launch",
      start: "2026-09-01",
      end: "2026-09-30",
      target_finish: "2026-09-30",
      calculated_finish: "2026-09-01",
      timezone: "Asia/Kolkata",
    };
    const createdSchedule: PlanningSchedule = { ...schedule(), project: createdProject, tasks: [] };
    let projectReads = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const path = String(input);
      if (path === "/api/planning/projects" && init.method === "POST") return jsonResponse(createdProject, 200, etag1);
      if (path === "/api/planning/projects") {
        projectReads += 1;
        return jsonResponse(projectReads === 1 ? [schedule().project] : [schedule().project, createdProject]);
      }
      if (path === "/api/planning/projects/project-1/schedule") return jsonResponse(schedule(), 200, etag1);
      if (path === "/api/planning/projects/project-2/schedule") return jsonResponse(createdSchedule, 200, etag1);
      throw new Error(`Unexpected Planning test request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(usePlanningHarness);
    await waitFor(() => expect(result.current.actions.scheduleEtag).toBe(etag1));
    await act(async () => {
      await result.current.actions.createProject({ name: "Delivery launch", start: "2026-09-01", end: "2026-09-30", timezone: "Asia/Kolkata" });
    });

    expect(result.current.selectedProjectId).toBe("project-2");
    expect(result.current.projects).toHaveLength(2);
    expect(result.current.schedule?.project).toMatchObject({ id: "project-2", name: "Delivery launch" });
    expect(result.current.actions.status).toMatchObject({ status: "created", project_id: "project-2", project_name: "Delivery launch" });
    const createRequest = fetchMock.mock.calls.find(([path, request]) => path === "/api/planning/projects" && request?.method === "POST")?.[1] as RequestInit;
    expect(JSON.parse(String(createRequest.body))).toEqual({ name: "Delivery launch", start: "2026-09-01", end: "2026-09-30", timezone: "Asia/Kolkata" });
  });

  it("preserves the current project when project creation is rejected", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const path = String(input);
      if (path === "/api/planning/projects" && init.method === "POST") return jsonResponse({
        error: {
          code: "planning_validation_failed",
          message: "project end must be on or after start",
          field: "end",
          object_ids: [],
          repair: "Choose a target finish on or after the start date.",
          current_revision: null,
          correlation_id: "project-create-error",
        },
      }, 400);
      if (path === "/api/planning/projects") return jsonResponse([schedule().project]);
      if (path.endsWith("/schedule")) return jsonResponse(schedule(), 200, etag1);
      throw new Error(`Unexpected Planning test request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(usePlanningHarness);
    await waitFor(() => expect(result.current.actions.scheduleEtag).toBe(etag1));
    await act(async () => {
      await expect(result.current.actions.createProject({ name: "Rejected", start: "2026-09-30", end: "2026-09-01", timezone: "UTC" })).rejects.toThrow("project end must be on or after start");
    });

    expect(result.current.selectedProjectId).toBe("project-1");
    expect(result.current.schedule?.project.id).toBe("project-1");
    expect(result.current.actions.status).toMatchObject({ status: "ready", projects: 1 });
  });

  it("commits a successful creation once even when post-create hydration fails", async () => {
    const createdProject: PlanningProject = { ...schedule().project, id: "project-2", name: "Committed project" };
    let created = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const path = String(input);
      if (path === "/api/planning/projects" && init.method === "POST") {
        created = true;
        return jsonResponse(createdProject, 200, etag1);
      }
      if (path === "/api/planning/projects") return created ? jsonResponse({ message: "list unavailable" }, 503) : jsonResponse([schedule().project]);
      if (path === "/api/planning/projects/project-1/schedule") return jsonResponse(schedule(), 200, etag1);
      if (path === "/api/planning/projects/project-2/schedule") return jsonResponse({ message: "schedule unavailable" }, 503);
      throw new Error(`Unexpected Planning test request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(usePlanningHarness);
    await waitFor(() => expect(result.current.actions.scheduleEtag).toBe(etag1));
    await act(async () => {
      await expect(result.current.actions.createProject({ name: "Committed project", start: "2026-09-01", end: "2026-09-30", timezone: "UTC" })).resolves.toMatchObject({ id: "project-2" });
    });

    expect(result.current.selectedProjectId).toBe("project-2");
    expect(result.current.projects).toEqual(expect.arrayContaining([expect.objectContaining({ id: "project-2" })]));
    expect(result.current.schedule).toBeNull();
    expect(result.current.actions.status).toMatchObject({ status: "created_reload_failed", project_id: "project-2" });
    expect(fetchMock.mock.calls.filter(([path, request]) => path === "/api/planning/projects" && request?.method === "POST")).toHaveLength(1);
  });

  it("rejects a create while another Planning operation owns the workspace", async () => {
    let holdProjectList = false;
    let releaseProjectList!: (response: Response) => void;
    const heldProjectList = new Promise<Response>((resolve) => { releaseProjectList = resolve; });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const path = String(input);
      if (path === "/api/planning/projects" && init.method === "POST") return jsonResponse({ ...schedule().project, id: "unexpected" }, 200, etag1);
      if (path === "/api/planning/projects") return holdProjectList ? heldProjectList : jsonResponse([schedule().project]);
      if (path.endsWith("/schedule")) return jsonResponse(schedule(), 200, etag1);
      throw new Error(`Unexpected Planning test request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(usePlanningHarness);
    await waitFor(() => expect(result.current.actions.scheduleEtag).toBe(etag1));
    holdProjectList = true;
    let refreshPromise!: Promise<void>;
    act(() => { refreshPromise = result.current.actions.refresh(); });
    await waitFor(() => expect(result.current.actions.busy).toBe("refresh"));
    await act(async () => {
      await expect(result.current.actions.createProject({ name: "Blocked", start: "2026-09-01", end: "2026-09-30", timezone: "UTC" })).rejects.toThrow("Planning is busy");
    });
    expect(fetchMock.mock.calls.filter(([path, request]) => path === "/api/planning/projects" && request?.method === "POST")).toHaveLength(0);

    releaseProjectList(jsonResponse([schedule().project]));
    await act(async () => { await refreshPromise; });
    expect(result.current.actions.busy).toBe("");
  });

  it("invalidates an old-token refresh before it can replace the new workspace", async () => {
    const projectA = schedule().project;
    const projectB: PlanningProject = { ...projectA, id: "project-b", name: "Tenant B project" };
    const scheduleB: PlanningSchedule = { ...schedule(), project: projectB, tasks: [] };
    let holdTokenA = false;
    let releaseTokenA!: (response: Response) => void;
    const heldTokenA = new Promise<Response>((resolve) => { releaseTokenA = resolve; });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const path = String(input);
      const token = new Headers(init.headers).get("Authorization");
      if (path === "/api/planning/projects" && token === "Bearer token-a") return holdTokenA ? heldTokenA : jsonResponse([projectA]);
      if (path === "/api/planning/projects" && token === "Bearer token-b") return jsonResponse([projectB]);
      if (path === "/api/planning/projects/project-1/schedule") return jsonResponse(schedule(), 200, etag1);
      if (path === "/api/planning/projects/project-b/schedule") return jsonResponse(scheduleB, 200, etag1);
      throw new Error(`Unexpected Planning test request: ${path} (${token})`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(({ token }) => usePlanningHarness({ token }), { initialProps: { token: "token-a" } });
    await waitFor(() => expect(result.current.schedule?.project.id).toBe("project-1"));
    holdTokenA = true;
    let oldRefresh!: Promise<void>;
    act(() => { oldRefresh = result.current.actions.refresh(); });
    await waitFor(() => expect(result.current.actions.busy).toBe("refresh"));

    rerender({ token: "token-b" });
    await waitFor(() => expect(result.current.schedule?.project.id).toBe("project-b"));
    expect(result.current.selectedProjectId).toBe("project-b");

    releaseTokenA(jsonResponse([projectA]));
    await act(async () => { await oldRefresh; });
    expect(result.current.schedule?.project.id).toBe("project-b");
    expect(result.current.selectedProjectId).toBe("project-b");
  });
});

function usePlanningHarness({ token = "token" }: { token?: string } = {}) {
  const [projects, setProjects] = useState<PlanningProject[]>([]);
  const [scheduleState, setSchedule] = useState<PlanningSchedule | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState("project-1");
  const [, setSelectedTaskId] = useState("");
  const actions = usePlanningWorkspaceMutations({
    token,
    operational: true,
    schedule: scheduleState,
    selectedProjectId,
    setProjects,
    setSchedule,
    setSelectedProjectId,
    setSelectedTaskId,
  });
  return { actions, projects, schedule: scheduleState, selectedProjectId };
}

function schedule(): PlanningSchedule {
  return {
    project: { id: "project-1", name: "Project", status: "active", start: "2026-08-01", end: "2026-08-30", target_finish: "2026-08-30", calculated_finish: "2026-08-30", revision: 1 },
    tasks: [{
      id: "task-1", project_id: "project-1", version: 1, parent_task_id: null, wbs: "1", title: "Original task",
      task_type: "task", status: "planned", start: "2026-08-01", end: "2026-08-02", duration_days: 2,
      progress: 0, sort_order: 1, critical: false,
    }],
    dependencies: [], resources: [], assignments: [], links: [], baselines: [], validation: { ok: true, violations: [] },
  };
}

function jsonResponse(value: unknown, status = 200, etag?: PlanningStrongEtag) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (etag) headers.set("ETag", etag);
  return new Response(JSON.stringify(value), { status, headers });
}

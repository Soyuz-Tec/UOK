import type { PlanningProject, PlanningSchedule } from "./types";

type CommandResult<T> = { result: T; status: string };

export type PlanningMutationOptions = {
  idempotencyKey?: string;
};

export function planningMutationKey(prefix: string) {
  return `${prefix}:${crypto.randomUUID()}`;
}

function headers(token: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export async function planningJson<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...options, headers: { ...headers(token), ...(options.headers || {}) } });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => {
    if (response.ok) throw new TypeError("Planning response body was not valid JSON.");
    return {};
  });
  if (!response.ok) throw data;
  return data as T;
}

async function planningMutationRequest<T>(token: string, path: string, options: RequestInit): Promise<T> {
  const request = () => planningJson<T>(token, path, options);
  try {
    return await request();
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return request();
  }
}

export function listPlanningProjects(token: string) {
  return planningJson<PlanningProject[]>(token, "/api/planning/projects");
}

export function loadPlanningSchedule(token: string, projectId: string) {
  return planningJson<PlanningSchedule>(token, `/api/planning/projects/${projectId}/schedule`);
}

export async function planningCommand<T>(token: string, command_type: string, payload: Record<string, unknown>, prefix: string, mutation: PlanningMutationOptions = {}) {
  const idempotencyKey = mutation.idempotencyKey || planningMutationKey(prefix);
  const body = JSON.stringify({ command_type, payload, idempotency_key: idempotencyKey });
  return planningMutationRequest<CommandResult<T>>(token, "/api/commands", { method: "POST", body });
}

function planningMutationJson<T>(token: string, path: string, options: RequestInit, prefix: string, mutation: PlanningMutationOptions = {}) {
  const idempotencyKey = mutation.idempotencyKey || planningMutationKey(prefix);
  return planningMutationRequest<T>(token, path, {
    ...options,
    headers: { ...options.headers, "Idempotency-Key": idempotencyKey },
  });
}

export function updatePlanningTask(token: string, taskId: string, payload: Record<string, unknown>, mutation: PlanningMutationOptions = {}) {
  return planningMutationJson<unknown>(token, `/api/planning/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(payload) }, "planning-task-update", mutation);
}

export function createPlanningTask(token: string, projectId: string, payload: Record<string, unknown>, mutation: PlanningMutationOptions = {}) {
  return planningMutationJson<unknown>(token, `/api/planning/projects/${projectId}/tasks`, { method: "POST", body: JSON.stringify(payload) }, "planning-task-create", mutation);
}

export function deletePlanningTask(token: string, taskId: string, mutation: PlanningMutationOptions = {}) {
  return planningMutationJson<unknown>(token, `/api/planning/tasks/${taskId}`, { method: "DELETE" }, "planning-task-delete", mutation);
}

export function createPlanningDependency(token: string, projectId: string, payload: Record<string, unknown>, mutation: PlanningMutationOptions = {}) {
  return planningMutationJson<unknown>(token, `/api/planning/projects/${projectId}/dependencies`, { method: "POST", body: JSON.stringify(payload) }, "planning-dependency-create", mutation);
}

export function updatePlanningDependency(token: string, dependencyId: string, payload: Record<string, unknown>, mutation: PlanningMutationOptions = {}) {
  return planningMutationJson<unknown>(token, `/api/planning/dependencies/${dependencyId}`, { method: "PATCH", body: JSON.stringify(payload) }, "planning-dependency-update", mutation);
}

export function removePlanningDependency(token: string, dependencyId: string, mutation: PlanningMutationOptions = {}) {
  return planningMutationJson<unknown>(token, `/api/planning/dependencies/${dependencyId}`, { method: "DELETE" }, "planning-dependency-remove", mutation);
}

export function setPlanningCalendar(token: string, projectId: string, payload: Record<string, unknown>, mutation: PlanningMutationOptions = {}) {
  return planningMutationJson<unknown>(token, `/api/planning/projects/${projectId}/calendar`, { method: "PUT", body: JSON.stringify(payload) }, "planning-calendar-set", mutation);
}

export function createPlanningBaseline(token: string, projectId: string, payload: Record<string, unknown>, mutation: PlanningMutationOptions = {}) {
  return planningMutationJson<unknown>(token, `/api/planning/projects/${projectId}/baselines`, { method: "POST", body: JSON.stringify(payload) }, "planning-baseline-create", mutation);
}

export function createPlanningResource(token: string, projectId: string, payload: Record<string, unknown>, mutation: PlanningMutationOptions = {}) {
  return planningMutationJson<unknown>(token, `/api/planning/projects/${projectId}/resources`, { method: "POST", body: JSON.stringify(payload) }, "planning-resource-create", mutation);
}

export function assignPlanningResource(token: string, payload: Record<string, unknown>, mutation: PlanningMutationOptions = {}) {
  return planningMutationJson<unknown>(token, "/api/planning/assignments", { method: "POST", body: JSON.stringify(payload) }, "planning-assignment-create", mutation);
}

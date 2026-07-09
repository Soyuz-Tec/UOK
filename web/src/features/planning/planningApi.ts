import type { PlanningProject, PlanningSchedule } from "./types";

type CommandResult<T> = { result: T; status: string };

function headers(token: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export async function planningJson<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...options, headers: { ...headers(token), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw data;
  return data as T;
}

export function listPlanningProjects(token: string) {
  return planningJson<PlanningProject[]>(token, "/api/planning/projects");
}

export function loadPlanningSchedule(token: string, projectId: string) {
  return planningJson<PlanningSchedule>(token, `/api/planning/projects/${projectId}/schedule`);
}

export async function planningCommand<T>(token: string, command_type: string, payload: Record<string, unknown>, prefix: string) {
  const body = JSON.stringify({ command_type, payload, idempotency_key: `${prefix}:${Date.now()}` });
  return planningJson<CommandResult<T>>(token, "/api/commands", { method: "POST", body });
}

export function updatePlanningTask(token: string, taskId: string, payload: Record<string, unknown>) {
  return planningJson<unknown>(token, `/api/planning/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function createPlanningTask(token: string, projectId: string, payload: Record<string, unknown>) {
  return planningJson<unknown>(token, `/api/planning/projects/${projectId}/tasks`, { method: "POST", body: JSON.stringify(payload) });
}

export function deletePlanningTask(token: string, taskId: string) {
  return planningJson<unknown>(token, `/api/planning/tasks/${taskId}`, { method: "DELETE" });
}

export function createPlanningDependency(token: string, projectId: string, payload: Record<string, unknown>) {
  return planningJson<unknown>(token, `/api/planning/projects/${projectId}/dependencies`, { method: "POST", body: JSON.stringify(payload) });
}

export function updatePlanningDependency(token: string, dependencyId: string, payload: Record<string, unknown>) {
  return planningJson<unknown>(token, `/api/planning/dependencies/${dependencyId}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function removePlanningDependency(token: string, dependencyId: string) {
  return planningJson<unknown>(token, `/api/planning/dependencies/${dependencyId}`, { method: "DELETE" });
}

export function setPlanningCalendar(token: string, projectId: string, payload: Record<string, unknown>) {
  return planningJson<unknown>(token, `/api/planning/projects/${projectId}/calendar`, { method: "PUT", body: JSON.stringify(payload) });
}

export function createPlanningBaseline(token: string, projectId: string, payload: Record<string, unknown>) {
  return planningJson<unknown>(token, `/api/planning/projects/${projectId}/baselines`, { method: "POST", body: JSON.stringify(payload) });
}

export function createPlanningResource(token: string, projectId: string, payload: Record<string, unknown>) {
  return planningJson<unknown>(token, `/api/planning/projects/${projectId}/resources`, { method: "POST", body: JSON.stringify(payload) });
}

export function assignPlanningResource(token: string, payload: Record<string, unknown>) {
  return planningJson<unknown>(token, "/api/planning/assignments", { method: "POST", body: JSON.stringify(payload) });
}

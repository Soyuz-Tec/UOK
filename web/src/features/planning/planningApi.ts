import type { PlanningProject, PlanningSchedule } from "./types";

type CommandResult<T> = { result: T; status: string };

declare const planningEtagBrand: unique symbol;

export type PlanningStrongEtag = string & { readonly [planningEtagBrand]: true };

export type PlanningMutationOptions = {
  idempotencyKey?: string;
  ifMatch: PlanningStrongEtag;
};

export type PlanningCreateOptions = {
  idempotencyKey?: string;
};

export type PlanningMutationResponse<T> = {
  data: T;
  etag: PlanningStrongEtag;
};

export type PlanningScheduleSnapshot = {
  schedule: PlanningSchedule;
  etag: PlanningStrongEtag;
};

export type PlanningBatchTaskUpdate = {
  taskId: string;
  payload: Record<string, unknown>;
};

export type PlanningBatchResult = {
  correlation_id: string;
  previous_revision: number;
  revision: number;
  operation_results: Array<{ operation_id: string; status: "applied"; object_ids: string[] }>;
  schedule: PlanningSchedule;
};

export type PlanningPreconditionDetail = {
  code: string;
  message: string;
  repair: string;
  current_revision: number;
  current_etag: PlanningStrongEtag;
  object_ids: string[];
  reload_url: string;
};

export class PlanningApiError extends Error {
  constructor(
    readonly status: number,
    readonly payload: unknown,
    readonly responseEtag: PlanningStrongEtag | null,
  ) {
    super(errorMessage(payload, `Planning request failed with HTTP ${status}.`));
    this.name = "PlanningApiError";
  }
}

export class PlanningPreconditionError extends PlanningApiError {
  constructor(
    status: 412 | 428,
    readonly detail: PlanningPreconditionDetail,
    payload: unknown,
    responseEtag: PlanningStrongEtag | null,
  ) {
    super(status, payload, responseEtag);
    this.name = "PlanningPreconditionError";
  }
}

export function isPlanningPreconditionError(error: unknown): error is PlanningPreconditionError {
  return error instanceof PlanningPreconditionError;
}

export function planningMutationKey(prefix: string) {
  return `${prefix}:${crypto.randomUUID()}`;
}

export async function planningJson<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  return (await planningResponse<T>(token, path, options)).data;
}

export function listPlanningProjects(token: string) {
  return planningJson<PlanningProject[]>(token, "/api/planning/projects");
}

export async function loadPlanningSchedule(token: string, projectId: string): Promise<PlanningScheduleSnapshot> {
  const response = await planningResponse<PlanningSchedule>(token, `/api/planning/projects/${projectId}/schedule`);
  return { schedule: response.data, etag: requireStrongEtag(response.etag) };
}

export function createPlanningProject(token: string, payload: Record<string, unknown>, mutation: PlanningCreateOptions = {}) {
  return planningCreateJson<PlanningProject>(token, "/api/planning/projects", { method: "POST", body: JSON.stringify(payload) }, "planning-project", mutation);
}

export async function planningCommand<T>(token: string, command_type: string, payload: Record<string, unknown>, prefix: string, mutation: PlanningMutationOptions) {
  const idempotencyKey = mutation.idempotencyKey || planningMutationKey(prefix);
  const body = JSON.stringify({ command_type, payload, idempotency_key: idempotencyKey });
  return planningMutationRequest<CommandResult<T>>(token, "/api/commands", {
    method: "POST",
    body,
    headers: { "If-Match": mutation.ifMatch },
  });
}

export function updatePlanningTask(token: string, taskId: string, payload: Record<string, unknown>, mutation: PlanningMutationOptions) {
  return planningMutationJson<unknown>(token, `/api/planning/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(payload) }, "planning-task-update", mutation);
}

export function createPlanningTask(token: string, projectId: string, payload: Record<string, unknown>, mutation: PlanningMutationOptions) {
  return planningMutationJson<unknown>(token, `/api/planning/projects/${projectId}/tasks`, { method: "POST", body: JSON.stringify(payload) }, "planning-task-create", mutation);
}

export function deletePlanningTask(token: string, taskId: string, mutation: PlanningMutationOptions) {
  return planningMutationJson<unknown>(token, `/api/planning/tasks/${taskId}`, { method: "DELETE" }, "planning-task-delete", mutation);
}

export function createPlanningDependency(token: string, projectId: string, payload: Record<string, unknown>, mutation: PlanningMutationOptions) {
  return planningMutationJson<unknown>(token, `/api/planning/projects/${projectId}/dependencies`, { method: "POST", body: JSON.stringify(payload) }, "planning-dependency-create", mutation);
}

export function updatePlanningDependency(token: string, dependencyId: string, payload: Record<string, unknown>, mutation: PlanningMutationOptions) {
  return planningMutationJson<unknown>(token, `/api/planning/dependencies/${dependencyId}`, { method: "PATCH", body: JSON.stringify(payload) }, "planning-dependency-update", mutation);
}

export function removePlanningDependency(token: string, dependencyId: string, mutation: PlanningMutationOptions) {
  return planningMutationJson<unknown>(token, `/api/planning/dependencies/${dependencyId}`, { method: "DELETE" }, "planning-dependency-remove", mutation);
}

export function setPlanningCalendar(token: string, projectId: string, payload: Record<string, unknown>, mutation: PlanningMutationOptions) {
  return planningMutationJson<unknown>(token, `/api/planning/projects/${projectId}/calendar`, { method: "PUT", body: JSON.stringify(payload) }, "planning-calendar-set", mutation);
}

export function createPlanningBaseline(token: string, projectId: string, payload: Record<string, unknown>, mutation: PlanningMutationOptions) {
  return planningMutationJson<unknown>(token, `/api/planning/projects/${projectId}/baselines`, { method: "POST", body: JSON.stringify(payload) }, "planning-baseline-create", mutation);
}

export function createPlanningResource(token: string, projectId: string, payload: Record<string, unknown>, mutation: PlanningMutationOptions) {
  return planningMutationJson<unknown>(token, `/api/planning/projects/${projectId}/resources`, { method: "POST", body: JSON.stringify(payload) }, "planning-resource-create", mutation);
}

export function assignPlanningResource(token: string, payload: Record<string, unknown>, mutation: PlanningMutationOptions) {
  return planningMutationJson<unknown>(token, "/api/planning/assignments", { method: "POST", body: JSON.stringify(payload) }, "planning-assignment-create", mutation);
}

export function batchPlanningTaskUpdates(
  token: string,
  projectId: string,
  updates: PlanningBatchTaskUpdate[],
  mutation: PlanningMutationOptions,
) {
  const idempotencyKey = mutation.idempotencyKey || planningMutationKey("planning-task-batch");
  const operations = updates.map((update, index) => ({
    operation_id: `${index + 1}:${idempotencyKey.slice(-70)}`,
    kind: "update_task",
    payload: { task_id: update.taskId, ...update.payload },
  }));
  return planningMutationJson<PlanningBatchResult>(
    token,
    `/api/planning/projects/${projectId}/mutations:batch`,
    { method: "POST", body: JSON.stringify({ operations }) },
    "planning-task-batch",
    { ...mutation, idempotencyKey },
  );
}

async function planningResponse<T>(token: string, path: string, options: RequestInit = {}) {
  const response = await fetch(path, { ...options, headers: requestHeaders(token, options.headers) });
  const responseEtag = optionalStrongEtag(response.headers.get("ETag"));
  if (response.status === 204) {
    if (!response.ok) throw planningError(response.status, {}, responseEtag);
    return { data: undefined as T, etag: responseEtag };
  }
  const data = await response.json().catch(() => {
    if (response.ok) throw new TypeError("Planning response body was not valid JSON.");
    return {};
  });
  if (!response.ok) throw planningError(response.status, data, responseEtag);
  return { data: data as T, etag: responseEtag };
}

async function planningMutationRequest<T>(token: string, path: string, options: RequestInit): Promise<PlanningMutationResponse<T>> {
  const request = async () => {
    const response = await planningResponse<T>(token, path, options);
    return { data: response.data, etag: requireStrongEtag(response.etag) };
  };
  try {
    return await request();
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return request();
  }
}

function planningCreateJson<T>(token: string, path: string, options: RequestInit, prefix: string, mutation: PlanningCreateOptions) {
  const idempotencyKey = mutation.idempotencyKey || planningMutationKey(prefix);
  return planningMutationRequest<T>(token, path, {
    ...options,
    headers: mergedHeaders(options.headers, { "Idempotency-Key": idempotencyKey }),
  });
}

function planningMutationJson<T>(token: string, path: string, options: RequestInit, prefix: string, mutation: PlanningMutationOptions) {
  const idempotencyKey = mutation.idempotencyKey || planningMutationKey(prefix);
  return planningMutationRequest<T>(token, path, {
    ...options,
    headers: mergedHeaders(options.headers, {
      "Idempotency-Key": idempotencyKey,
      "If-Match": mutation.ifMatch,
    }),
  });
}

function requestHeaders(token: string, extra: HeadersInit | undefined) {
  return mergedHeaders({ "Content-Type": "application/json", Authorization: `Bearer ${token}` }, extra);
}

function mergedHeaders(...sources: Array<HeadersInit | undefined>) {
  const result = new Headers();
  for (const source of sources) {
    if (!source) continue;
    new Headers(source).forEach((value, key) => result.set(key, value));
  }
  return result;
}

function planningError(status: number, payload: unknown, responseEtag: PlanningStrongEtag | null) {
  if (status === 412 || status === 428) {
    const detail = preconditionDetail(payload, responseEtag);
    if (detail) return new PlanningPreconditionError(status, detail, payload, responseEtag);
  }
  return new PlanningApiError(status, payload, responseEtag);
}

function preconditionDetail(payload: unknown, responseEtag: PlanningStrongEtag | null): PlanningPreconditionDetail | null {
  if (!payload || typeof payload !== "object" || !("error" in payload)) return null;
  const detail = payload.error;
  if (!detail || typeof detail !== "object") return null;
  const value = detail as Record<string, unknown>;
  const currentEtag = optionalStrongEtag(typeof value.current_etag === "string" ? value.current_etag : null) || responseEtag;
  if (!currentEtag || typeof value.code !== "string" || typeof value.message !== "string" || typeof value.repair !== "string"
    || typeof value.current_revision !== "number" || !Array.isArray(value.object_ids) || typeof value.reload_url !== "string") return null;
  return {
    code: value.code,
    message: value.message,
    repair: value.repair,
    current_revision: value.current_revision,
    current_etag: currentEtag,
    object_ids: value.object_ids.filter((item): item is string => typeof item === "string"),
    reload_url: value.reload_url,
  };
}

function optionalStrongEtag(value: string | null): PlanningStrongEtag | null {
  if (!value) return null;
  return /^"planning-r[1-9]\d*-sha256-[a-f0-9]{64}"$/.test(value) ? value as PlanningStrongEtag : null;
}

function requireStrongEtag(value: PlanningStrongEtag | null) {
  if (!value) throw new TypeError("Planning response did not include a valid quoted strong ETag.");
  return value;
}

function errorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const row = payload as Record<string, unknown>;
  if (typeof row.detail === "string") return row.detail;
  if (row.detail && typeof row.detail === "object" && typeof (row.detail as Record<string, unknown>).error === "string") {
    return String((row.detail as Record<string, unknown>).error);
  }
  if (row.error && typeof row.error === "object" && typeof (row.error as Record<string, unknown>).message === "string") {
    return String((row.error as Record<string, unknown>).message);
  }
  return fallback;
}

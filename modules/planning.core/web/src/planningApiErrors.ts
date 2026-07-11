import type { PlanningDomainErrorDetail } from "./planningContracts";
import type { PlanningPreconditionDetail, PlanningStrongEtag } from "./planningApi";

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

export class PlanningDomainError extends PlanningApiError {
  constructor(status: number, readonly detail: PlanningDomainErrorDetail, payload: unknown, responseEtag: PlanningStrongEtag | null) {
    super(status, payload, responseEtag);
    this.name = "PlanningDomainError";
  }
}

export function isPlanningPreconditionError(error: unknown): error is PlanningPreconditionError {
  return error instanceof PlanningPreconditionError;
}

export function isPlanningDomainError(error: unknown): error is PlanningDomainError {
  return error instanceof PlanningDomainError;
}

export function planningError(status: number, payload: unknown, responseEtag: PlanningStrongEtag | null) {
  const precondition = preconditionDetail(payload, responseEtag);
  if (precondition && (status === 412 || status === 428)) return new PlanningPreconditionError(status, precondition, payload, responseEtag);
  const domain = domainErrorDetail(payload);
  return domain ? new PlanningDomainError(status, domain, payload, responseEtag) : new PlanningApiError(status, payload, responseEtag);
}

function domainErrorDetail(payload: unknown): PlanningDomainErrorDetail | null {
  const value = errorObject(payload);
  if (!value || typeof value.code !== "string" || typeof value.message !== "string" || typeof value.repair !== "string" || !Array.isArray(value.object_ids)) return null;
  return {
    code: value.code,
    message: value.message,
    field: typeof value.field === "string" ? value.field : null,
    object_ids: value.object_ids.filter((item): item is string => typeof item === "string"),
    repair: value.repair,
    current_revision: typeof value.current_revision === "number" ? value.current_revision : null,
    correlation_id: typeof value.correlation_id === "string" ? value.correlation_id : null,
  };
}

function preconditionDetail(payload: unknown, responseEtag: PlanningStrongEtag | null): PlanningPreconditionDetail | null {
  const value = errorObject(payload);
  if (!value) return null;
  const currentEtag = strongEtag(typeof value.current_etag === "string" ? value.current_etag : null) || responseEtag;
  if (!currentEtag || typeof value.code !== "string" || typeof value.message !== "string" || typeof value.repair !== "string"
    || typeof value.current_revision !== "number" || !Array.isArray(value.object_ids) || typeof value.reload_url !== "string") return null;
  return {
    code: value.code,
    message: value.message,
    field: typeof value.field === "string" ? value.field : null,
    repair: value.repair,
    current_revision: value.current_revision,
    current_etag: currentEtag,
    object_ids: value.object_ids.filter((item): item is string => typeof item === "string"),
    reload_url: value.reload_url,
    correlation_id: typeof value.correlation_id === "string" ? value.correlation_id : null,
  };
}

function errorObject(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object" || !("error" in payload)) return null;
  const detail = payload.error;
  return detail && typeof detail === "object" ? detail as Record<string, unknown> : null;
}

function strongEtag(value: string | null): PlanningStrongEtag | null {
  return value && /^"planning-r[1-9]\d*-sha256-[a-f0-9]{64}"$/.test(value) ? value as PlanningStrongEtag : null;
}

function errorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const row = payload as Record<string, unknown>;
  if (typeof row.detail === "string") return row.detail;
  if (row.detail && typeof row.detail === "object" && typeof (row.detail as Record<string, unknown>).error === "string") return String((row.detail as Record<string, unknown>).error);
  if (row.error && typeof row.error === "object" && typeof (row.error as Record<string, unknown>).message === "string") return String((row.error as Record<string, unknown>).message);
  return fallback;
}

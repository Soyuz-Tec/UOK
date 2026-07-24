import type { ShipmentReadinessResponse } from "./types";

export class IntelligenceRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "IntelligenceRequestError";
  }
}

export async function loadShipmentReadiness(
  token: string,
  asOf: string,
  signal?: AbortSignal,
): Promise<ShipmentReadinessResponse> {
  const expectedThrough = addUtcCalendarDays(asOf, 30);
  if (!expectedThrough) {
    throw new IntelligenceRequestError(
      "Shipment Readiness requires a valid As-of date.",
      400,
    );
  }
  const search = new URLSearchParams({ as_of: asOf });
  const response = await fetch(`/api/intelligence/shipment-readiness?${search}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    signal,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new IntelligenceRequestError(errorMessage(body, response.status), response.status);
  }
  if (!hasExpectedEvaluationMetadata(body, asOf, expectedThrough)) {
    throw new IntelligenceRequestError(
      "Shipment Readiness response did not match the requested UTC evaluation policy.",
      502,
    );
  }
  return body;
}

function errorMessage(body: unknown, status: number) {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.detail === "string") return record.detail;
    for (const candidate of [record.detail, record.error]) {
      if (candidate && typeof candidate === "object") {
        const detail = candidate as Record<string, unknown>;
        if (typeof detail.message === "string") return detail.message;
        if (typeof detail.error === "string") return detail.error;
      }
    }
  }
  return `Shipment Readiness request failed with HTTP ${status}.`;
}

function hasExpectedEvaluationMetadata(
  body: unknown,
  asOf: string,
  expectedThrough: string,
): body is ShipmentReadinessResponse {
  if (!body || typeof body !== "object") return false;
  const value = body as Record<string, unknown>;
  return value.as_of === asOf
    && value.evaluation_timezone === "UTC"
    && value.expiring_soon_horizon_days === 30
    && value.expiring_soon_through === expectedThrough
    && Array.isArray(value.items);
}

function addUtcCalendarDays(value: string, days: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

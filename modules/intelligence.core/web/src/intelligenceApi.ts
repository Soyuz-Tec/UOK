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
  signal?: AbortSignal,
): Promise<ShipmentReadinessResponse> {
  const response = await fetch("/api/intelligence/shipment-readiness", {
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
  return body as ShipmentReadinessResponse;
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

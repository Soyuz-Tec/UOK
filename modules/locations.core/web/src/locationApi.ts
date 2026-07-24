import type { LocationDefinition, LocationDraft, LocationNameHistory } from "./types";

type UnauthorizedHandler = () => void;
type LocationCommandResult = LocationDefinition & { correlation_id: string };

export function loadLocationDefinitions(token: string, onUnauthorized: UnauthorizedHandler) {
  return locationJson<LocationDefinition[]>(
    token,
    "/api/locations/definitions?include_archived=true",
    onUnauthorized,
  );
}

export function loadLocationNameHistory(
  token: string,
  locationDefinitionId: string,
  onUnauthorized: UnauthorizedHandler,
) {
  return locationJson<LocationNameHistory[]>(
    token,
    `/api/locations/definitions/${locationDefinitionId}/name-history`,
    onUnauthorized,
  );
}

export function createLocationDefinition(
  token: string,
  draft: LocationDraft,
  onUnauthorized: UnauthorizedHandler,
) {
  return locationCommand(token, "CreateLocationDefinition", {
    code: draft.code.trim(),
    canonical_name: draft.canonicalName.trim(),
    location_type: draft.locationType,
    country_code: draft.countryCode.trim().toUpperCase(),
  }, "location-create", onUnauthorized);
}

export function updateLocationDefinition(
  token: string,
  location: LocationDefinition,
  draft: LocationDraft,
  onUnauthorized: UnauthorizedHandler,
) {
  return locationCommand(token, "UpdateLocationDefinition", {
    location_definition_id: location.id,
    expected_version: location.version,
    canonical_name: draft.canonicalName.trim(),
    location_type: draft.locationType,
    country_code: draft.countryCode.trim().toUpperCase(),
    ...(draft.reason.trim() ? { reason: draft.reason.trim() } : {}),
  }, "location-update", onUnauthorized);
}

export function archiveLocationDefinition(
  token: string,
  location: LocationDefinition,
  onUnauthorized: UnauthorizedHandler,
) {
  return locationCommand(token, "ArchiveLocationDefinition", {
    location_definition_id: location.id,
    expected_version: location.version,
  }, "location-archive", onUnauthorized);
}

export function restoreLocationDefinition(
  token: string,
  location: LocationDefinition,
  onUnauthorized: UnauthorizedHandler,
) {
  return locationCommand(token, "RestoreLocationDefinition", {
    location_definition_id: location.id,
    expected_version: location.version,
  }, "location-restore", onUnauthorized);
}

async function locationCommand(
  token: string,
  commandType: string,
  payload: Record<string, unknown>,
  idempotencyPrefix: string,
  onUnauthorized: UnauthorizedHandler,
) {
  const response = await locationJson<{ result: LocationCommandResult }>(
    token,
    "/api/commands",
    onUnauthorized,
    {
      method: "POST",
      body: JSON.stringify({
        command_type: commandType,
        payload,
        idempotency_key: `${idempotencyPrefix}:${crypto.randomUUID()}`,
      }),
    },
  );
  return response.result;
}

async function locationJson<T>(
  token: string,
  path: string,
  onUnauthorized: UnauthorizedHandler,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) onUnauthorized();
    throw new Error(locationErrorMessage(body, response.status));
  }
  return body as T;
}

function locationErrorMessage(body: unknown, status: number) {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.detail === "string") return record.detail;
    if (record.detail && typeof record.detail === "object") {
      const detail = record.detail as Record<string, unknown>;
      if (typeof detail.message === "string") return detail.message;
      if (typeof detail.error === "string") return detail.error;
    }
    if (record.error && typeof record.error === "object") {
      const error = record.error as Record<string, unknown>;
      if (typeof error.message === "string") return error.message;
    }
  }
  return `Location Master request failed with HTTP ${status}.`;
}

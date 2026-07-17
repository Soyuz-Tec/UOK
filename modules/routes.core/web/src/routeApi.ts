import type { LocationReference, RouteDefinition, RouteDraft, RouteNameHistory } from "./types";

type UnauthorizedHandler = () => void;
type RouteCommandResult = RouteDefinition & { correlation_id: string };

export function loadRouteDefinitions(token: string, onUnauthorized: UnauthorizedHandler) {
  return routeJson<RouteDefinition[]>(token, "/api/routes/definitions?include_archived=true", onUnauthorized);
}

export function loadRouteDefinition(token: string, routeDefinitionId: string, onUnauthorized: UnauthorizedHandler) {
  return routeJson<RouteDefinition>(token, `/api/routes/definitions/${routeDefinitionId}`, onUnauthorized);
}

export function loadRouteNameHistory(token: string, routeDefinitionId: string, onUnauthorized: UnauthorizedHandler) {
  return routeJson<RouteNameHistory[]>(token, `/api/routes/definitions/${routeDefinitionId}/name-history`, onUnauthorized);
}

export function loadLocationOptions(token: string, onUnauthorized: UnauthorizedHandler) {
  return routeJson<LocationReference[]>(token, "/api/routes/location-options", onUnauthorized);
}

export function createRouteDefinition(token: string, draft: RouteDraft, onUnauthorized: UnauthorizedHandler) {
  return routeCommand(token, "CreateRouteDefinition", {
    code: draft.code.trim(),
    canonical_name: draft.canonicalName.trim(),
    mode_hint: draft.modeHint || null,
    ...pathPayload(draft),
  }, "route-create", onUnauthorized);
}

export function updateRouteDefinition(
  token: string,
  route: RouteDefinition,
  draft: RouteDraft,
  onUnauthorized: UnauthorizedHandler,
) {
  return routeCommand(token, "UpdateRouteDefinition", {
    route_definition_id: route.id,
    expected_version: route.version,
    canonical_name: draft.canonicalName.trim(),
    mode_hint: draft.modeHint || null,
    ...pathPayload(draft),
    ...(draft.reason.trim() ? { reason: draft.reason.trim() } : {}),
  }, "route-update", onUnauthorized);
}

export function archiveRouteDefinition(token: string, route: RouteDefinition, onUnauthorized: UnauthorizedHandler) {
  return routeCommand(token, "ArchiveRouteDefinition", {
    route_definition_id: route.id,
    expected_version: route.version,
  }, "route-archive", onUnauthorized);
}

export function restoreRouteDefinition(token: string, route: RouteDefinition, onUnauthorized: UnauthorizedHandler) {
  return routeCommand(token, "RestoreRouteDefinition", {
    route_definition_id: route.id,
    expected_version: route.version,
  }, "route-restore", onUnauthorized);
}

function pathPayload(draft: RouteDraft) {
  return {
    origin_location_id: draft.originLocationId,
    destination_location_id: draft.destinationLocationId,
    waypoint_location_ids: draft.waypointLocationIds,
  };
}

async function routeCommand(
  token: string,
  commandType: string,
  payload: Record<string, unknown>,
  idempotencyPrefix: string,
  onUnauthorized: UnauthorizedHandler,
) {
  const response = await routeJson<{ result: RouteCommandResult }>(token, "/api/commands", onUnauthorized, {
    method: "POST",
    body: JSON.stringify({
      command_type: commandType,
      payload,
      idempotency_key: `${idempotencyPrefix}:${crypto.randomUUID()}`,
    }),
  });
  return response.result;
}

async function routeJson<T>(
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
    throw new Error(routeErrorMessage(body, response.status));
  }
  return body as T;
}

function routeErrorMessage(body: unknown, status: number) {
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
  return `Route/Corridor Master request failed with HTTP ${status}.`;
}

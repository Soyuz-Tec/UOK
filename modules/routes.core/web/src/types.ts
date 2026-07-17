export type RouteStatus = "active" | "archived";
export type RouteMode = "sea" | "road" | "rail" | "air" | "multimodal";
export type LocationResolutionStatus = "ready" | "unavailable" | "denied" | "missing";

export type LocationReference = {
  location_definition_id: string;
  status: LocationResolutionStatus;
  code?: string | null;
  canonical_name?: string | null;
  location_type?: string | null;
  country_code?: string | null;
  status_summary: string;
};

export type RouteStop = {
  sequence: number;
  stop_role: "origin" | "waypoint" | "destination";
  location: LocationReference;
};

export type RouteDefinition = {
  id: string;
  code: string;
  canonical_name: string;
  mode_hint: RouteMode | null;
  status: RouteStatus;
  version: number;
  created_by_user_id: string;
  updated_by_user_id: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  stops: RouteStop[];
};

export type RouteNameHistory = {
  id: string;
  route_definition_id: string;
  previous_name: string;
  new_name: string;
  reason: string;
  changed_by_user_id: string;
  changed_at: string;
};

export type RouteDraft = {
  code: string;
  canonicalName: string;
  modeHint: RouteMode | "";
  originLocationId: string;
  destinationLocationId: string;
  waypointLocationIds: string[];
  reason: string;
};

export type RouteSort = "code" | "name";
export type RouteSortDirection = "asc" | "desc";

export const emptyRouteDraft: RouteDraft = {
  code: "",
  canonicalName: "",
  modeHint: "",
  originLocationId: "",
  destinationLocationId: "",
  waypointLocationIds: [],
  reason: "",
};

export function draftFromRoute(route: RouteDefinition): RouteDraft {
  const stops = [...route.stops].sort((left, right) => left.sequence - right.sequence);
  return {
    code: route.code,
    canonicalName: route.canonical_name,
    modeHint: route.mode_hint || "",
    originLocationId: stops.find((stop) => stop.stop_role === "origin")?.location.location_definition_id || "",
    destinationLocationId: stops.find((stop) => stop.stop_role === "destination")?.location.location_definition_id || "",
    waypointLocationIds: stops.filter((stop) => stop.stop_role === "waypoint").map((stop) => stop.location.location_definition_id),
    reason: "",
  };
}

export function orderedLocationIds(draft: RouteDraft) {
  return [draft.originLocationId, ...draft.waypointLocationIds, draft.destinationLocationId];
}

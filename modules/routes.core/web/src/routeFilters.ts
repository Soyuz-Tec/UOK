import type { RouteDefinition, RouteMode, RouteSort, RouteSortDirection, RouteStatus } from "./types";

export function filterAndSortRoutes(routes: RouteDefinition[], options: {
  query: string;
  status: "all" | RouteStatus;
  mode: "all" | RouteMode;
  sortBy: RouteSort;
  sortDirection: RouteSortDirection;
}) {
  const query = options.query.trim().toLocaleLowerCase();
  const direction = options.sortDirection === "asc" ? 1 : -1;
  return routes
    .filter((route) => options.status === "all" || route.status === options.status)
    .filter((route) => options.mode === "all" || route.mode_hint === options.mode)
    .filter((route) => !query || searchableValues(route).some((value) => value.toLocaleLowerCase().includes(query)))
    .sort((left, right) => direction * sortValue(left, options.sortBy)
      .localeCompare(sortValue(right, options.sortBy), undefined, { sensitivity: "base" }));
}

function searchableValues(route: RouteDefinition) {
  return [
    route.code,
    route.canonical_name,
    route.mode_hint || "",
    ...route.stops.flatMap((stop) => [
      stop.location.code || "",
      stop.location.canonical_name || "",
      stop.location.country_code || "",
    ]),
  ];
}

function sortValue(route: RouteDefinition, sortBy: RouteSort) {
  return sortBy === "name" ? route.canonical_name : route.code;
}

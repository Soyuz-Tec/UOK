import type {
  LocationDefinition,
  LocationSort,
  LocationSortDirection,
  LocationStatus,
} from "./types";

export function filterAndSortLocations(
  locations: LocationDefinition[],
  options: {
    query: string;
    status: "all" | LocationStatus;
    sortBy: LocationSort;
    sortDirection: LocationSortDirection;
  },
) {
  const query = options.query.trim().toLocaleLowerCase();
  const direction = options.sortDirection === "asc" ? 1 : -1;
  return locations
    .filter((location) => options.status === "all" || location.status === options.status)
    .filter((location) => !query || [
      location.code,
      location.canonical_name,
      location.location_type,
      location.country_code,
    ].some((value) => value.toLocaleLowerCase().includes(query)))
    .sort((left, right) => direction * sortValue(left, options.sortBy)
      .localeCompare(sortValue(right, options.sortBy), undefined, { sensitivity: "base" }));
}

function sortValue(location: LocationDefinition, sortBy: LocationSort) {
  return sortBy === "name" ? location.canonical_name : location.code;
}

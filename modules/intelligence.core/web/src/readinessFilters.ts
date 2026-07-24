import type {
  ShipmentReadinessBandFilter,
  ShipmentReadinessSignal,
} from "./types";

export function filterShipmentReadiness(
  rows: ShipmentReadinessSignal[],
  query: string,
  band: ShipmentReadinessBandFilter,
) {
  const normalizedQuery = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (band !== "all" && row.band !== band) return false;
    return !normalizedQuery || row.code.toLowerCase().includes(normalizedQuery);
  });
}

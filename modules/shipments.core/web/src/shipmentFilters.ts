import { partyReferenceLabel } from "./partyReferenceDisplay";
import type { Shipment, ShipmentSort, ShipmentSortDirection, ShipmentStatus } from "./types";

export const shipmentStatusOptions = [
  { value: "all", label: "All shipments" },
  { value: "draft", label: "Draft" },
  { value: "planned", label: "Planned" },
  { value: "in_transit", label: "In transit" },
  { value: "arrived", label: "Arrived" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
];

export function filterAndSortShipments(shipments: Shipment[], options: {
  query: string;
  status: "all" | ShipmentStatus;
  sortBy: ShipmentSort;
  sortDirection: ShipmentSortDirection;
}) {
  const query = options.query.trim().toLocaleLowerCase();
  const direction = options.sortDirection === "asc" ? 1 : -1;
  return shipments
    .filter((shipment) => options.status === "all" || shipment.status === options.status)
    .filter((shipment) => !query || searchableValues(shipment).some((value) => value.toLocaleLowerCase().includes(query)))
    .sort((left, right) => direction * sortValue(left, options.sortBy)
      .localeCompare(sortValue(right, options.sortBy), undefined, { sensitivity: "base" }));
}

function searchableValues(shipment: Shipment) {
  return [
    shipment.code,
    partyReferenceLabel(shipment.shipper, shipment.shipper_party_id),
    partyReferenceLabel(shipment.consignee, shipment.consignee_party_id),
    shipment.origin.code || shipment.origin.canonical_name || shipment.origin_location_id,
    shipment.destination.code || shipment.destination.canonical_name || shipment.destination_location_id,
    shipment.route?.code || "",
    shipment.route?.canonical_name || "",
  ];
}

function sortValue(shipment: Shipment, sortBy: ShipmentSort) {
  return sortBy === "departure" ? shipment.planned_departure_on || "9999-12-31" : shipment.code;
}

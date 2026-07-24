export type ReferenceStatus = "ready" | "unavailable" | "denied" | "missing";
export type ShipmentStatus = "draft" | "planned" | "in_transit" | "arrived" | "closed" | "cancelled";

export type PartyReference = {
  status: ReferenceStatus;
  display_label?: string | null;
  status_summary: string;
  open_path?: string | null;
};

export type LocationReference = {
  location_definition_id: string;
  status: ReferenceStatus;
  code?: string | null;
  canonical_name?: string | null;
  location_type?: string | null;
  country_code?: string | null;
  status_summary: string;
};

export type RoutePathReference = {
  route_definition_id: string;
  status: ReferenceStatus;
  code?: string | null;
  canonical_name?: string | null;
  mode_hint?: string | null;
  ordered_location_ids: string[];
  status_summary: string;
};

export type Shipment = {
  id: string;
  code: string;
  shipper_party_id: string | null;
  consignee_party_id: string | null;
  origin_location_id: string;
  destination_location_id: string;
  route_definition_id: string | null;
  planned_departure_on: string | null;
  planned_arrival_on: string | null;
  status: ShipmentStatus;
  version: number;
  created_by_user_id: string;
  updated_by_user_id: string;
  created_at: string;
  updated_at: string;
  shipper: PartyReference;
  consignee: PartyReference;
  origin: LocationReference;
  destination: LocationReference;
  route: RoutePathReference | null;
};

export type ShipmentStatusHistory = {
  id: string;
  shipment_id: string;
  previous_status: ShipmentStatus;
  new_status: ShipmentStatus;
  reason: string;
  changed_by_user_id: string;
  changed_at: string;
  version: number;
};

export type ShipmentDraft = {
  code: string;
  shipperPartyId: string;
  consigneePartyId: string;
  originLocationId: string;
  destinationLocationId: string;
  routeDefinitionId: string;
  plannedDepartureOn: string;
  plannedArrivalOn: string;
};

export type ShipmentSort = "code" | "departure";
export type ShipmentSortDirection = "asc" | "desc";

export const emptyShipmentDraft: ShipmentDraft = {
  code: "",
  shipperPartyId: "",
  consigneePartyId: "",
  originLocationId: "",
  destinationLocationId: "",
  routeDefinitionId: "",
  plannedDepartureOn: "",
  plannedArrivalOn: "",
};

export function draftFromShipment(shipment: Shipment): ShipmentDraft {
  return {
    code: shipment.code,
    shipperPartyId: shipment.shipper_party_id || "",
    consigneePartyId: shipment.consignee_party_id || "",
    originLocationId: shipment.origin_location_id,
    destinationLocationId: shipment.destination_location_id,
    routeDefinitionId: shipment.route_definition_id || "",
    plannedDepartureOn: shipment.planned_departure_on || "",
    plannedArrivalOn: shipment.planned_arrival_on || "",
  };
}

export const shipmentTransitions: Record<ShipmentStatus, ShipmentStatus[]> = {
  draft: ["planned", "cancelled"],
  planned: ["in_transit", "cancelled"],
  in_transit: ["arrived"],
  arrived: ["closed"],
  closed: [],
  cancelled: [],
};

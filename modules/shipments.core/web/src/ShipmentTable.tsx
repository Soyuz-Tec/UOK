import type { KeyboardEvent } from "react";

import { EmptyState, StatusPill } from "@uok/shared/data-display";
import { ResizableDataTable, type DataTableColumn } from "@uok/shared/tables";
import type { Shipment } from "./types";

const columns: DataTableColumn<Shipment>[] = [
  { id: "code", header: "Shipment", defaultWidth: 165, minWidth: 125, renderCell: (shipment) => <strong>{shipment.code}</strong> },
  { id: "shipper", header: "Shipper", defaultWidth: 190, minWidth: 140, renderCell: (shipment) => partyLabel(shipment.shipper.display_label, shipment.shipper_party_id) },
  { id: "consignee", header: "Consignee", defaultWidth: 190, minWidth: 140, renderCell: (shipment) => partyLabel(shipment.consignee.display_label, shipment.consignee_party_id) },
  { id: "origin", header: "Origin", defaultWidth: 165, minWidth: 125, renderCell: (shipment) => locationLabel(shipment.origin, shipment.origin_location_id) },
  { id: "destination", header: "Destination", defaultWidth: 165, minWidth: 125, renderCell: (shipment) => locationLabel(shipment.destination, shipment.destination_location_id) },
  { id: "departure", header: "Planned departure", defaultWidth: 155, minWidth: 130, renderCell: (shipment) => formatDate(shipment.planned_departure_on) },
  { id: "status", header: "Status", defaultWidth: 135, minWidth: 110, renderCell: (shipment) => <StatusPill label={statusLabel(shipment.status)} tone={statusTone(shipment.status)} /> },
];

export function ShipmentTable({ shipments, selectedId, onSelect }: {
  shipments: Shipment[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ResizableDataTable
      ariaLabel="Shipment records"
      columns={columns}
      rows={shipments}
      getRowKey={(shipment) => shipment.id}
      storageKey="uok_shipment_support_table_widths"
      emptyState={<EmptyState title="No matching shipments" text="Adjust the search or create a Shipment." />}
      rowAriaLabel={(shipment) => `${shipment.code} ${statusLabel(shipment.status)}`}
      rowAriaSelected={(shipment) => shipment.id === selectedId}
      rowClassName={(shipment) => shipment.id === selectedId ? "selected" : ""}
      rowTabIndex={() => 0}
      onRowClick={(shipment) => onSelect(shipment.id)}
      onRowKeyDown={(event, shipment) => selectFromKeyboard(event, shipment.id, onSelect)}
    />
  );
}

function partyLabel(label: string | null | undefined, id: string) {
  return label || id;
}

function locationLabel(location: Shipment["origin"], fallbackId: string) {
  return location.code || location.canonical_name || fallbackId;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString();
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status: Shipment["status"]) {
  if (status === "closed" || status === "arrived") return "success";
  if (status === "cancelled") return "danger";
  if (status === "in_transit") return "info";
  return "warning";
}

function selectFromKeyboard(event: KeyboardEvent<HTMLTableRowElement>, id: string, onSelect: (id: string) => void) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  onSelect(id);
}

import type { KeyboardEvent } from "react";

import { EmptyState, StatusPill } from "@uok/shared/data-display";
import { ResizableDataTable, type DataTableColumn } from "@uok/shared/tables";
import type { LocationDefinition } from "./types";

const columns: DataTableColumn<LocationDefinition>[] = [
  { id: "code", header: "Code", defaultWidth: 150, minWidth: 110, renderCell: (location) => <strong>{location.code}</strong> },
  { id: "name", header: "Canonical name", defaultWidth: 260, minWidth: 180, renderCell: (location) => location.canonical_name },
  { id: "type", header: "Type", defaultWidth: 150, minWidth: 120, renderCell: (location) => location.location_type },
  { id: "country", header: "Country", defaultWidth: 120, minWidth: 100, renderCell: (location) => location.country_code },
  { id: "status", header: "Status", defaultWidth: 130, minWidth: 110, renderCell: (location) => <StatusPill label={location.status} tone={location.status === "active" ? "success" : "warning"} /> },
];

export function LocationTable({
  locations,
  selectedId,
  onSelect,
}: {
  locations: LocationDefinition[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ResizableDataTable
      ariaLabel="Location definitions"
      columns={columns}
      rows={locations}
      getRowKey={(location) => location.id}
      storageKey="uok_location_master_table_widths"
      emptyState={<EmptyState title="No matching locations" text="Adjust the search or create a location definition." />}
      rowAriaLabel={(location) => `${location.code} ${location.canonical_name}`}
      rowAriaSelected={(location) => location.id === selectedId}
      rowClassName={(location) => location.id === selectedId ? "selected" : ""}
      rowTabIndex={() => 0}
      onRowClick={(location) => onSelect(location.id)}
      onRowKeyDown={(event, location) => selectFromKeyboard(event, location.id, onSelect)}
    />
  );
}

function selectFromKeyboard(
  event: KeyboardEvent<HTMLTableRowElement>,
  id: string,
  onSelect: (id: string) => void,
) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  onSelect(id);
}

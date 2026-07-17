import type { KeyboardEvent } from "react";

import { EmptyState, StatusPill } from "@uok/shared/data-display";
import { ResizableDataTable, type DataTableColumn } from "@uok/shared/tables";
import type { RouteDefinition, RouteStop } from "./types";

const columns: DataTableColumn<RouteDefinition>[] = [
  { id: "code", header: "Code", defaultWidth: 145, minWidth: 110, renderCell: (route) => <strong>{route.code}</strong> },
  { id: "name", header: "Canonical name", defaultWidth: 230, minWidth: 170, renderCell: (route) => route.canonical_name },
  { id: "origin", header: "Origin", defaultWidth: 190, minWidth: 140, renderCell: (route) => stopLabel(stopByRole(route, "origin")) },
  { id: "destination", header: "Destination", defaultWidth: 190, minWidth: 140, renderCell: (route) => stopLabel(stopByRole(route, "destination")) },
  { id: "waypoints", header: "Waypoints", defaultWidth: 110, minWidth: 95, renderCell: (route) => route.stops.filter((stop) => stop.stop_role === "waypoint").length },
  { id: "mode", header: "Mode", defaultWidth: 125, minWidth: 100, renderCell: (route) => route.mode_hint || "—" },
  { id: "status", header: "Status", defaultWidth: 125, minWidth: 105, renderCell: (route) => <StatusPill label={route.status} tone={route.status === "active" ? "success" : "warning"} /> },
];

export function RouteTable({ routes, selectedId, onSelect }: {
  routes: RouteDefinition[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ResizableDataTable
      ariaLabel="Route definitions"
      columns={columns}
      rows={routes}
      getRowKey={(route) => route.id}
      storageKey="uok_route_master_table_widths"
      emptyState={<EmptyState title="No matching routes" text="Adjust the search or create a Route Definition." />}
      rowAriaLabel={(route) => `${route.code} ${route.canonical_name}`}
      rowAriaSelected={(route) => route.id === selectedId}
      rowClassName={(route) => route.id === selectedId ? "selected" : ""}
      rowTabIndex={() => 0}
      onRowClick={(route) => onSelect(route.id)}
      onRowKeyDown={(event, route) => selectFromKeyboard(event, route.id, onSelect)}
    />
  );
}

function stopByRole(route: RouteDefinition, role: RouteStop["stop_role"]) {
  return route.stops.find((stop) => stop.stop_role === role);
}

function stopLabel(stop: RouteStop | undefined) {
  if (!stop) return "—";
  return stop.location.code || stop.location.canonical_name || stop.location.location_definition_id;
}

function selectFromKeyboard(event: KeyboardEvent<HTMLTableRowElement>, id: string, onSelect: (id: string) => void) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  onSelect(id);
}

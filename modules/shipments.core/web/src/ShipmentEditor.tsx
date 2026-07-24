import { useEffect, useMemo, useState } from "react";

import { WorkspaceActionButton } from "@uok/shared/actions";
import { FieldMessage } from "@uok/shared/forms";
import type { LocationReference, RoutePathReference, Shipment, ShipmentDraft } from "./types";
import { draftFromShipment, emptyShipmentDraft } from "./types";

export function ShipmentEditor({
  mode,
  shipment,
  locationOptions,
  routeOptions,
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  mode: "create" | "edit";
  shipment: Shipment | null;
  locationOptions: LocationReference[];
  routeOptions: RoutePathReference[];
  busy: boolean;
  error: string;
  onCancel: () => void;
  onSubmit: (draft: ShipmentDraft) => void;
}) {
  const [draft, setDraft] = useState<ShipmentDraft>(() => initialDraft(mode, shipment));
  const locations = useMemo(() => mergeLocationOptions(locationOptions, shipment), [locationOptions, shipment]);
  const routes = useMemo(() => mergeRouteOptions(routeOptions, shipment), [routeOptions, shipment]);
  const validation = validateDraft(draft, locations, routes);

  useEffect(() => {
    setDraft(initialDraft(mode, shipment));
  }, [mode, shipment?.id, shipment?.version]);

  return (
    <form
      className="shipment-editor-form"
      aria-label={mode === "create" ? "Create shipment" : "Edit shipment"}
      onSubmit={(event) => {
        event.preventDefault();
        if (!validation && !busy) onSubmit(draft);
      }}
    >
      <div className="shipment-editor-grid">
        <label className="field">
          <span>Shipment code</span>
          <input
            autoFocus={mode === "create"}
            value={draft.code}
            maxLength={80}
            required
            disabled={busy || mode === "edit"}
            onChange={(event) => setDraft({ ...draft, code: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Shipper Party ID</span>
          <input
            autoFocus={mode === "edit"}
            value={draft.shipperPartyId}
            maxLength={36}
            required
            disabled={busy}
            autoComplete="off"
            placeholder="Stable Party ID"
            onChange={(event) => setDraft({ ...draft, shipperPartyId: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Consignee Party ID</span>
          <input
            value={draft.consigneePartyId}
            maxLength={36}
            required
            disabled={busy}
            autoComplete="off"
            placeholder="Stable Party ID"
            onChange={(event) => setDraft({ ...draft, consigneePartyId: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Governed route</span>
          <select
            value={draft.routeDefinitionId}
            disabled={busy}
            onChange={(event) => setDraft(applyRoute(draft, event.target.value, routes))}
          >
            <option value="">No governed route</option>
            {routes.map((route) => (
              <option key={route.route_definition_id} value={route.route_definition_id} disabled={route.status !== "ready"}>
                {routeLabel(route)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Origin location</span>
          <select
            value={draft.originLocationId}
            required
            disabled={busy}
            onChange={(event) => setDraft({ ...draft, originLocationId: event.target.value })}
          >
            <option value="">Select an origin</option>
            {locations.map((location) => (
              <option key={location.location_definition_id} value={location.location_definition_id} disabled={location.status !== "ready"}>
                {locationLabel(location)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Destination location</span>
          <select
            value={draft.destinationLocationId}
            required
            disabled={busy}
            onChange={(event) => setDraft({ ...draft, destinationLocationId: event.target.value })}
          >
            <option value="">Select a destination</option>
            {locations.map((location) => (
              <option key={location.location_definition_id} value={location.location_definition_id} disabled={location.status !== "ready"}>
                {locationLabel(location)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Planned departure</span>
          <input
            type="date"
            value={draft.plannedDepartureOn}
            disabled={busy}
            onChange={(event) => setDraft({ ...draft, plannedDepartureOn: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Planned arrival</span>
          <input
            type="date"
            value={draft.plannedArrivalOn}
            min={draft.plannedDepartureOn || undefined}
            disabled={busy}
            onChange={(event) => setDraft({ ...draft, plannedArrivalOn: event.target.value })}
          />
        </label>
      </div>
      <p className="shipment-editor-help">Party IDs are checked through Contacts when you save. Selecting a Route sets its governed first and last Locations.</p>
      {validation ? <FieldMessage id="shipment-editor-validation">{validation}</FieldMessage> : null}
      {error ? <FieldMessage id="shipment-editor-error">{error}</FieldMessage> : null}
      <div className="shipment-editor-actions">
        <WorkspaceActionButton action="cancel" disabled={busy} onClick={onCancel} />
        <WorkspaceActionButton
          action={mode === "create" ? "create" : "save"}
          labelKey={mode === "create" ? "command.createShipment" : "command.saveShipment"}
          fallbackLabel={mode === "create" ? "Create shipment" : "Save shipment"}
          type="submit"
          primary
          loading={busy}
          disabled={Boolean(validation)}
        />
      </div>
    </form>
  );
}

function initialDraft(mode: "create" | "edit", shipment: Shipment | null) {
  return mode === "edit" && shipment ? draftFromShipment(shipment) : { ...emptyShipmentDraft };
}

function applyRoute(draft: ShipmentDraft, routeId: string, routes: RoutePathReference[]) {
  const route = routes.find((row) => row.route_definition_id === routeId);
  if (!route || route.ordered_location_ids.length < 2) return { ...draft, routeDefinitionId: routeId };
  return {
    ...draft,
    routeDefinitionId: routeId,
    originLocationId: route.ordered_location_ids[0],
    destinationLocationId: route.ordered_location_ids[route.ordered_location_ids.length - 1],
  };
}

function validateDraft(draft: ShipmentDraft, locations: LocationReference[], routes: RoutePathReference[]) {
  if (!draft.code.trim() || !draft.shipperPartyId.trim() || !draft.consigneePartyId.trim()) {
    return "Shipment code, shipper Party ID, and consignee Party ID are required.";
  }
  if (!draft.originLocationId || !draft.destinationLocationId) return "Origin and destination are required.";
  if (draft.originLocationId === draft.destinationLocationId) return "Origin and destination must be different Locations.";
  const readyLocations = new Set(locations.filter((row) => row.status === "ready").map((row) => row.location_definition_id));
  if (!readyLocations.has(draft.originLocationId) || !readyLocations.has(draft.destinationLocationId)) {
    return "Origin and destination must be active, available Locations.";
  }
  if (draft.plannedDepartureOn && draft.plannedArrivalOn && draft.plannedArrivalOn < draft.plannedDepartureOn) {
    return "Planned arrival cannot be earlier than planned departure.";
  }
  if (draft.routeDefinitionId) {
    const route = routes.find((row) => row.route_definition_id === draft.routeDefinitionId);
    if (!route || route.status !== "ready") return "The governed Route must be active and available.";
    if (
      route.ordered_location_ids[0] !== draft.originLocationId
      || route.ordered_location_ids.at(-1) !== draft.destinationLocationId
    ) return "Shipment endpoints must match the selected Route endpoints.";
  }
  return "";
}

function mergeLocationOptions(options: LocationReference[], shipment: Shipment | null) {
  const merged = new Map(options.map((option) => [option.location_definition_id, option]));
  for (const option of shipment ? [shipment.origin, shipment.destination] : []) {
    if (!merged.has(option.location_definition_id)) merged.set(option.location_definition_id, option);
  }
  return [...merged.values()];
}

function mergeRouteOptions(options: RoutePathReference[], shipment: Shipment | null) {
  const merged = new Map(options.map((option) => [option.route_definition_id, option]));
  if (shipment?.route && !merged.has(shipment.route.route_definition_id)) {
    merged.set(shipment.route.route_definition_id, shipment.route);
  }
  return [...merged.values()];
}

function locationLabel(location: LocationReference) {
  return [location.code, location.canonical_name].filter(Boolean).join(" · ") || location.location_definition_id;
}

function routeLabel(route: RoutePathReference) {
  return [route.code, route.canonical_name].filter(Boolean).join(" · ") || route.route_definition_id;
}

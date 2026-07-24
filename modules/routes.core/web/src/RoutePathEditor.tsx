import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { CommandButton } from "@uok/shared/primitives";
import type { LocationReference, RouteDraft } from "./types";

export function RoutePathEditor({
  draft,
  options,
  busy,
  onChange,
}: {
  draft: RouteDraft;
  options: LocationReference[];
  busy: boolean;
  onChange: (draft: RouteDraft) => void;
}) {
  return (
    <fieldset className="route-path-editor" disabled={busy}>
      <legend>Ordered route path</legend>
      <p className="route-path-help">Choose two to ten unique active locations. Waypoints follow the order shown.</p>
      <LocationSelect
        label="Origin location"
        value={draft.originLocationId}
        options={options}
        onChange={(originLocationId) => onChange({ ...draft, originLocationId })}
      />
      <div className="route-waypoint-list" aria-label="Ordered waypoints">
        {draft.waypointLocationIds.map((locationId, index) => (
          <div className="route-waypoint-row" key={`waypoint-${index}`}>
            <LocationSelect
              label={`Waypoint ${index + 1}`}
              value={locationId}
              options={options}
              onChange={(value) => onChange({
                ...draft,
                waypointLocationIds: replaceAt(draft.waypointLocationIds, index, value),
              })}
            />
            <div className="route-waypoint-actions" aria-label={`Waypoint ${index + 1} actions`}>
              <CommandButton
                icon={ArrowUp}
                aria-label={`Move waypoint ${index + 1} up`}
                disabled={index === 0}
                onClick={() => onChange({ ...draft, waypointLocationIds: move(draft.waypointLocationIds, index, index - 1) })}
              >Move up</CommandButton>
              <CommandButton
                icon={ArrowDown}
                aria-label={`Move waypoint ${index + 1} down`}
                disabled={index === draft.waypointLocationIds.length - 1}
                onClick={() => onChange({ ...draft, waypointLocationIds: move(draft.waypointLocationIds, index, index + 1) })}
              >Move down</CommandButton>
              <CommandButton
                icon={Trash2}
                aria-label={`Remove waypoint ${index + 1}`}
                destructive
                onClick={() => onChange({
                  ...draft,
                  waypointLocationIds: draft.waypointLocationIds.filter((_, position) => position !== index),
                })}
              >Remove</CommandButton>
            </div>
          </div>
        ))}
      </div>
      <CommandButton
        icon={Plus}
        disabled={draft.waypointLocationIds.length >= 8}
        onClick={() => onChange({ ...draft, waypointLocationIds: [...draft.waypointLocationIds, ""] })}
      >Add waypoint</CommandButton>
      <LocationSelect
        label="Destination location"
        value={draft.destinationLocationId}
        options={options}
        onChange={(destinationLocationId) => onChange({ ...draft, destinationLocationId })}
      />
    </fieldset>
  );
}

function LocationSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: LocationReference[];
  onChange: (value: string) => void;
}) {
  const selected = options.find((option) => option.location_definition_id === value);
  return (
    <label className="field route-location-select">
      <span>{label}</span>
      <select required value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select an active location</option>
        {options.map((option) => (
          <option
            key={option.location_definition_id}
            value={option.location_definition_id}
            disabled={option.status !== "ready"}
          >
            {locationLabel(option)}
          </option>
        ))}
      </select>
      {selected?.status !== "ready" && selected ? <small role="status">{selected.status_summary}</small> : null}
    </label>
  );
}

function locationLabel(location: LocationReference) {
  if (location.status !== "ready") return `${location.location_definition_id} — ${location.status_summary}`;
  return [location.code, location.canonical_name, location.location_type, location.country_code].filter(Boolean).join(" · ");
}

function replaceAt(values: string[], index: number, value: string) {
  return values.map((current, position) => position === index ? value : current);
}

function move(values: string[], from: number, to: number) {
  if (to < 0 || to >= values.length) return values;
  const next = [...values];
  const [value] = next.splice(from, 1);
  next.splice(to, 0, value);
  return next;
}

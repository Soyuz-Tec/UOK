import { Archive, ArchiveRestore } from "lucide-react";

import { ConfirmCommandButton, WorkspaceActionButton } from "@uok/shared/actions";
import { DetailItem, EmptyState, StatusPill } from "@uok/shared/data-display";
import { CommandButton } from "@uok/shared/primitives";
import type { LocationReference, RouteDefinition, RouteNameHistory } from "./types";

export function RouteDetail({
  route,
  history,
  historyLoading,
  busyAction,
  canManage,
  onEdit,
  onArchive,
  onRestore,
}: {
  route: RouteDefinition | null;
  history: RouteNameHistory[];
  historyLoading: boolean;
  busyAction: string;
  canManage: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  if (!route) return <EmptyState title="No route selected" text="Select a Route Definition to review its governed path and name history." />;
  const archived = route.status === "archived";
  const lifecycleBusy = busyAction === "archive" || busyAction === "restore";
  const stops = [...route.stops].sort((left, right) => left.sequence - right.sequence);

  return (
    <article className="route-detail" aria-label={`${route.canonical_name} route details`}>
      <header className="route-detail-header">
        <div><p className="eyebrow">{route.code}</p><h2>{route.canonical_name}</h2></div>
        <StatusPill label={route.status} tone={archived ? "warning" : "success"} />
      </header>
      <div className="route-detail-grid">
        <DetailItem label="Mode hint" value={route.mode_hint ? modeLabel(route.mode_hint) : "Not set"} />
        <DetailItem label="Waypoints" value={String(stops.filter((stop) => stop.stop_role === "waypoint").length)} />
        <DetailItem label="Version" value={String(route.version)} />
        <DetailItem label="Last updated" value={formatTimestamp(route.updated_at)} />
      </div>
      <section className="route-path-detail" aria-label="Ordered route path">
        <h3>Ordered path</h3>
        <ol>
          {stops.map((stop) => (
            <li key={`${stop.sequence}-${stop.location.location_definition_id}`}>
              <span className="route-stop-sequence">{stop.sequence + 1}</span>
              <span className="route-stop-copy">
                <strong>{locationLabel(stop.location)}</strong>
                <small>{stop.stop_role} · {stop.location.status_summary}</small>
              </span>
              <StatusPill label={stop.location.status} tone={stop.location.status === "ready" ? "success" : "warning"} />
            </li>
          ))}
        </ol>
      </section>
      {canManage ? (
        <div className="route-detail-actions" aria-label="Route actions">
          <WorkspaceActionButton action="edit" disabled={archived || lifecycleBusy} onClick={onEdit}>Edit route</WorkspaceActionButton>
          {archived ? (
            <CommandButton icon={ArchiveRestore} loading={busyAction === "restore"} disabled={lifecycleBusy} onClick={onRestore}>Restore route</CommandButton>
          ) : (
            <ConfirmCommandButton
              icon={Archive}
              message={`Archive ${route.canonical_name}? The definition can be restored later.`}
              destructive
              loading={busyAction === "archive"}
              disabled={lifecycleBusy}
              onConfirm={onArchive}
            >Archive route</ConfirmCommandButton>
          )}
        </div>
      ) : null}
      <section className="route-name-history" aria-label="Canonical name history">
        <h3>Name history</h3>
        {historyLoading ? <p role="status">Loading name history.</p> : history.length ? (
          <ol>
            {history.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.previous_name} → {entry.new_name}</strong>
                <span>{entry.reason}</span>
                <small><time dateTime={entry.changed_at}>{formatTimestamp(entry.changed_at)}</time> · {entry.changed_by_user_id}</small>
              </li>
            ))}
          </ol>
        ) : <EmptyState text="No canonical name changes have been recorded." />}
      </section>
    </article>
  );
}

function locationLabel(location: LocationReference) {
  if (location.canonical_name || location.code) return [location.code, location.canonical_name].filter(Boolean).join(" · ");
  return location.location_definition_id;
}

function modeLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatTimestamp(value: string) {
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.valueOf()) ? value : timestamp.toLocaleString();
}

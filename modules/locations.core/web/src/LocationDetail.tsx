import { Archive, ArchiveRestore } from "lucide-react";

import { ConfirmCommandButton, WorkspaceActionButton } from "@uok/shared/actions";
import { DetailItem, EmptyState, StatusPill } from "@uok/shared/data-display";
import { CommandButton } from "@uok/shared/primitives";
import type { LocationDefinition, LocationNameHistory } from "./types";

export function LocationDetail({
  location,
  history,
  historyLoading,
  busyAction,
  canManage,
  onEdit,
  onArchive,
  onRestore,
}: {
  location: LocationDefinition | null;
  history: LocationNameHistory[];
  historyLoading: boolean;
  busyAction: string;
  canManage: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  if (!location) return <EmptyState title="No location selected" text="Select a location definition to review its governed details and name history." />;
  const archived = location.status === "archived";
  const lifecycleBusy = busyAction === "archive" || busyAction === "restore";

  return (
    <article className="location-detail" aria-label={`${location.canonical_name} location details`}>
      <header className="location-detail-header">
        <div>
          <p className="eyebrow">{location.code}</p>
          <h2>{location.canonical_name}</h2>
        </div>
        <StatusPill label={location.status} tone={archived ? "warning" : "success"} />
      </header>
      <div className="location-detail-grid">
        <DetailItem label="Location type" value={typeLabel(location.location_type)} />
        <DetailItem label="Country code" value={location.country_code} />
        <DetailItem label="Version" value={String(location.version)} />
        <DetailItem label="Last updated" value={formatTimestamp(location.updated_at)} />
      </div>
      {canManage ? (
        <div className="location-detail-actions" aria-label="Location actions">
          <WorkspaceActionButton action="edit" disabled={archived || lifecycleBusy} onClick={onEdit}>Edit location</WorkspaceActionButton>
          {archived ? (
            <CommandButton icon={ArchiveRestore} loading={busyAction === "restore"} disabled={lifecycleBusy} onClick={onRestore}>Restore location</CommandButton>
          ) : (
            <ConfirmCommandButton
              icon={Archive}
              message={`Archive ${location.canonical_name}? The definition can be restored later.`}
              destructive
              loading={busyAction === "archive"}
              disabled={lifecycleBusy}
              onConfirm={onArchive}
            >
              Archive location
            </ConfirmCommandButton>
          )}
        </div>
      ) : null}
      <section className="location-name-history" aria-label="Canonical name history">
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

function typeLabel(value: LocationDefinition["location_type"]) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatTimestamp(value: string) {
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.valueOf()) ? value : timestamp.toLocaleString();
}

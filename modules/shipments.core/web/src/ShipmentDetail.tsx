import { ArrowRight } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { WorkspaceActionButton } from "@uok/shared/actions";
import { DetailItem, EmptyState, StatusPill } from "@uok/shared/data-display";
import { FieldMessage } from "@uok/shared/forms";
import { CommandButton } from "@uok/shared/primitives";
import { partyReferenceLabel } from "./partyReferenceDisplay";
import type { PartyReference, Shipment, ShipmentStatus, ShipmentStatusHistory } from "./types";
import { shipmentTransitions } from "./types";

export function ShipmentDetail({
  shipment,
  history,
  historyLoading,
  busyAction,
  canManage,
  documentEvidence,
  onEdit,
  onTransition,
}: {
  shipment: Shipment | null;
  history: ShipmentStatusHistory[];
  historyLoading: boolean;
  busyAction: string;
  canManage: boolean;
  documentEvidence?: ReactNode;
  onEdit: () => void;
  onTransition: (newStatus: ShipmentStatus, reason: string) => void;
}) {
  const [nextStatus, setNextStatus] = useState<ShipmentStatus | "">("");
  const [reason, setReason] = useState("");
  const transitions = shipment ? shipmentTransitions[shipment.status] : [];
  const editable = shipment?.status === "draft" || shipment?.status === "planned";
  const transitionBusy = busyAction === "transition";

  useEffect(() => {
    setNextStatus("");
    setReason("");
  }, [shipment?.id, shipment?.version]);

  if (!shipment) return <EmptyState title="No shipment selected" text="Select a Shipment to review its governed references and movement history." />;

  return (
    <article className="shipment-detail" aria-label={`${shipment.code} shipment details`}>
      <header className="shipment-detail-header">
        <div><p className="eyebrow">Shipment</p><h2>{shipment.code}</h2></div>
        <StatusPill label={statusLabel(shipment.status)} tone={statusTone(shipment.status)} />
      </header>
      <section className="shipment-reference-grid" aria-label="Shipment Parties and corridor">
        <ReferenceCard label="Shipper" id={shipment.shipper_party_id} reference={shipment.shipper} />
        <ReferenceCard label="Consignee" id={shipment.consignee_party_id} reference={shipment.consignee} />
        <LocationCard label="Origin" id={shipment.origin_location_id} location={shipment.origin} />
        <LocationCard label="Destination" id={shipment.destination_location_id} location={shipment.destination} />
      </section>
      <div className="shipment-detail-grid">
        <DetailItem label="Governed route" value={routeLabel(shipment)} />
        <DetailItem label="Planned departure" value={formatDate(shipment.planned_departure_on)} />
        <DetailItem label="Planned arrival" value={formatDate(shipment.planned_arrival_on)} />
        <DetailItem label="Version" value={String(shipment.version)} />
        <DetailItem label="Last updated" value={formatTimestamp(shipment.updated_at)} />
        <DetailItem label="Updated by" value={shipment.updated_by_user_id} />
      </div>
      {canManage ? (
        <div className="shipment-detail-actions" aria-label="Shipment actions">
          {editable ? <WorkspaceActionButton action="edit" disabled={transitionBusy} onClick={onEdit}>Edit shipment</WorkspaceActionButton> : null}
        </div>
      ) : null}
      {canManage && transitions.length ? (
        <form
          className="shipment-transition-form"
          aria-label="Change shipment status"
          onSubmit={(event) => {
            event.preventDefault();
            if (nextStatus && reason.trim() && !transitionBusy) onTransition(nextStatus, reason);
          }}
        >
          <h3>Next lifecycle step</h3>
          <div className="shipment-transition-controls">
            <label className="field">
              <span>Next status</span>
              <select value={nextStatus} required disabled={transitionBusy} onChange={(event) => setNextStatus(event.target.value as ShipmentStatus)}>
                <option value="">Choose a legal transition</option>
                {transitions.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
              </select>
            </label>
            <label className="field shipment-transition-reason">
              <span>Transition reason</span>
              <input
                value={reason}
                maxLength={500}
                required
                disabled={transitionBusy}
                placeholder="Operational reason"
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <CommandButton
              icon={ArrowRight}
              type="submit"
              loading={transitionBusy}
              disabled={!nextStatus || !reason.trim()}
            >Change status</CommandButton>
          </div>
          {nextStatus === "cancelled" ? <FieldMessage id="shipment-cancel-warning">Cancellation is terminal and cannot be reversed.</FieldMessage> : null}
        </form>
      ) : null}
      {documentEvidence}
      <section className="shipment-status-history" aria-label="Shipment status history">
        <h3>Status history</h3>
        {historyLoading ? <p role="status">Loading status history.</p> : history.length ? (
          <ol>
            {history.map((entry) => (
              <li key={entry.id}>
                <strong>{statusLabel(entry.previous_status)} → {statusLabel(entry.new_status)}</strong>
                <span>{entry.reason}</span>
                <small><time dateTime={entry.changed_at}>{formatTimestamp(entry.changed_at)}</time> · {entry.changed_by_user_id} · version {entry.version}</small>
              </li>
            ))}
          </ol>
        ) : <EmptyState text="No lifecycle transitions have been recorded." />}
      </section>
    </article>
  );
}

function ReferenceCard({ label, id, reference }: { label: string; id: string | null; reference: PartyReference }) {
  const body = (
    <>
      <strong>{partyReferenceLabel(reference, id)}</strong>
      <small>{reference.status_summary}</small>
    </>
  );
  return (
    <article className="shipment-reference-card">
      <div>
        <span className="shipment-reference-label">{label}</span>
        {reference.open_path && reference.status === "ready" ? <a href={reference.open_path}>{body}</a> : body}
      </div>
      <StatusPill label={reference.status} tone={reference.status === "ready" ? "success" : "warning"} />
    </article>
  );
}

function LocationCard({ label, id, location }: {
  label: string;
  id: string;
  location: Shipment["origin"];
}) {
  const display = [location.code, location.canonical_name].filter(Boolean).join(" · ") || id;
  return (
    <article className="shipment-reference-card">
      <div>
        <span className="shipment-reference-label">{label}</span>
        <strong>{display}</strong>
        <small>{location.status_summary}</small>
      </div>
      <StatusPill label={location.status} tone={location.status === "ready" ? "success" : "warning"} />
    </article>
  );
}

function routeLabel(shipment: Shipment) {
  if (!shipment.route_definition_id) return "Not set";
  return [shipment.route?.code, shipment.route?.canonical_name].filter(Boolean).join(" · ") || shipment.route_definition_id;
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

function formatDate(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString();
}

function formatTimestamp(value: string) {
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.valueOf()) ? value : timestamp.toLocaleString();
}

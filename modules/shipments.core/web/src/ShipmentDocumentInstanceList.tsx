import { WorkspaceActionButton } from "@uok/shared/actions";
import { EmptyState, StatusPill } from "@uok/shared/data-display";
import {
  instanceCanEdit,
  instanceDocumentTypeLabel,
  instanceStatusLabel,
  instanceTransitions,
} from "./shipmentDocumentInstanceDisplay";
import type {
  ShipmentDocumentInstance,
  ShipmentDocumentInstanceEditorMode,
} from "./shipmentDocumentInstanceTypes";

export function ShipmentDocumentInstanceList({
  items,
  canManage,
  busy,
  onAction,
}: {
  items: ShipmentDocumentInstance[];
  canManage: boolean;
  busy: boolean;
  onAction: (
    mode: Exclude<ShipmentDocumentInstanceEditorMode, "create">,
    instance: ShipmentDocumentInstance,
  ) => void;
}) {
  if (!items.length) {
    return (
      <EmptyState
        title="No document instances"
        text="No compliance document metadata is recorded for this Shipment."
      />
    );
  }
  return (
    <ul className="shipment-instance-list" aria-label="Shipment document instances">
      {items.map((instance) => {
        const typeLabel = instanceDocumentTypeLabel(instance);
        return (
          <li key={instance.id}>
            <div className="shipment-instance-row-header">
              <div>
                <strong>{typeLabel}</strong>
                <span>{instance.document_number}</span>
              </div>
              <StatusPill
                label={instanceStatusLabel(instance.status)}
                tone={instanceTone(instance.status)}
              />
            </div>
            {instance.document_type.status !== "ready" ? (
              <p className="shipment-instance-warning">
                {instance.document_type.status_summary}
              </p>
            ) : null}
            <dl className="shipment-instance-facts">
              <div><dt>Issuer</dt><dd>{instance.issuing_party_name || "Not recorded"}</dd></div>
              <div><dt>Issued</dt><dd>{formatDate(instance.issued_on)}</dd></div>
              <div><dt>Expires</dt><dd>{formatDate(instance.expires_on)}</dd></div>
              <div>
                <dt>Requirement</dt>
                <dd>{instance.requirement
                  ? `${instance.requirement.requirement_level} · ${instance.requirement.status}`
                  : "Not linked"}</dd>
              </div>
            </dl>
            {instance.notes ? <p className="shipment-instance-notes">{instance.notes}</p> : null}
            <small className="shipment-instance-meta">
              Version {instance.version} · updated {formatTimestamp(instance.updated_at)}
            </small>
            {canManage ? (
              <div className="shipment-instance-actions">
                {instanceCanEdit(instance.status) ? (
                  <WorkspaceActionButton
                    action="edit"
                    aria-label={`Edit ${typeLabel} ${instance.document_number}`}
                    disabled={busy}
                    onClick={() => onAction("edit", instance)}
                  />
                ) : null}
                {instanceTransitions(instance.status).length ? (
                  <WorkspaceActionButton
                    action="save"
                    aria-label={`Change status for ${typeLabel} ${instance.document_number}`}
                    disabled={busy}
                    onClick={() => onAction("status", instance)}
                  >
                    Change status
                  </WorkspaceActionButton>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function instanceTone(status: ShipmentDocumentInstance["status"]) {
  if (status === "verified") return "success";
  if (status === "rejected" || status === "superseded") return "warning";
  return "info";
}

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString();
}

function formatTimestamp(value: string) {
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.valueOf()) ? value : timestamp.toLocaleString();
}

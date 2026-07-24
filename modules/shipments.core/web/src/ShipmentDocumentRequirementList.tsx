import { WorkspaceActionButton } from "@uok/shared/actions";
import { EmptyState, StatusPill } from "@uok/shared/data-display";
import {
  documentTypeLabel,
  requirementStatusLabel,
} from "./shipmentDocumentRequirementDisplay";
import type {
  ShipmentDocumentRequirement,
  ShipmentDocumentRequirementEditorMode,
} from "./shipmentDocumentRequirementTypes";

export function ShipmentDocumentRequirementList({
  items,
  canManage,
  busy,
  onAction,
}: {
  items: ShipmentDocumentRequirement[];
  canManage: boolean;
  busy: boolean;
  onAction: (
    mode: Exclude<ShipmentDocumentRequirementEditorMode, "add">,
    requirement: ShipmentDocumentRequirement,
  ) => void;
}) {
  if (!items.length) {
    return (
      <EmptyState
        title="No document requirements"
        text="No document type requirement links are attached to this Shipment."
      />
    );
  }
  return (
    <ul className="shipment-requirement-list" aria-label="Shipment document requirements">
      {items.map((requirement) => {
        const label = documentTypeLabel(requirement.document_type);
        return (
          <li key={requirement.id}>
            <div className="shipment-requirement-row-header">
              <div>
                <strong>{label}</strong>
                <small>
                  {requirement.document_type.category || "Uncategorized"}
                  {" · "}
                  {requirement.requirement_level === "required" ? "Required" : "Optional"}
                </small>
              </div>
              <StatusPill
                label={requirementStatusLabel(requirement.status)}
                tone={requirementTone(requirement.status)}
              />
            </div>
            {requirement.document_type.status !== "ready" ? (
              <p className="shipment-requirement-warning">
                {requirement.document_type.status_summary}
              </p>
            ) : null}
            {requirement.notes ? (
              <p className="shipment-requirement-notes">{requirement.notes}</p>
            ) : null}
            <small className="shipment-requirement-meta">
              Version {requirement.version} · updated {formatTimestamp(requirement.updated_at)}
            </small>
            {canManage ? (
              <div className="shipment-requirement-actions">
                <WorkspaceActionButton
                  action="edit"
                  aria-label={`Edit ${label}`}
                  disabled={busy}
                  onClick={() => onAction("edit", requirement)}
                />
                <WorkspaceActionButton
                  action="save"
                  aria-label={`Set status for ${label}`}
                  disabled={busy}
                  onClick={() => onAction("status", requirement)}
                >
                  Set status
                </WorkspaceActionButton>
                <WorkspaceActionButton
                  action="delete"
                  aria-label={`Remove ${label}`}
                  disabled={busy}
                  onClick={() => onAction("remove", requirement)}
                >
                  Remove
                </WorkspaceActionButton>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function requirementTone(status: ShipmentDocumentRequirement["status"]) {
  if (status === "received") return "success";
  if (status === "missing") return "warning";
  return "info";
}

function formatTimestamp(value: string) {
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.valueOf()) ? value : timestamp.toLocaleString();
}

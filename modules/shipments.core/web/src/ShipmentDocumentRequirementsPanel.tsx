import { useState, type ReactNode } from "react";

import { WorkspaceActionButton } from "@uok/shared/actions";
import { FieldMessage } from "@uok/shared/forms";
import { WorkspaceEditorPopup } from "@uok/shared/overlays";
import { ShipmentDocumentRequirementEditor } from "./ShipmentDocumentRequirementEditor";
import { ShipmentDocumentRequirementList } from "./ShipmentDocumentRequirementList";
import { requirementSubmitLabel } from "./shipmentDocumentRequirementDisplay";
import type { ShipmentDocumentRequirementEditorMode } from "./shipmentDocumentRequirementTypes";
import { useShipmentDocumentRequirementMutations } from "./useShipmentDocumentRequirementMutations";
import { useShipmentDocumentRequirementReads } from "./useShipmentDocumentRequirementReads";

export function ShipmentDocumentRequirementsPanel({
  token,
  shipmentId,
  canManage,
  onUnauthorized,
  onStatus,
}: {
  token: string;
  shipmentId: string;
  canManage: boolean;
  onUnauthorized: () => void;
  onStatus: (message: string) => void;
}) {
  const [message, setMessage] = useState("");
  const reportStatus = (value: string) => {
    setMessage(value);
    onStatus(value);
  };
  const reads = useShipmentDocumentRequirementReads({
    token,
    shipmentId,
    onUnauthorized,
    onError: reportStatus,
  });
  const mutations = useShipmentDocumentRequirementMutations({
    token,
    shipmentId,
    canManage,
    onUnauthorized,
    invalidate: reads.invalidate,
    reload: reads.reload,
    onStatus: reportStatus,
  });
  const busy = Boolean(mutations.busy);

  return (
    <section className="shipment-requirements" aria-label="Document requirements">
      <header className="shipment-requirements-header">
        <div>
          <h3>Document requirements</h3>
          <p>{summaryLabel(reads.summary)}</p>
        </div>
        {canManage ? (
          <WorkspaceActionButton
            action="create"
            labelKey="command.addShipmentDocumentRequirement"
            fallbackLabel="Add requirement"
            primary
            disabled={reads.loading || busy || !reads.options.length}
            onClick={() => mutations.open("add")}
          />
        ) : null}
      </header>
      <p className="shipment-requirement-summary-detail">
        {reads.summary.required_not_applicable} not applicable
        {" · "}
        {reads.summary.optional_total} optional
      </p>
      {reads.loading ? <p role="status">Loading document requirements.</p> : (
        <ShipmentDocumentRequirementList
          items={reads.items}
          canManage={canManage}
          busy={busy}
          onAction={mutations.open}
        />
      )}
      {canManage && !reads.loading && !reads.options.length ? (
        <p className="shipment-requirement-guidance">
          Create or activate a Compliance document type before adding a requirement.
        </p>
      ) : null}
      {message ? <FieldMessage id="shipment-requirement-status">{message}</FieldMessage> : null}
      <RequirementPopup
        mode={mutations.mode}
        targetLabel={mutations.target?.document_type.canonical_name || ""}
        dismissible={!mutations.activeOperation.current}
        onClose={mutations.close}
      >
        {mutations.mode ? (
          <ShipmentDocumentRequirementEditor
            key={`${mutations.mode}:${mutations.target?.id || "new"}:${mutations.target?.version || 0}`}
            mode={mutations.mode}
            target={mutations.target}
            options={reads.options}
            busy={busy}
            error={mutations.error}
            onCancel={mutations.close}
            onSubmit={(draft) => void mutations.submit(draft)}
          />
        ) : null}
      </RequirementPopup>
    </section>
  );
}

function RequirementPopup({
  mode,
  targetLabel,
  dismissible,
  onClose,
  children,
}: {
  mode: ShipmentDocumentRequirementEditorMode | null;
  targetLabel: string;
  dismissible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const action = mode ? requirementSubmitLabel(mode) : "Document requirement";
  return (
    <WorkspaceEditorPopup
      open={mode !== null}
      label={action}
      title={action}
      description={targetLabel || "Manage one Shipment-owned document type link."}
      dismissible={dismissible}
      onClose={onClose}
    >
      {children}
    </WorkspaceEditorPopup>
  );
}

function summaryLabel(summary: {
  required_total: number;
  required_received: number;
  required_waived: number;
  required_missing: number;
}) {
  return [
    `${summary.required_total} required`,
    `${summary.required_received} received`,
    `${summary.required_waived} waived`,
    `${summary.required_missing} missing`,
  ].join(" · ");
}

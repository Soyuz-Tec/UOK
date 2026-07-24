import { useState, type ReactNode } from "react";

import { WorkspaceActionButton } from "@uok/shared/actions";
import { FieldMessage } from "@uok/shared/forms";
import { WorkspaceEditorPopup } from "@uok/shared/overlays";
import { ShipmentDocumentInstanceList } from "./ShipmentDocumentInstanceList";
import { ShipmentDocumentInstanceMetadataEditor } from "./ShipmentDocumentInstanceMetadataEditor";
import { ShipmentDocumentInstanceStatusEditor } from "./ShipmentDocumentInstanceStatusEditor";
import {
  instanceDocumentTypeLabel,
  instanceEditorTitle,
} from "./shipmentDocumentInstanceDisplay";
import type { ShipmentDocumentInstanceEditorMode } from "./shipmentDocumentInstanceTypes";
import { useShipmentDocumentInstanceMutations } from "./useShipmentDocumentInstanceMutations";
import { useShipmentDocumentInstanceReads } from "./useShipmentDocumentInstanceReads";

export function ShipmentDocumentInstancesPanel({
  token,
  shipmentId,
  canManage,
  onUnauthorized,
  onStatus,
  onRequirementChanged,
}: {
  token: string;
  shipmentId: string;
  canManage: boolean;
  onUnauthorized: () => void;
  onStatus: (message: string) => void;
  onRequirementChanged: () => void;
}) {
  const [message, setMessage] = useState("");
  const reportStatus = (value: string) => {
    setMessage(value);
    onStatus(value);
  };
  const reads = useShipmentDocumentInstanceReads({
    token,
    shipmentId,
    onUnauthorized,
    onError: reportStatus,
  });
  const mutations = useShipmentDocumentInstanceMutations({
    token,
    shipmentId,
    canManage,
    onUnauthorized,
    invalidate: reads.invalidate,
    reload: reads.reload,
    onStatus: reportStatus,
    onRequirementChanged,
  });
  const busy = Boolean(mutations.busy);

  return (
    <section className="shipment-instances" aria-label="Document instances">
      <header className="shipment-instances-header">
        <div>
          <h3>Document instances</h3>
          <p>{instanceSummary(reads.items)}</p>
        </div>
        {canManage ? (
          <WorkspaceActionButton
            action="create"
            labelKey="command.createShipmentDocumentInstance"
            fallbackLabel="Add document metadata"
            primary
            disabled={reads.loading || busy || !reads.documentTypes.length}
            onClick={() => mutations.open("create")}
          />
        ) : null}
      </header>
      {reads.loading ? <p role="status">Loading document instances.</p> : (
        <ShipmentDocumentInstanceList
          items={reads.items}
          canManage={canManage}
          busy={busy}
          onAction={mutations.open}
        />
      )}
      {canManage && !reads.loading && !reads.documentTypes.length ? (
        <p className="shipment-instance-guidance">
          Create or activate a Compliance document type before recording metadata.
        </p>
      ) : null}
      {message ? <FieldMessage id="shipment-instance-status">{message}</FieldMessage> : null}
      <InstancePopup
        mode={mutations.mode}
        targetLabel={mutations.target ? instanceDocumentTypeLabel(mutations.target) : ""}
        dismissible={!mutations.activeOperation.current}
        onClose={mutations.close}
      >
        {mutations.mode === "status" && mutations.target ? (
          <ShipmentDocumentInstanceStatusEditor
            key={`status:${mutations.target.id}:${mutations.target.version}`}
            target={mutations.target}
            busy={busy}
            error={mutations.error}
            onCancel={mutations.close}
            onSubmit={(draft) => void mutations.submitStatus(draft)}
          />
        ) : mutations.mode ? (
          <ShipmentDocumentInstanceMetadataEditor
            key={`${mutations.mode}:${mutations.target?.id || "new"}:${mutations.target?.version || 0}`}
            mode={mutations.mode === "create" ? "create" : "edit"}
            target={mutations.target}
            documentTypes={reads.documentTypes}
            requirements={reads.requirements}
            busy={busy}
            error={mutations.error}
            onCancel={mutations.close}
            onSubmit={(draft) => void mutations.submitMetadata(draft)}
          />
        ) : null}
      </InstancePopup>
    </section>
  );
}

function InstancePopup({
  mode,
  targetLabel,
  dismissible,
  onClose,
  children,
}: {
  mode: ShipmentDocumentInstanceEditorMode | null;
  targetLabel: string;
  dismissible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const title = mode ? instanceEditorTitle(mode) : "Document instance";
  return (
    <WorkspaceEditorPopup
      open={mode !== null}
      label={title}
      title={title}
      description={targetLabel || "Record Shipment-owned compliance document metadata."}
      dismissible={dismissible}
      onClose={onClose}
    >
      {children}
    </WorkspaceEditorPopup>
  );
}

function instanceSummary(items: { status: string }[]) {
  const verified = items.filter((item) => item.status === "verified").length;
  return `${items.length} instances · ${verified} verified`;
}

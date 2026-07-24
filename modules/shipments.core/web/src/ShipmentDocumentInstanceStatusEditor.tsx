import { useEffect, useMemo, useState } from "react";

import { WorkspaceActionButton } from "@uok/shared/actions";
import { FieldMessage } from "@uok/shared/forms";
import {
  instanceDocumentTypeLabel,
  instanceStatusLabel,
  instanceTransitions,
} from "./shipmentDocumentInstanceDisplay";
import {
  emptyInstanceStatusDraft,
  type ShipmentDocumentInstance,
  type ShipmentDocumentInstanceStatus,
  type ShipmentDocumentInstanceStatusDraft,
} from "./shipmentDocumentInstanceTypes";

export function ShipmentDocumentInstanceStatusEditor({
  target,
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  target: ShipmentDocumentInstance;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onSubmit: (draft: ShipmentDocumentInstanceStatusDraft) => void;
}) {
  const [draft, setDraft] = useState({ ...emptyInstanceStatusDraft });
  const options = useMemo(() => instanceTransitions(target.status), [target.status]);
  const canReceiveRequirement = draft.newStatus === "verified"
    && target.requirement?.status === "missing";
  const validation = !draft.newStatus
    ? "Choose a legal status."
    : !draft.reason.trim()
      ? "A transition reason is required."
      : "";
  const messageId = validation
    ? "shipment-instance-status-validation"
    : error
      ? "shipment-instance-status-error"
      : undefined;

  useEffect(() => {
    setDraft({ ...emptyInstanceStatusDraft });
  }, [target.id, target.version]);

  return (
    <form
      className="shipment-instance-editor"
      aria-label="Change document instance status form"
      aria-describedby={messageId}
      aria-invalid={Boolean(messageId)}
      onSubmit={(event) => {
        event.preventDefault();
        if (!validation && !busy) onSubmit(draft);
      }}
    >
      <div className="shipment-instance-editor-target">
        <p><span>Document type</span><strong>{instanceDocumentTypeLabel(target)}</strong></p>
        <p><span>Document number</span><strong>{target.document_number}</strong></p>
        <p><span>Current status</span><strong>{instanceStatusLabel(target.status)}</strong></p>
      </div>
      <label className="field">
        <span>New instance status</span>
        <select
          autoFocus
          value={draft.newStatus}
          required
          disabled={busy}
          onChange={(event) => {
            const newStatus = event.target.value as ShipmentDocumentInstanceStatus;
            setDraft({
              ...draft,
              newStatus,
              markRequirementReceived: newStatus === "verified"
                ? draft.markRequirementReceived
                : false,
            });
          }}
        >
          <option value="">Choose a legal transition</option>
          {options.map((status) => (
            <option key={status} value={status}>{instanceStatusLabel(status)}</option>
          ))}
        </select>
      </label>
      {canReceiveRequirement ? (
        <label className="shipment-instance-requirement-checkbox">
          <input
            type="checkbox"
            checked={draft.markRequirementReceived}
            disabled={busy}
            onChange={(event) => setDraft({
              ...draft,
              markRequirementReceived: event.target.checked,
            })}
          />
          <span>Mark linked requirement received</span>
        </label>
      ) : null}
      <label className="field">
        <span>Transition reason</span>
        <input
          value={draft.reason}
          maxLength={500}
          required
          disabled={busy}
          onChange={(event) => setDraft({ ...draft, reason: event.target.value })}
        />
      </label>
      {validation ? <FieldMessage id="shipment-instance-status-validation">{validation}</FieldMessage> : null}
      {error ? <FieldMessage id="shipment-instance-status-error">{error}</FieldMessage> : null}
      <div className="shipment-instance-editor-actions">
        <WorkspaceActionButton action="cancel" disabled={busy} onClick={onCancel} />
        <WorkspaceActionButton
          action="save"
          type="submit"
          primary
          loading={busy}
          disabled={Boolean(validation)}
        >
          Change status
        </WorkspaceActionButton>
      </div>
    </form>
  );
}

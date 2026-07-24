import { useEffect, useMemo, useState } from "react";

import { WorkspaceActionButton } from "@uok/shared/actions";
import { FieldMessage } from "@uok/shared/forms";
import { ShipmentDocumentInstanceDateFields } from "./ShipmentDocumentInstanceDateFields";
import {
  initialInstanceMetadataDraft,
  matchingRequirementOptions,
  validateInstanceMetadata,
} from "./shipmentDocumentInstanceDisplay";
import { documentTypeLabel } from "./shipmentDocumentRequirementDisplay";
import type {
  ShipmentDocumentRequirement,
  ShipmentDocumentTypeReference,
} from "./shipmentDocumentRequirementTypes";
import type {
  ShipmentDocumentInstance,
  ShipmentDocumentInstanceMetadataDraft,
} from "./shipmentDocumentInstanceTypes";

export function ShipmentDocumentInstanceMetadataEditor({
  mode,
  target,
  documentTypes,
  requirements,
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  mode: "create" | "edit";
  target: ShipmentDocumentInstance | null;
  documentTypes: ShipmentDocumentTypeReference[];
  requirements: ShipmentDocumentRequirement[];
  busy: boolean;
  error: string;
  onCancel: () => void;
  onSubmit: (draft: ShipmentDocumentInstanceMetadataDraft) => void;
}) {
  const [draft, setDraft] = useState(() => initialInstanceMetadataDraft(target));
  const requirementOptions = useMemo(
    () => matchingRequirementOptions(requirements, draft.complianceDocumentTypeId),
    [draft.complianceDocumentTypeId, requirements],
  );
  const validation = useMemo(
    () => validateInstanceMetadata(mode, target, draft),
    [draft, mode, target],
  );
  const messageId = validation ? "shipment-instance-metadata-validation"
    : error ? "shipment-instance-metadata-error" : undefined;

  useEffect(() => {
    setDraft(initialInstanceMetadataDraft(target));
  }, [target?.id, target?.version]);

  return (
    <form
      className="shipment-instance-editor"
      aria-label={`${mode === "create" ? "Create" : "Edit"} document instance form`}
      aria-describedby={messageId}
      aria-invalid={Boolean(messageId)}
      onSubmit={(event) => {
        event.preventDefault();
        if (!validation && !busy) onSubmit(draft);
      }}
    >
      {mode === "create" ? (
        <>
          <label className="field">
            <span>Compliance document type</span>
            <select
              autoFocus
              required
              value={draft.complianceDocumentTypeId}
              disabled={busy}
              onChange={(event) => {
                const complianceDocumentTypeId = event.target.value;
                const linked = requirements.find(
                  (requirement) => requirement.id === draft.requirementId,
                );
                setDraft({
                  ...draft,
                  complianceDocumentTypeId,
                  requirementId: linked?.compliance_document_type_id === complianceDocumentTypeId
                    ? draft.requirementId
                    : "",
                });
              }}
            >
              <option value="">Select an active type</option>
              {documentTypes.map((option) => (
                <option
                  key={option.compliance_document_type_id!}
                  value={option.compliance_document_type_id!}
                >
                  {documentTypeLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Requirement link (optional)</span>
            <select
              value={draft.requirementId}
              disabled={busy}
              onChange={(event) => {
                const requirement = requirements.find(
                  (candidate) => candidate.id === event.target.value,
                );
                setDraft({
                  ...draft,
                  requirementId: event.target.value,
                  complianceDocumentTypeId: requirement?.compliance_document_type_id
                    || draft.complianceDocumentTypeId,
                });
              }}
            >
              <option value="">No linked requirement</option>
              {requirementOptions.map((requirement) => (
                <option key={requirement.id} value={requirement.id}>
                  {documentTypeLabel(requirement.document_type)}
                  {" · "}
                  {requirement.requirement_level}
                  {" · "}
                  {requirement.status}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <div className="shipment-instance-editor-target">
          <p><span>Document type</span><strong>{target ? documentTypeLabel(target.document_type) : "Unavailable"}</strong></p>
          <p><span>Requirement link</span><strong>{target?.requirement ? `${target.requirement.requirement_level} · ${target.requirement.status}` : "None"}</strong></p>
        </div>
      )}
      <label className="field">
        <span>Document number</span>
        <input
          value={draft.documentNumber}
          maxLength={160}
          required
          disabled={busy}
          onChange={(event) => setDraft({ ...draft, documentNumber: event.target.value })}
        />
      </label>
      <label className="field">
        <span>Issuing party name (optional)</span>
        <input
          value={draft.issuingPartyName}
          maxLength={240}
          disabled={busy}
          onChange={(event) => setDraft({ ...draft, issuingPartyName: event.target.value })}
        />
      </label>
      <ShipmentDocumentInstanceDateFields
        draft={draft}
        busy={busy}
        onChange={setDraft}
      />
      <label className="field">
        <span>Operational notes (optional)</span>
        <textarea
          value={draft.notes}
          maxLength={2000}
          rows={4}
          disabled={busy}
          onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
        />
      </label>
      {mode === "edit" ? (
        <label className="field">
          <span>Change reason</span>
          <input
            value={draft.reason}
            maxLength={500}
            required
            disabled={busy}
            onChange={(event) => setDraft({ ...draft, reason: event.target.value })}
          />
        </label>
      ) : null}
      {validation ? <FieldMessage id="shipment-instance-metadata-validation">{validation}</FieldMessage> : null}
      {error ? <FieldMessage id="shipment-instance-metadata-error">{error}</FieldMessage> : null}
      <div className="shipment-instance-editor-actions">
        <WorkspaceActionButton action="cancel" disabled={busy} onClick={onCancel} />
        <WorkspaceActionButton
          action={mode === "create" ? "create" : "save"}
          type="submit"
          primary
          loading={busy}
          disabled={Boolean(validation)}
        >
          {mode === "create" ? "Create instance" : "Save metadata"}
        </WorkspaceActionButton>
      </div>
    </form>
  );
}

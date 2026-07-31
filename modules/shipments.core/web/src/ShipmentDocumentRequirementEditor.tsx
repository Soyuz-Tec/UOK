import { useEffect, useMemo, useRef, useState } from "react";

import { WorkspaceActionButton } from "@uok/shared/actions";
import { FieldMessage } from "@uok/shared/forms";
import {
  documentTypeLabel,
  initialRequirementDraft,
  requirementEditorLabel,
  requirementStatuses,
  requirementStatusLabel,
  requirementSubmitLabel,
  validateRequirementDraft,
} from "./shipmentDocumentRequirementDisplay";
import type {
  ShipmentDocumentRequirement,
  ShipmentDocumentRequirementDraft,
  ShipmentDocumentRequirementEditorMode,
  ShipmentDocumentRequirementStatus,
  ShipmentDocumentTypeReference,
} from "./shipmentDocumentRequirementTypes";

export function ShipmentDocumentRequirementEditor({
  mode,
  target,
  options,
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  mode: ShipmentDocumentRequirementEditorMode;
  target: ShipmentDocumentRequirement | null;
  options: ShipmentDocumentTypeReference[];
  busy: boolean;
  error: string;
  onCancel: () => void;
  onSubmit: (draft: ShipmentDocumentRequirementDraft) => void;
}) {
  const [draft, setDraft] = useState(() => initialRequirementDraft(mode, target));
  const currentTarget = useRef(target);
  currentTarget.current = target;
  const validation = useMemo(
    () => validateRequirementDraft(mode, target, draft),
    [draft, mode, target],
  );

  useEffect(() => {
    setDraft(initialRequirementDraft(mode, currentTarget.current));
  }, [mode, target?.id, target?.version]);

  return (
    <form
      className="shipment-requirement-editor"
      aria-label={requirementEditorLabel(mode)}
      onSubmit={(event) => {
        event.preventDefault();
        if (!validation && !busy) onSubmit(draft);
      }}
    >
      {mode === "add" ? (
        <label className="field">
          <span>Compliance document type</span>
          <select
            autoFocus
            value={draft.complianceDocumentTypeId}
            required
            disabled={busy}
            onChange={(event) => setDraft({
              ...draft,
              complianceDocumentTypeId: event.target.value,
            })}
          >
            <option value="">Select an active type</option>
            {options.map((option) => (
              <option
                key={option.compliance_document_type_id!}
                value={option.compliance_document_type_id!}
              >
                {documentTypeLabel(option)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="shipment-requirement-editor-target">
          <span>Document type</span>
          <strong>{target ? documentTypeLabel(target.document_type) : "Unavailable"}</strong>
        </p>
      )}
      {mode === "add" || mode === "edit" ? (
        <>
          <label className="field">
            <span>Requirement level</span>
            <select
              value={draft.requirementLevel}
              disabled={busy}
              onChange={(event) => setDraft({
                ...draft,
                requirementLevel: event.target.value as "required" | "optional",
              })}
            >
              <option value="required">Required</option>
              <option value="optional">Optional</option>
            </select>
          </label>
          <label className="field">
            <span>Operational notes</span>
            <textarea
              value={draft.notes}
              maxLength={2000}
              rows={4}
              disabled={busy}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
            />
          </label>
        </>
      ) : null}
      {mode === "status" ? (
        <label className="field">
          <span>New satisfaction status</span>
          <select
            autoFocus
            value={draft.newStatus}
            required
            disabled={busy}
            onChange={(event) => setDraft({
              ...draft,
              newStatus: event.target.value as ShipmentDocumentRequirementStatus,
            })}
          >
            <option value="">Choose a different status</option>
            {requirementStatuses.filter((status) => status !== target?.status).map((status) => (
              <option key={status} value={status}>{requirementStatusLabel(status)}</option>
            ))}
          </select>
        </label>
      ) : null}
      {mode === "remove" ? (
        <p className="shipment-requirement-remove-warning">
          Remove this active link? Its owner audit history is retained.
        </p>
      ) : null}
      {mode !== "add" ? (
        <label className="field">
          <span>{mode === "remove" ? "Removal reason" : "Change reason"}</span>
          <input
            autoFocus={mode !== "status"}
            value={draft.reason}
            maxLength={500}
            required
            disabled={busy}
            placeholder="Operational reason"
            onChange={(event) => setDraft({ ...draft, reason: event.target.value })}
          />
        </label>
      ) : null}
      {validation ? <FieldMessage id="shipment-requirement-validation">{validation}</FieldMessage> : null}
      {error ? <FieldMessage id="shipment-requirement-error">{error}</FieldMessage> : null}
      <div className="shipment-requirement-editor-actions">
        <WorkspaceActionButton action="cancel" disabled={busy} onClick={onCancel} />
        <WorkspaceActionButton
          action={mode === "remove" ? "delete" : mode === "add" ? "create" : "save"}
          type="submit"
          primary={mode !== "remove"}
          loading={busy}
          disabled={Boolean(validation)}
        >
          {requirementSubmitLabel(mode)}
        </WorkspaceActionButton>
      </div>
    </form>
  );
}

import { useEffect, useState } from "react";

import { WorkspaceActionButton } from "@uok/shared/actions";
import { FieldMessage } from "@uok/shared/forms";
import type { ComplianceDocumentType, ComplianceDocumentTypeDraft } from "./types";
import {
  draftFromComplianceDocumentType,
  emptyComplianceDocumentTypeDraft,
} from "./types";

export function ComplianceDocumentTypeEditor({
  mode,
  documentType,
  busy,
  locked,
  error,
  onCancel,
  onSubmit,
}: {
  mode: "create" | "edit";
  documentType: ComplianceDocumentType | null;
  busy: boolean;
  locked: boolean;
  error: string;
  onCancel: () => void;
  onSubmit: (draft: ComplianceDocumentTypeDraft) => void;
}) {
  const [draft, setDraft] = useState(() => initialDraft(mode, documentType));
  const validation = validateDraft(mode, draft, documentType);

  useEffect(() => {
    setDraft(initialDraft(mode, documentType));
  }, [documentType, mode]);

  return (
    <form
      className="compliance-document-type-editor-form"
      aria-label={mode === "create"
        ? "Create compliance document type"
        : "Edit compliance document type"}
      aria-describedby={[
        validation ? "compliance-document-type-editor-validation" : "",
        error ? "compliance-document-type-editor-error" : "",
      ].filter(Boolean).join(" ") || undefined}
      onSubmit={(event) => {
        event.preventDefault();
        if (!validation && !locked) onSubmit(draft);
      }}
    >
      <div className="compliance-document-type-editor-grid">
        <label className="field">
          <span>Document type code</span>
          <input
            autoFocus={mode === "create"}
            value={draft.code}
            maxLength={80}
            required
            disabled={locked || mode === "edit"}
            aria-invalid={!draft.code.trim() || undefined}
            aria-describedby={!draft.code.trim()
              ? "compliance-document-type-editor-validation"
              : undefined}
            onChange={(event) => setDraft({ ...draft, code: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Canonical name</span>
          <input
            autoFocus={mode === "edit"}
            value={draft.canonicalName}
            maxLength={180}
            required
            disabled={locked}
            aria-invalid={!draft.canonicalName.trim() || undefined}
            aria-describedby={!draft.canonicalName.trim()
              ? "compliance-document-type-editor-validation"
              : undefined}
            onChange={(event) => setDraft({ ...draft, canonicalName: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Category</span>
          <input
            value={draft.category}
            maxLength={120}
            disabled={locked}
            placeholder="Optional family"
            onChange={(event) => setDraft({ ...draft, category: event.target.value })}
          />
        </label>
        {mode === "edit" ? (
          <label className="field">
            <span>Change reason</span>
            <input
              value={draft.reason}
              maxLength={500}
              required
              disabled={locked}
              placeholder="Why this registry entry changed"
              aria-invalid={!draft.reason.trim() || undefined}
              aria-describedby={!draft.reason.trim()
                ? "compliance-document-type-editor-validation"
                : undefined}
              onChange={(event) => setDraft({ ...draft, reason: event.target.value })}
            />
          </label>
        ) : null}
        <label className="field compliance-document-type-editor-wide-field">
          <span>Description</span>
          <textarea
            value={draft.description}
            maxLength={2000}
            rows={4}
            disabled={locked}
            placeholder="Optional operational meaning"
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          />
        </label>
      </div>
      {validation ? (
        <FieldMessage id="compliance-document-type-editor-validation">
          {validation}
        </FieldMessage>
      ) : null}
      {error ? (
        <FieldMessage id="compliance-document-type-editor-error">{error}</FieldMessage>
      ) : null}
      <div className="compliance-document-type-editor-actions">
        <WorkspaceActionButton action="cancel" disabled={locked} onClick={onCancel} />
        <WorkspaceActionButton
          action={mode === "create" ? "create" : "save"}
          labelKey={mode === "create"
            ? "command.createComplianceDocumentType"
            : "command.saveComplianceDocumentType"}
          fallbackLabel={mode === "create" ? "Create document type" : "Save document type"}
          type="submit"
          primary
          loading={busy}
          disabled={locked || Boolean(validation)}
        />
      </div>
    </form>
  );
}

function initialDraft(
  mode: "create" | "edit",
  documentType: ComplianceDocumentType | null,
) {
  return mode === "edit" && documentType
    ? draftFromComplianceDocumentType(documentType)
    : { ...emptyComplianceDocumentTypeDraft };
}

function validateDraft(
  mode: "create" | "edit",
  draft: ComplianceDocumentTypeDraft,
  documentType: ComplianceDocumentType | null,
) {
  if (!draft.code.trim() || !draft.canonicalName.trim()) {
    return "Document type code and canonical name are required.";
  }
  if (mode === "edit" && !draft.reason.trim()) return "A change reason is required.";
  if (mode === "edit" && documentType && !hasChanges(draft, documentType)) {
    return "Change at least one governed field before saving.";
  }
  return "";
}

function hasChanges(
  draft: ComplianceDocumentTypeDraft,
  documentType: ComplianceDocumentType,
) {
  return draft.canonicalName.trim() !== documentType.canonical_name
    || (draft.description.trim() || null) !== documentType.description
    || (draft.category.trim() || null) !== documentType.category;
}

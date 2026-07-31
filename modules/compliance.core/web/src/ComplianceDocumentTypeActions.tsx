import { Archive, ArchiveRestore, CirclePause, CirclePlay } from "lucide-react";
import { useEffect, useState } from "react";

import { ConfirmCommandButton, WorkspaceActionButton } from "@uok/shared/actions";
import { FieldMessage } from "@uok/shared/forms";
import { CommandButton } from "@uok/shared/primitives";
import type {
  ComplianceDocumentType,
  ComplianceDocumentTypeLifecycleAction,
} from "./types";

export function ComplianceDocumentTypeActions({
  documentType,
  busyAction,
  operationActive,
  onEdit,
  onLifecycle,
}: {
  documentType: ComplianceDocumentType;
  busyAction: string;
  operationActive: boolean;
  onEdit: () => void;
  onLifecycle: (action: ComplianceDocumentTypeLifecycleAction, reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const reasonMissing = !reason.trim();

  useEffect(() => {
    setReason("");
  }, [documentType.id, documentType.version]);

  return (
    <section className="compliance-document-type-lifecycle" aria-label="Document type actions">
      <label className="field">
        <span>Lifecycle reason</span>
        <input
          value={reason}
          maxLength={500}
          required
          disabled={operationActive}
          placeholder="Required before changing status"
          aria-invalid={reasonMissing || undefined}
          aria-describedby={reasonMissing
            ? "compliance-document-type-lifecycle-reason"
            : undefined}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      {reasonMissing ? (
        <FieldMessage id="compliance-document-type-lifecycle-reason">
          Enter a reason to change lifecycle status.
        </FieldMessage>
      ) : null}
      <div className="compliance-document-type-detail-actions">
        {documentType.status !== "archived" ? (
          <WorkspaceActionButton
            action="edit"
            disabled={operationActive}
            onClick={onEdit}
          >
            Edit document type
          </WorkspaceActionButton>
        ) : null}
        {documentType.status === "active" ? (
          <CommandButton
            icon={CirclePause}
            loading={busyAction === "deactivate"}
            disabled={operationActive || reasonMissing}
            onClick={() => onLifecycle("deactivate", reason)}
          >
            Deactivate document type
          </CommandButton>
        ) : null}
        {documentType.status === "inactive" ? (
          <CommandButton
            icon={CirclePlay}
            loading={busyAction === "activate"}
            disabled={operationActive || reasonMissing}
            onClick={() => onLifecycle("activate", reason)}
          >
            Activate document type
          </CommandButton>
        ) : null}
        {documentType.status === "archived" ? (
          <CommandButton
            icon={ArchiveRestore}
            loading={busyAction === "restore"}
            disabled={operationActive || reasonMissing}
            onClick={() => onLifecycle("restore", reason)}
          >
            Restore document type
          </CommandButton>
        ) : (
          <ConfirmCommandButton
            icon={Archive}
            message={`Archive ${documentType.canonical_name}? It can be restored later.`}
            destructive
            loading={busyAction === "archive"}
            disabled={operationActive || reasonMissing}
            onConfirm={() => onLifecycle("archive", reason)}
          >
            Archive document type
          </ConfirmCommandButton>
        )}
      </div>
    </section>
  );
}

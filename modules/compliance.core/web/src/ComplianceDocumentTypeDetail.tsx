import { DetailItem, EmptyState, StatusPill } from "@uok/shared/data-display";
import { ComplianceDocumentTypeActions } from "./ComplianceDocumentTypeActions";
import type {
  ComplianceDocumentType,
  ComplianceDocumentTypeLifecycleAction,
  ComplianceDocumentTypeNameHistory,
} from "./types";

export function ComplianceDocumentTypeDetail({
  documentType,
  history,
  historyLoading,
  busyAction,
  canManage,
  onEdit,
  onLifecycle,
}: {
  documentType: ComplianceDocumentType | null;
  history: ComplianceDocumentTypeNameHistory[];
  historyLoading: boolean;
  busyAction: string;
  canManage: boolean;
  onEdit: () => void;
  onLifecycle: (action: ComplianceDocumentTypeLifecycleAction, reason: string) => void;
}) {
  if (!documentType) {
    return (
      <EmptyState
        title="No document type selected"
        text="Select a compliance document type to review its governed details and name history."
      />
    );
  }

  return (
    <article
      className="compliance-document-type-detail"
      aria-label={`${documentType.canonical_name} document type details`}
    >
      <header className="compliance-document-type-detail-header">
        <div>
          <p className="eyebrow">{documentType.code}</p>
          <h2>{documentType.canonical_name}</h2>
        </div>
        <StatusPill
          label={statusLabel(documentType.status)}
          tone={statusTone(documentType)}
        />
      </header>
      <p className="compliance-document-type-description">
        {documentType.description || "No operational description recorded."}
      </p>
      <div className="compliance-document-type-detail-grid">
        <DetailItem label="Category" value={documentType.category || "Uncategorized"} />
        <DetailItem label="Version" value={String(documentType.version)} />
        <DetailItem label="Last updated" value={formatTimestamp(documentType.updated_at)} />
        <DetailItem label="Updated by" value={documentType.updated_by_user_id} />
      </div>
      {canManage ? (
        <ComplianceDocumentTypeActions
          documentType={documentType}
          busyAction={busyAction}
          onEdit={onEdit}
          onLifecycle={onLifecycle}
        />
      ) : null}
      <section
        className="compliance-document-type-name-history"
        aria-label="Canonical name history"
      >
        <h3>Name history</h3>
        {historyLoading ? <p role="status">Loading name history.</p> : history.length ? (
          <ol>
            {history.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.previous_name} → {entry.new_name}</strong>
                <span>{entry.reason}</span>
                <small>
                  <time dateTime={entry.changed_at}>
                    {formatTimestamp(entry.changed_at)}
                  </time>
                  {" · "}{entry.changed_by_user_id}
                </small>
              </li>
            ))}
          </ol>
        ) : <EmptyState text="No canonical name changes have been recorded." />}
      </section>
    </article>
  );
}

function statusLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function statusTone(documentType: ComplianceDocumentType) {
  if (documentType.status === "active") return "success";
  if (documentType.status === "archived") return "danger";
  return "warning";
}

function formatTimestamp(value: string) {
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.valueOf()) ? value : timestamp.toLocaleString();
}

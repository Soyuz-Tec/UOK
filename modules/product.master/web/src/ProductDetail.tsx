import { Archive, ArchiveRestore } from "lucide-react";

import { ConfirmCommandButton, WorkspaceActionButton } from "@uok/shared/actions";
import { DetailItem, EmptyState, StatusPill } from "@uok/shared/data-display";
import { CommandButton } from "@uok/shared/primitives";
import type { ProductDefinition, ProductNameHistory } from "./types";

export function ProductDetail({
  product,
  history,
  historyLoading,
  busyAction,
  canManage,
  onEdit,
  onArchive,
  onRestore,
}: {
  product: ProductDefinition | null;
  history: ProductNameHistory[];
  historyLoading: boolean;
  busyAction: string;
  canManage: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  if (!product) return <EmptyState title="No product selected" text="Select a product definition to review its governed details and name history." />;
  const archived = product.status === "archived";
  const lifecycleBusy = busyAction === "archive" || busyAction === "restore";

  return (
    <article className="product-detail" aria-label={`${product.canonical_name} product details`}>
      <header className="product-detail-header">
        <div>
          <p className="eyebrow">{product.code}</p>
          <h2>{product.canonical_name}</h2>
        </div>
        <StatusPill label={product.status} tone={archived ? "warning" : "success"} />
      </header>
      <div className="product-detail-grid">
        <DetailItem label="Category" value={product.category || "Not set"} />
        <DetailItem label="Grade" value={product.grade || "Not set"} />
        <DetailItem label="Base unit" value={product.base_unit_code || "Not set"} />
        <DetailItem label="Version" value={String(product.version)} />
        <DetailItem label="Specification" value={product.specification || "Not set"} />
        <DetailItem label="Last updated" value={formatTimestamp(product.updated_at)} />
      </div>
      {canManage ? (
        <div className="product-detail-actions" aria-label="Product actions">
          <WorkspaceActionButton action="edit" disabled={archived || lifecycleBusy} onClick={onEdit}>Edit product</WorkspaceActionButton>
          {archived ? (
            <CommandButton icon={ArchiveRestore} loading={busyAction === "restore"} disabled={lifecycleBusy} onClick={onRestore}>Restore product</CommandButton>
          ) : (
            <ConfirmCommandButton
              icon={Archive}
              message={`Archive ${product.canonical_name}? The definition can be restored later.`}
              destructive
              loading={busyAction === "archive"}
              disabled={lifecycleBusy}
              onConfirm={onArchive}
            >
              Archive product
            </ConfirmCommandButton>
          )}
        </div>
      ) : null}
      <section className="product-name-history" aria-label="Canonical name history">
        <h3>Name history</h3>
        {historyLoading ? <p role="status">Loading name history.</p> : history.length ? (
          <ol>
            {history.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.previous_name} → {entry.new_name}</strong>
                <span>{entry.reason}</span>
                <small><time dateTime={entry.changed_at}>{formatTimestamp(entry.changed_at)}</time> · {entry.changed_by_user_id}</small>
              </li>
            ))}
          </ol>
        ) : <EmptyState text="No canonical name changes have been recorded." />}
      </section>
    </article>
  );
}

function formatTimestamp(value: string) {
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.valueOf()) ? value : timestamp.toLocaleString();
}

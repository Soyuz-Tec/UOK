import { useEffect, useRef, useState } from "react";

import { WorkspaceActionButton } from "@uok/shared/actions";
import { FieldMessage } from "@uok/shared/forms";
import type { ProductDefinition, ProductDraft } from "./types";
import { draftFromProduct, emptyProductDraft } from "./types";

export function ProductEditor({
  mode,
  product,
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  mode: "create" | "edit";
  product: ProductDefinition | null;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onSubmit: (draft: ProductDraft) => void;
}) {
  const [draft, setDraft] = useState<ProductDraft>(() => initialDraft(mode, product));
  const currentProduct = useRef(product);
  currentProduct.current = product;
  const validationId = "product-editor-validation";
  const valid = Boolean(draft.code.trim() && draft.canonicalName.trim());

  useEffect(() => {
    setDraft(initialDraft(mode, currentProduct.current));
  }, [mode, product?.id, product?.version]);

  return (
    <form
      className="product-editor-form"
      aria-label={mode === "create" ? "Create product definition" : "Edit product definition"}
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && !busy) onSubmit(draft);
      }}
    >
      <div className="product-editor-grid">
        <label className="field">
          <span>Product code</span>
          <input
            autoFocus={mode === "create"}
            value={draft.code}
            maxLength={80}
            required
            disabled={busy || mode === "edit"}
            aria-describedby={!draft.code.trim() ? validationId : undefined}
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
            disabled={busy}
            aria-describedby={!draft.canonicalName.trim() ? validationId : undefined}
            onChange={(event) => setDraft({ ...draft, canonicalName: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Category</span>
          <input value={draft.category} maxLength={120} disabled={busy} onChange={(event) => setDraft({ ...draft, category: event.target.value })} />
        </label>
        <label className="field">
          <span>Grade</span>
          <input value={draft.grade} maxLength={120} disabled={busy} onChange={(event) => setDraft({ ...draft, grade: event.target.value })} />
        </label>
        <label className="field product-editor-wide-field">
          <span>Specification</span>
          <textarea value={draft.specification} maxLength={2000} rows={4} disabled={busy} onChange={(event) => setDraft({ ...draft, specification: event.target.value })} />
        </label>
        <label className="field">
          <span>Base unit code</span>
          <input value={draft.baseUnitCode} maxLength={40} disabled={busy} onChange={(event) => setDraft({ ...draft, baseUnitCode: event.target.value })} />
        </label>
        {mode === "edit" ? (
          <label className="field">
            <span>Name-change reason</span>
            <input value={draft.reason} maxLength={500} disabled={busy} placeholder="Optional unless more context is needed" onChange={(event) => setDraft({ ...draft, reason: event.target.value })} />
          </label>
        ) : null}
      </div>
      {!valid ? <FieldMessage id={validationId}>Product code and canonical name are required.</FieldMessage> : null}
      {error ? <FieldMessage id="product-editor-error">{error}</FieldMessage> : null}
      <div className="product-editor-actions">
        <WorkspaceActionButton action="cancel" disabled={busy} onClick={onCancel} />
        <WorkspaceActionButton
          action={mode === "create" ? "create" : "save"}
          labelKey={mode === "create" ? "command.createProduct" : "command.saveProduct"}
          fallbackLabel={mode === "create" ? "Create product" : "Save product"}
          type="submit"
          primary
          loading={busy}
          disabled={!valid}
        />
      </div>
    </form>
  );
}

function initialDraft(mode: "create" | "edit", product: ProductDefinition | null) {
  return mode === "edit" && product ? draftFromProduct(product) : { ...emptyProductDraft };
}

import type { ShipmentDocumentInstanceMetadataDraft } from "./shipmentDocumentInstanceTypes";

export function ShipmentDocumentInstanceDateFields({
  draft,
  busy,
  onChange,
}: {
  draft: ShipmentDocumentInstanceMetadataDraft;
  busy: boolean;
  onChange: (draft: ShipmentDocumentInstanceMetadataDraft) => void;
}) {
  return (
    <div className="shipment-instance-date-fields">
      <label className="field">
        <span>Issued on (optional)</span>
        <input
          type="date"
          value={draft.issuedOn}
          disabled={busy}
          onChange={(event) => onChange({ ...draft, issuedOn: event.target.value })}
        />
      </label>
      <label className="field">
        <span>Expires on (optional)</span>
        <input
          type="date"
          value={draft.expiresOn}
          min={draft.issuedOn || undefined}
          disabled={busy}
          onChange={(event) => onChange({ ...draft, expiresOn: event.target.value })}
        />
      </label>
    </div>
  );
}

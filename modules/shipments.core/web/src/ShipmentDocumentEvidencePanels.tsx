import { useState } from "react";

import { ShipmentDocumentInstancesPanel } from "./ShipmentDocumentInstancesPanel";
import { ShipmentDocumentRequirementsPanel } from "./ShipmentDocumentRequirementsPanel";

export function ShipmentDocumentEvidencePanels({
  token,
  shipmentId,
  canManage,
  onUnauthorized,
  onStatus,
}: {
  token: string;
  shipmentId: string;
  canManage: boolean;
  onUnauthorized: () => void;
  onStatus: (message: string) => void;
}) {
  const [requirementRevision, setRequirementRevision] = useState(0);
  const [instanceRevision, setInstanceRevision] = useState(0);
  return (
    <div className="shipment-document-evidence">
      <ShipmentDocumentRequirementsPanel
        key={`requirements:${requirementRevision}`}
        token={token}
        shipmentId={shipmentId}
        canManage={canManage}
        onUnauthorized={onUnauthorized}
        onStatus={onStatus}
        onChanged={() => setInstanceRevision((current) => current + 1)}
      />
      <ShipmentDocumentInstancesPanel
        key={`instances:${instanceRevision}`}
        token={token}
        shipmentId={shipmentId}
        canManage={canManage}
        onUnauthorized={onUnauthorized}
        onStatus={onStatus}
        onRequirementChanged={() => setRequirementRevision((current) => current + 1)}
      />
    </div>
  );
}

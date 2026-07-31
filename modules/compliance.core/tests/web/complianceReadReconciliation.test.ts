import { describe, expect, it } from "vitest";

import {
  reconcileComplianceNameHistory,
} from "../../web/src/complianceReadReconciliation";
import type {
  ComplianceDocumentTypeNameHistory,
} from "../../web/src/types";

function history(
  id: string,
  ownerId: string,
  changedAt: string,
): ComplianceDocumentTypeNameHistory {
  return {
    id,
    compliance_document_type_id: ownerId,
    previous_name: "Previous",
    new_name: "Current",
    reason: "Regression proof",
    changed_by_user_id: "user-1",
    changed_at: changedAt,
  };
}

describe("Compliance read reconciliation", () => {
  it("does not carry one document type's history into a newly selected owner", () => {
    const prior = history("history-a", "document-a", "2026-07-29T00:00:00Z");
    const incoming = history("history-b", "document-b", "2026-07-30T00:00:00Z");

    expect(reconcileComplianceNameHistory(
      "document-a",
      [prior],
      "document-b",
      [incoming],
    )).toEqual([incoming]);
  });

  it("retains monotonic history entries while reconciling the same owner", () => {
    const prior = history("history-a", "document-a", "2026-07-29T00:00:00Z");
    const incoming = history("history-b", "document-a", "2026-07-30T00:00:00Z");

    expect(reconcileComplianceNameHistory(
      "document-a",
      [prior],
      "document-a",
      [incoming],
    )).toEqual([incoming, prior]);
  });
});

import type { ComplianceReadRequest } from "./complianceApi";
import {
  loadComplianceDocumentType,
  loadComplianceDocumentTypeNameHistory,
  loadComplianceDocumentTypes,
} from "./complianceApi";
import { selectComplianceDocumentTypeId } from "./complianceReadAuthority";
import type {
  ComplianceDocumentType,
  ComplianceDocumentTypeNameHistory,
} from "./types";

export type ComplianceReconciliationSnapshot = {
  rows: ComplianceDocumentType[];
  selectedId: string;
  detail: ComplianceDocumentType | null;
  history: ComplianceDocumentTypeNameHistory[];
};

export async function loadComplianceReconciliationSnapshot({
  token,
  request,
  isCurrent,
  currentSelectedId,
  preferredSelectedId,
}: {
  token: string;
  request: ComplianceReadRequest;
  isCurrent: () => boolean;
  currentSelectedId: string;
  preferredSelectedId?: string;
}): Promise<ComplianceReconciliationSnapshot | null> {
  const rows = await loadComplianceDocumentTypes(token, request);
  if (!isCurrent()) return null;

  const preferred = preferredSelectedId
    && rows.some((row) => row.id === preferredSelectedId)
    ? preferredSelectedId
    : "";
  const selectedId = preferred
    || selectComplianceDocumentTypeId(rows, currentSelectedId);
  if (!selectedId) {
    return { rows, selectedId: "", detail: null, history: [] };
  }

  const [detail, history] = await Promise.all([
    loadComplianceDocumentType(token, selectedId, request),
    loadComplianceDocumentTypeNameHistory(token, selectedId, request),
  ]);
  if (!isCurrent()) return null;
  return { rows, selectedId, detail, history };
}

export function mergeComplianceDocumentTypes(
  current: ComplianceDocumentType[],
  incoming: ComplianceDocumentType[],
) {
  const currentById = new Map(current.map((row) => [row.id, row]));
  return incoming.map((row) => {
    const prior = currentById.get(row.id);
    return prior && prior.version > row.version ? prior : row;
  });
}

export function newerComplianceDocumentType(
  current: ComplianceDocumentType | null,
  incoming: ComplianceDocumentType | null,
) {
  if (!current || !incoming || current.id !== incoming.id) return incoming;
  return current.version > incoming.version ? current : incoming;
}

export function mergeComplianceNameHistory(
  current: ComplianceDocumentTypeNameHistory[],
  incoming: ComplianceDocumentTypeNameHistory[],
) {
  const rows = new Map(current.map((row) => [row.id, row]));
  for (const row of incoming) rows.set(row.id, row);
  return Array.from(rows.values()).sort(
    (left, right) => right.changed_at.localeCompare(left.changed_at),
  );
}

export function reconcileComplianceNameHistory(
  currentOwnerId: string,
  current: ComplianceDocumentTypeNameHistory[],
  incomingOwnerId: string,
  incoming: ComplianceDocumentTypeNameHistory[],
) {
  return currentOwnerId === incomingOwnerId
    ? mergeComplianceNameHistory(current, incoming)
    : incoming;
}

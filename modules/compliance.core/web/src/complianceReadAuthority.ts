import type { RequestAuthority } from "@uok/shared/request-authority";
import type { ComplianceDocumentType } from "./types";

export const complianceReadyStatus = "Compliance Document Types ready.";

export type ComplianceReadBoundary = {
  token: string;
  generation: number;
  role: string;
  operational: boolean;
  surfaceActive: boolean;
};

export function complianceReadBoundary(
  token: string,
  generation: number,
  role: string,
  operational: boolean,
  surfaceActive: boolean,
): ComplianceReadBoundary {
  return {
    token,
    generation,
    role,
    operational,
    surfaceActive,
  };
}

export function sameComplianceReadBoundary(
  left: ComplianceReadBoundary,
  right: ComplianceReadBoundary,
) {
  return left.token === right.token
    && left.generation === right.generation
    && left.role === right.role
    && left.operational === right.operational
    && left.surfaceActive === right.surfaceActive;
}

export function complianceReadsEnabled(boundary: ComplianceReadBoundary) {
  return Boolean(boundary.token && boundary.operational && boundary.surfaceActive);
}

export function beginComplianceRead(
  authority: RequestAuthority,
  boundaryRef: { current: ComplianceReadBoundary },
  onUnauthorized: { current: () => void },
  onInvalidated: () => void,
  lane: string,
) {
  const capturedBoundary = boundaryRef.current;
  const ticket = authority.begin(lane);
  const isCurrent = () => (
    ticket.isCurrent()
    && capturedBoundary.surfaceActive
    && capturedBoundary.operational
    && Boolean(capturedBoundary.token)
    && sameComplianceReadBoundary(boundaryRef.current, capturedBoundary)
  );
  const unauthorized = ticket.onceIfCurrent(() => {
    if (!isCurrent()) return;
    authority.invalidate();
    onInvalidated();
    onUnauthorized.current();
  });
  return {
    ticket,
    isCurrent,
    request: {
      signal: ticket.signal,
      onUnauthorized: () => isCurrent() ? unauthorized() : undefined,
    },
  };
}

export function complianceDetailCriteria(selectedId: string, version?: number) {
  return `${selectedId}\u0000${version ?? ""}`;
}

export function advanceComplianceDetailCriteria(
  authority: RequestAuthority,
  criteriaRef: { current: { value: string; generation: number } },
  value: string,
) {
  if (criteriaRef.current.value === value) return criteriaRef.current.generation;
  supersedeComplianceReadLane(authority, "detail");
  const generation = criteriaRef.current.generation + 1;
  criteriaRef.current = { value, generation };
  return generation;
}

export function selectComplianceDocumentTypeId(
  rows: ComplianceDocumentType[],
  current: string,
) {
  return rows.some((row) => row.id === current)
    ? current
    : rows.find((row) => row.status === "active")?.id
      || rows.find((row) => row.status === "inactive")?.id
      || rows[0]?.id
      || "";
}

export function supersedeComplianceReadLane(
  authority: RequestAuthority,
  lane: string,
) {
  authority.begin(lane).release();
}

export function complianceReadErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Compliance Document Types request failed.";
}

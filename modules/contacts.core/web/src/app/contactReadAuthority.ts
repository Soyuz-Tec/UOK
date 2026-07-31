import type { RequestAuthority } from "@uok/shared/request-authority";

import type { ContactFilters, ContactRecord } from "../contracts";
import type { ContactGroupRecord } from "../contracts";

export type ContactReadBoundary = {
  token: string;
  generation: number;
  role: string;
  operational: boolean;
  surfaceActive: boolean;
};

type CriteriaRef = {
  current: {
    value: string;
    generation: number;
  };
};

export type ContactListCommit = {
  epoch: number;
  criteriaGeneration: number;
  rows: ContactRecord[];
  totalCount: number;
  hasNext: boolean;
};

export type ContactGroupsCommit = {
  epoch: number;
  rows: ContactGroupRecord[];
};

export type ContactDetailCommit = {
  epoch: number;
  criteriaGeneration: number;
  ownerId: string;
  ownerUpdatedAt: string;
  row: ContactRecord | null;
};

export type ContactLoadingCommit = {
  epoch: number;
  criteriaGeneration: number;
  value: boolean;
};

export type ContactReadLane = "list" | "groups" | "detail";

export type ContactReadOutcome = {
  origin: "read";
  epoch: number;
  lane: ContactReadLane;
  criteriaGeneration: number;
  value: unknown;
};

export type ContactCommandOutcome = {
  origin: "command";
  value: unknown;
};

export function emptyContactListCommit(epoch: number): ContactListCommit {
  return { epoch, criteriaGeneration: 0, rows: [], totalCount: 0, hasNext: false };
}

export function emptyContactGroupsCommit(epoch: number): ContactGroupsCommit {
  return { epoch, rows: [] };
}

export function emptyContactDetailCommit(epoch: number): ContactDetailCommit {
  return {
    epoch,
    criteriaGeneration: 0,
    ownerId: "",
    ownerUpdatedAt: "",
    row: null,
  };
}

export function emptyContactLoadingCommit(epoch: number): ContactLoadingCommit {
  return { epoch, criteriaGeneration: 0, value: false };
}

export function contactReadOutcomeCurrent(
  authority: RequestAuthority,
  outcome: ContactReadOutcome,
  listCriteriaGeneration: number,
  detailCriteriaGeneration: number,
) {
  return authority.isCurrentEpoch(outcome.epoch)
    && (outcome.lane === "groups"
      || outcome.criteriaGeneration === (outcome.lane === "list"
        ? listCriteriaGeneration
        : detailCriteriaGeneration));
}

export function contactReadBoundary(
  token: string,
  generation: number,
  role: string,
  operational: boolean,
  surfaceActive: boolean,
): ContactReadBoundary {
  return {
    token,
    generation,
    role,
    operational,
    surfaceActive,
  };
}

export function sameContactReadBoundary(
  left: ContactReadBoundary,
  right: ContactReadBoundary,
) {
  return left.token === right.token
    && left.generation === right.generation
    && left.role === right.role
    && left.operational === right.operational
    && left.surfaceActive === right.surfaceActive;
}

export function contactReadsEnabled(boundary: ContactReadBoundary) {
  return Boolean(boundary.token && boundary.operational && boundary.surfaceActive);
}

export function beginContactRead(
  authority: RequestAuthority,
  boundaryRef: { current: ContactReadBoundary },
  onUnauthorized: { current: () => void },
  onInvalidated: () => void,
  lane: string,
) {
  const capturedBoundary = boundaryRef.current;
  const ticket = authority.begin(lane);
  const isCurrent = () => (
    ticket.isCurrent()
    && contactReadsEnabled(capturedBoundary)
    && sameContactReadBoundary(boundaryRef.current, capturedBoundary)
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

export function contactListCriteria(filters: ContactFilters) {
  return JSON.stringify([
    filters.query,
    filters.contactGroupId,
    filters.statusFilter,
    filters.reviewFilter,
    filters.typeFilter,
    filters.sourceFilter,
    filters.qualityFilter,
    filters.contactPage,
    filters.contactPageSize,
    filters.contactSortBy,
    filters.contactSortDir,
  ]);
}

export function advanceContactListCriteria(
  authority: RequestAuthority,
  criteriaRef: CriteriaRef,
  value: string,
) {
  return advanceContactReadCriteria(
    authority,
    criteriaRef,
    value,
    ["list", "detail"],
  );
}

export function contactDetailCriteria(
  selectedId: string,
  updatedAt?: string | null,
) {
  return `${selectedId}\u0000${updatedAt ?? ""}`;
}

export function advanceContactDetailCriteria(
  authority: RequestAuthority,
  criteriaRef: CriteriaRef,
  value: string,
) {
  return advanceContactReadCriteria(authority, criteriaRef, value, ["detail"]);
}

export function selectContactId(
  rows: ContactRecord[],
  current: string,
) {
  return rows.some((row) => row.id === current)
    ? current
    : rows[0]?.id || "";
}

function advanceContactReadCriteria(
  authority: RequestAuthority,
  criteriaRef: CriteriaRef,
  value: string,
  lanes: readonly string[],
) {
  if (criteriaRef.current.value === value) {
    return criteriaRef.current.generation;
  }
  supersedeContactReadLanes(authority, lanes);
  const generation = criteriaRef.current.generation + 1;
  criteriaRef.current = { value, generation };
  return generation;
}

export function supersedeContactReadLane(
  authority: RequestAuthority,
  lane: string,
) {
  authority.begin(lane).release();
}

export function supersedeContactReadLanes(
  authority: RequestAuthority,
  lanes: readonly string[],
) {
  for (const lane of lanes) supersedeContactReadLane(authority, lane);
}

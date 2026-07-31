import type { RequestAuthority } from "@uok/shared/request-authority";

import {
  contactReadsEnabled,
  sameContactReadBoundary,
  type ContactListCommit,
  type ContactReadBoundary,
  type ContactReadLane,
  type ContactReadOutcome,
} from "./contactReadAuthority";

type CriteriaState = {
  value: string;
  generation: number;
};

export function contactRefreshCallbackCurrent(
  authority: RequestAuthority,
  boundaryRef: { current: ContactReadBoundary },
  capturedBoundary: ContactReadBoundary,
  capturedEpoch: number,
  criteria: CriteriaState,
  capturedCriteriaValue: string,
  capturedCriteriaGeneration: number,
) {
  return authority.isCurrentEpoch(capturedEpoch)
    && sameContactReadBoundary(boundaryRef.current, capturedBoundary)
    && criteria.generation === capturedCriteriaGeneration
    && criteria.value === capturedCriteriaValue;
}

export function contactDetailLoadCurrent(
  authority: RequestAuthority,
  boundary: ContactReadBoundary,
  list: ContactListCommit,
  selection: { epoch: number; id: string },
  listCriteriaGeneration: number,
  partyId: string,
) {
  return contactReadsEnabled(boundary)
    && Boolean(partyId)
    && authority.isCurrentEpoch(selection.epoch)
    && selection.id === partyId
    && authority.isCurrentEpoch(list.epoch)
    && list.criteriaGeneration === listCriteriaGeneration;
}

export function clearMatchingContactReadOutcome(
  current: ContactReadOutcome | null,
  lane: ContactReadLane,
  epoch: number,
  criteriaGeneration: number,
) {
  return current?.lane === lane
    && current.epoch === epoch
    && (lane === "groups" || current.criteriaGeneration === criteriaGeneration)
    ? null
    : current;
}

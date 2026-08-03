import { useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  contactReadsEnabled,
  sameContactReadBoundary,
  type ContactReadBoundary,
} from "./app/contactReadAuthority";
import {
  advanceContactSecondaryReadCriteria,
  contactSecondaryCommitCurrent,
  contactSecondaryReadCriteria,
} from "./app/contactSecondaryReadAuthority";
import { useContactSecondaryReadAuthority } from "./app/useContactSecondaryReadAuthority";
import {
  getContactRelationshipOptions,
  type ContactRelationshipOption,
} from "./contactRelationshipOptionsApi";

const relationshipOptionsLane = "secondary:relationship-options";

type RelationshipOptionsCommit = {
  epoch: number;
  criteriaGeneration: number;
  error: string;
  loading: boolean;
  options: ContactRelationshipOption[];
};

export function useContactRelationshipOptions({
  boundary,
  onUnauthorized,
  canManage,
  query,
  excludePartyId,
}: {
  boundary: ContactReadBoundary;
  onUnauthorized: () => void;
  canManage: boolean;
  query: string;
  excludePartyId: string;
}) {
  const { authority, beginRead, boundaryCurrent, boundaryRef } =
    useContactSecondaryReadAuthority(boundary, onUnauthorized);
  const normalizedQuery = query.trim();
  const criteriaValue = contactSecondaryReadCriteria([
    canManage,
    normalizedQuery,
    excludePartyId,
  ]);
  const criteriaRef = useRef({ value: criteriaValue, generation: 0 });
  const [, renderInvalidation] = useState(0);
  const [commit, setCommit] = useState<RelationshipOptionsCommit>(() => ({
    epoch: authority.epoch,
    criteriaGeneration: 0,
    error: "",
    loading: false,
    options: [],
  }));

  useLayoutEffect(() => {
    if (criteriaRef.current.value === criteriaValue) return;
    advanceContactSecondaryReadCriteria(
      authority,
      criteriaRef,
      criteriaValue,
      relationshipOptionsLane,
    );
    renderInvalidation((current) => current + 1);
  }, [authority, criteriaValue]);

  useEffect(() => {
    const currentBoundary = boundaryRef.current;
    if (!canManage
      || !contactReadsEnabled(currentBoundary)
      || !excludePartyId
      || normalizedQuery.length < 2
      || criteriaRef.current.value !== criteriaValue) return;
    const criteriaGeneration = criteriaRef.current.generation;
    setCommit({
      epoch: authority.epoch,
      criteriaGeneration,
      error: "",
      loading: true,
      options: [],
    });
    const timer = window.setTimeout(() => {
      if (!sameContactReadBoundary(boundaryRef.current, currentBoundary)
        || criteriaRef.current.value !== criteriaValue
        || criteriaRef.current.generation !== criteriaGeneration) return;
      const request = beginRead(relationshipOptionsLane);
      const isCurrent = () => request.isCurrent()
        && contactSecondaryCommitCurrent(
          authority,
          request.ticket.epoch,
          criteriaRef,
          criteriaValue,
          criteriaGeneration,
        );
      void getContactRelationshipOptions(
        currentBoundary.token,
        normalizedQuery,
        excludePartyId,
        request.request,
      ).then((options) => {
        if (!isCurrent()) return;
        setCommit({
          epoch: request.ticket.epoch,
          criteriaGeneration,
          error: "",
          loading: true,
          options,
        });
      }).catch((cause) => {
        if (!isCurrent()) return;
        setCommit({
          epoch: request.ticket.epoch,
          criteriaGeneration,
          error: cause instanceof Error
            ? cause.message
            : "Unable to search contacts.",
          loading: true,
          options: [],
        });
      }).finally(() => {
        if (isCurrent()) {
          setCommit((current) => current.epoch === request.ticket.epoch
            && current.criteriaGeneration === criteriaGeneration
            ? { ...current, loading: false }
            : current);
        }
        request.ticket.release();
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    authority,
    beginRead,
    boundary.generation,
    boundary.operational,
    boundary.role,
    boundary.surfaceActive,
    boundary.token,
    boundaryRef,
    canManage,
    criteriaValue,
    excludePartyId,
    normalizedQuery,
  ]);

  const commitCurrent = boundaryCurrent
    && canManage
    && contactReadsEnabled(boundary)
    && contactSecondaryCommitCurrent(
      authority,
      commit.epoch,
      criteriaRef,
      criteriaValue,
      commit.criteriaGeneration,
    );
  return {
    error: commitCurrent ? commit.error : "",
    loading: commitCurrent ? commit.loading : false,
    options: commitCurrent ? commit.options : [],
  };
}

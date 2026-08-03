import { useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  contactReadsEnabled,
  type ContactReadBoundary,
} from "./app/contactReadAuthority";
import {
  advanceContactSecondaryReadCriteria,
  contactSecondaryCommitCurrent,
  contactSecondaryReadCriteria,
} from "./app/contactSecondaryReadAuthority";
import { useContactSecondaryReadAuthority } from "./app/useContactSecondaryReadAuthority";
import { getContactActivity, type ContactActivityRecord } from "./contactActivityApi";

const activityLane = "secondary:activity";

type ActivityCommit = {
  epoch: number;
  criteriaGeneration: number;
  error: string;
  items: ContactActivityRecord[];
  loading: boolean;
  totalCount: number;
};

export function useContactActivity({
  boundary,
  onUnauthorized,
  partyId,
  contactRevision,
  page,
  pageSize,
  refreshGeneration,
}: {
  boundary: ContactReadBoundary;
  onUnauthorized: () => void;
  partyId: string;
  contactRevision: string;
  page: number;
  pageSize: number;
  refreshGeneration?: string | number;
}) {
  const { authority, beginRead, boundaryCurrent, boundaryRef } =
    useContactSecondaryReadAuthority(boundary, onUnauthorized);
  const [retryGeneration, setRetryGeneration] = useState(0);
  const criteriaValue = contactSecondaryReadCriteria([
    partyId,
    contactRevision,
    page,
    pageSize,
    refreshGeneration,
    retryGeneration,
  ]);
  const criteriaRef = useRef({ value: criteriaValue, generation: 0 });
  const [, renderInvalidation] = useState(0);
  const [commit, setCommit] = useState<ActivityCommit>(() => ({
    epoch: authority.epoch,
    criteriaGeneration: 0,
    error: "",
    items: [],
    loading: false,
    totalCount: 0,
  }));

  useLayoutEffect(() => {
    if (criteriaRef.current.value === criteriaValue) return;
    advanceContactSecondaryReadCriteria(
      authority,
      criteriaRef,
      criteriaValue,
      activityLane,
    );
    renderInvalidation((current) => current + 1);
  }, [authority, criteriaValue]);

  useEffect(() => {
    const currentBoundary = boundaryRef.current;
    if (!contactReadsEnabled(currentBoundary) || !partyId) return;
    if (criteriaRef.current.value !== criteriaValue) return;
    const criteriaGeneration = criteriaRef.current.generation;
    const request = beginRead(activityLane);
    const isCurrent = () => request.isCurrent()
      && contactSecondaryCommitCurrent(
        authority,
        request.ticket.epoch,
        criteriaRef,
        criteriaValue,
        criteriaGeneration,
      );
    setCommit({
      epoch: request.ticket.epoch,
      criteriaGeneration,
      error: "",
      items: [],
      loading: true,
      totalCount: 0,
    });
    void getContactActivity(
      currentBoundary.token,
      partyId,
      pageSize,
      page * pageSize,
      request.request,
    ).then((result) => {
      if (!isCurrent()) return;
      setCommit({
        epoch: request.ticket.epoch,
        criteriaGeneration,
        error: "",
        items: result.items,
        loading: true,
        totalCount: result.totalCount,
      });
    }).catch((cause) => {
      if (!isCurrent()) return;
      setCommit({
        epoch: request.ticket.epoch,
        criteriaGeneration,
        error: cause instanceof Error
          ? cause.message
          : "Unable to load contact activity.",
        items: [],
        loading: true,
        totalCount: 0,
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
    return () => request.ticket.release();
  }, [
    authority,
    beginRead,
    boundary.generation,
    boundary.operational,
    boundary.role,
    boundary.surfaceActive,
    boundary.token,
    boundaryRef,
    criteriaValue,
    page,
    pageSize,
    partyId,
  ]);

  const commitCurrent = boundaryCurrent
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
    items: commitCurrent ? commit.items : [],
    loading: commitCurrent ? commit.loading : false,
    retry: () => setRetryGeneration((current) => current + 1),
    totalCount: commitCurrent ? commit.totalCount : 0,
  };
}

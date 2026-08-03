import type { RequestAuthority } from "@uok/shared/request-authority";

export type ContactSecondaryReadCriteriaRef = {
  current: {
    value: string;
    generation: number;
  };
};

export function contactSecondaryReadCriteria(
  values: readonly (boolean | number | string | undefined)[],
) {
  return JSON.stringify(values);
}

export function advanceContactSecondaryReadCriteria(
  authority: RequestAuthority,
  criteriaRef: ContactSecondaryReadCriteriaRef,
  value: string,
  lane: string,
) {
  if (criteriaRef.current.value === value) {
    return criteriaRef.current.generation;
  }
  authority.begin(lane).release();
  const generation = criteriaRef.current.generation + 1;
  criteriaRef.current = { value, generation };
  return generation;
}

export function contactSecondaryCommitCurrent(
  authority: RequestAuthority,
  epoch: number,
  criteriaRef: ContactSecondaryReadCriteriaRef,
  criteriaValue: string,
  criteriaGeneration: number,
) {
  return authority.isCurrentEpoch(epoch)
    && criteriaRef.current.value === criteriaValue
    && criteriaRef.current.generation === criteriaGeneration;
}

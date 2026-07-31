import { useCallback, useState } from "react";

import type { RequestAuthority } from "@uok/shared/request-authority";

import {
  type ContactReadLane,
  type ContactReadOutcome,
} from "./contactReadAuthority";
import { clearMatchingContactReadOutcome } from "./contactReadGuards";

export function useContactReadOutcome(authority: RequestAuthority) {
  const [outcome, setOutcome] = useState<ContactReadOutcome | null>(null);
  const setReadOutcome = useCallback((
    lane: ContactReadLane,
    criteriaGeneration: number,
    value: unknown,
  ) => setOutcome({
    origin: "read",
    epoch: authority.epoch,
    lane,
    criteriaGeneration,
    value,
  }), [authority]);
  const clearReadOutcome = useCallback((
    lane: ContactReadLane,
    epoch: number,
    criteriaGeneration: number,
  ) => setOutcome((current) => clearMatchingContactReadOutcome(
    current,
    lane,
    epoch,
    criteriaGeneration,
  )), []);
  return {
    clearReadOutcome,
    outcome,
    setReadOutcome,
  };
}

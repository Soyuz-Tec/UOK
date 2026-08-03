import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { ModuleSurfaceRenderContext } from "@uok/contracts/moduleSurface";
import { createRequestAuthority } from "@uok/shared/request-authority";

import { isContactCommandApiError } from "./contactCommandApi";
import {
  beginContactMutationEffect,
  contactMutationBoundary,
  contactMutationDispatchSnapshot,
  contactMutationIdempotencyKey,
  isContactMutationDispatchCurrent,
  sameContactMutationBoundary,
  sameContactMutationInteraction,
  type ContactMutationInteraction,
} from "./contactMutationAuthority";
import {
  contactCommandBusyAction,
  redactStaleContactCommandOutcome,
  retainedContactCommandError,
  type ContactCommandOperation,
  type ContactCommandRunInput,
} from "./contactCommandCoordinatorTypes";
import type {
  ContactPrimaryReconciliationRequest,
  ContactPrimaryReconciliationResult,
} from "./useContactPrimaryReconciliation";
import {
  acquireContactCommandOperationGate,
  releaseContactCommandOperationGate,
  type ContactCommandOperationGate,
} from "./contactCommandOperationGate";

export function useContactCommandCoordinator({
  host,
  operational,
  interaction,
  operationGate,
  reconcilePrimaryContacts,
  supersedeReadsForMutation,
}: {
  host: ModuleSurfaceRenderContext;
  operational: boolean;
  interaction: ContactMutationInteraction;
  operationGate: ContactCommandOperationGate;
  reconcilePrimaryContacts: (
    request?: ContactPrimaryReconciliationRequest,
  ) => Promise<ContactPrimaryReconciliationResult>;
  supersedeReadsForMutation: () => void;
}) {
  const [authority] = useState(createRequestAuthority);
  const boundary = useMemo(
    () => contactMutationBoundary(host, operational),
    [host, operational],
  );
  const boundaryRef = useRef(boundary);
  const interactionRef = useRef(interaction);
  const previousBoundary = useRef(boundary);
  const previousInteraction = useRef(interaction);
  const onUnauthorizedRef = useRef(host.session.onUnauthorized);
  const refreshHostRef = useRef(host.refreshHost);
  const reconcileRef = useRef(reconcilePrimaryContacts);
  const supersedeReadsRef = useRef(supersedeReadsForMutation);
  const operationRef = useRef<ContactCommandOperation | null>(null);
  const operationSequence = useRef(0);
  const mounted = useRef(true);
  const [phase, setPhase] = useState<
    "idle" | "preflight" | "command" | "pending" | "reconciling"
  >("idle");
  const [retryRevision, setRetryRevision] = useState(0);
  boundaryRef.current = boundary;
  interactionRef.current = interaction;
  onUnauthorizedRef.current = host.session.onUnauthorized;
  refreshHostRef.current = host.refreshHost;
  reconcileRef.current = reconcilePrimaryContacts;
  supersedeReadsRef.current = supersedeReadsForMutation;

  useLayoutEffect(() => {
    if (sameContactMutationBoundary(previousBoundary.current, boundary)
      && sameContactMutationInteraction(previousInteraction.current, interaction)) return;
    previousBoundary.current = boundary;
    previousInteraction.current = { ...interaction };
    redactStaleContactCommandOutcome(operationRef.current);
    authority.invalidate();
  }, [authority, boundary, interaction]);

  const completeOperation = useCallback((operation: ContactCommandOperation) => {
    if (operationRef.current?.id !== operation.id) return;
    operation.effect?.release();
    releaseContactCommandOperationGate(operationGate, operation.gateOwner);
    operationRef.current = null;
    if (mounted.current) setPhase("idle");
  }, [operationGate]);

  const effectCurrent = useCallback((operation: ContactCommandOperation) => (
    Boolean(operation.effect?.isCurrent()) && operation.intentIsCurrent()
  ), []);

  const attemptReconciliation = useCallback(async (
    operation: ContactCommandOperation,
  ) => {
    if (!mounted.current
      || operationRef.current?.id !== operation.id
      || !operation.outcome
      || operation.reconciling) return false;
    operation.reconciling = true;
    setPhase("reconciling");
    const result = await reconcileRef.current({
      preferredSelectedId: operation.outcome.kind === "success"
        ? operation.outcome.preferredSelectedId
        : undefined,
      preferenceIsCurrent: () => effectCurrent(operation),
    });
    operation.reconciling = false;
    if (!mounted.current || operationRef.current?.id !== operation.id) return false;
    if (result.kind === "applied") {
      const current = result.preferenceCurrent;
      if (current) {
        void refreshHostRef.current().catch(() => undefined);
        if (operation.outcome.kind === "success") operation.onSuccess();
        else operation.onError(operation.outcome.error);
      }
      completeOperation(operation);
      return current && operation.outcome.kind === "success";
    }
    setPhase("pending");
    if (result.kind === "failed" && effectCurrent(operation)) {
      operation.onPending(retainedContactCommandError(result.error));
    } else if (result.kind === "superseded") {
      setRetryRevision((current) => current + 1);
    }
    return false;
  }, [completeOperation, effectCurrent]);

  const runOperation = useCallback(async (input: ContactCommandRunInput) => {
    if (operationRef.current) return false;
    const gateOwner = acquireContactCommandOperationGate(operationGate);
    if (!gateOwner) return false;
    const epoch = authority.epoch;
    const captured = contactMutationDispatchSnapshot(
      boundaryRef.current,
      interactionRef.current,
      input.capability,
    );
    const operation: ContactCommandOperation = {
      action: input.action,
      capability: input.capability,
      intentIsCurrent: input.intentIsCurrent,
      onAccepted: input.onAccepted,
      onError: input.onError,
      onPending: input.onPending,
      onSuccess: input.onSuccess,
      id: ++operationSequence.current,
      gateOwner,
      effect: null,
      outcome: null,
      reconciling: false,
    };
    operationRef.current = operation;
    setPhase("preflight");
    await Promise.resolve();
    if (!authority.isCurrentEpoch(epoch)
      || !isContactMutationDispatchCurrent(
        captured,
        boundaryRef.current,
        interactionRef.current,
      )
      || !input.intentIsCurrent()
      || !mounted.current) {
      completeOperation(operation);
      return false;
    }
    operation.effect = beginContactMutationEffect(
      authority,
      boundaryRef,
      interactionRef,
      onUnauthorizedRef,
      input.capability,
    );
    setPhase("command");
    if (effectCurrent(operation)) input.onAccepted?.();
    supersedeReadsRef.current();
    const dispatch = input.execute;
    const preferredSelectedId = input.preferredSelectedId;
    try {
      const responsePromise = dispatch({
        token: captured.boundary.token,
        idempotencyKey: contactMutationIdempotencyKey(input.action),
        onUnauthorized: () => {
          if (effectCurrent(operation)) operation.effect?.request.onUnauthorized();
        },
      });
      const response = await responsePromise;
      operation.outcome = {
        kind: "success",
        preferredSelectedId: effectCurrent(operation)
          ? preferredSelectedId(response)
          : undefined,
      };
    } catch (error) {
      if (isContactCommandApiError(error) && error.status === 401) {
        completeOperation(operation);
        return false;
      }
      operation.outcome = {
        kind: "error",
        error: effectCurrent(operation)
          ? retainedContactCommandError(error)
          : new Error("A stale Contacts command outcome requires reconciliation."),
      };
    }
    if (!mounted.current) {
      completeOperation(operation);
      return false;
    }
    setPhase("pending");
    return attemptReconciliation(operation);
  }, [
    attemptReconciliation,
    authority,
    completeOperation,
    effectCurrent,
    operationGate,
  ]);

  const retryPendingReconciliation = useCallback(async () => {
    const operation = operationRef.current;
    if (!operation?.outcome) return false;
    return attemptReconciliation(operation);
  }, [attemptReconciliation]);

  useEffect(() => {
    const operation = operationRef.current;
    if (operation?.outcome) void attemptReconciliation(operation);
  }, [
    attemptReconciliation,
    boundary.generation,
    boundary.operational,
    boundary.role,
    boundary.surfaceActive,
    boundary.token,
    host.moduleRefreshRevision,
    retryRevision,
  ]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      authority.dispose();
      const operation = operationRef.current;
      operation?.effect?.release();
      if (operation) {
        releaseContactCommandOperationGate(operationGate, operation.gateOwner);
      }
    };
  }, [authority, operationGate]);

  const operation = operationRef.current;
  return {
    busyAction: phase === "preflight" ? "" : contactCommandBusyAction(
      operation,
      operation ? effectCurrent(operation) : false,
    ),
    operationActive: phase !== "idle",
    reconciliationPending: phase === "pending",
    retryPendingReconciliation,
    runOperation,
  };
}

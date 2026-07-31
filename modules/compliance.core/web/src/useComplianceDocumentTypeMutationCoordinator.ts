import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { createRequestAuthority } from "@uok/shared/request-authority";
import {
  beginComplianceMutationEffect,
  complianceMutationBoundary,
  complianceMutationDispatchSnapshot,
  complianceMutationIdempotencyKey,
  isComplianceMutationDispatchCurrent,
  sameComplianceMutationBoundary,
  sameComplianceMutationInteraction,
} from "./complianceMutationAuthority";
import type {
  ComplianceMutationCoordinatorOptions,
  ComplianceMutationOperation,
  ComplianceMutationRunInput,
} from "./complianceMutationOperation";
import { isComplianceApiError } from "./complianceApi";

export function useComplianceDocumentTypeMutationCoordinator({
  host,
  operational,
  canManage,
  interactionRef,
  reconcileDocumentTypes,
  supersedeReadsForMutation,
}: ComplianceMutationCoordinatorOptions) {
  const [authority] = useState(createRequestAuthority);
  const boundary = useMemo(
    () => complianceMutationBoundary(host, operational, canManage),
    [canManage, host, operational],
  );
  const boundaryRef = useRef(boundary);
  const previousBoundary = useRef(boundary);
  const previousInteraction = useRef(interactionRef.current);
  const onUnauthorizedRef = useRef(host.session.onUnauthorized);
  const refreshHostRef = useRef(host.refreshHost);
  const reconcileRef = useRef(reconcileDocumentTypes);
  const supersedeReadsRef = useRef(supersedeReadsForMutation);
  const operationRef = useRef<ComplianceMutationOperation | null>(null);
  const operationSequence = useRef(0);
  const mounted = useRef(true);
  const [phase, setPhase] = useState<"idle" | "command" | "pending" | "reconciling">("idle");
  const [retryRevision, setRetryRevision] = useState(0);
  boundaryRef.current = boundary;
  onUnauthorizedRef.current = host.session.onUnauthorized;
  refreshHostRef.current = host.refreshHost;
  reconcileRef.current = reconcileDocumentTypes;
  supersedeReadsRef.current = supersedeReadsForMutation;

  useLayoutEffect(() => {
    const nextInteraction = interactionRef.current;
    if (
      sameComplianceMutationBoundary(previousBoundary.current, boundary)
      && sameComplianceMutationInteraction(
        previousInteraction.current,
        nextInteraction,
      )
    ) return;
    previousBoundary.current = boundary;
    previousInteraction.current = { ...nextInteraction };
    authority.invalidate();
  }, [
    authority,
    boundary,
    interactionRef,
    interactionRef.current.criteriaGeneration,
    interactionRef.current.selectedId,
    interactionRef.current.selectedVersion,
    interactionRef.current.selectionGeneration,
  ]);

  const completeOperation = useCallback((operation: ComplianceMutationOperation) => {
    if (operationRef.current?.id !== operation.id) return;
    operation.effect?.release();
    operationRef.current = null;
    if (mounted.current) setPhase("idle");
  }, []);

  const attemptReconciliation = useCallback(async (
    operation: ComplianceMutationOperation,
  ) => {
    if (
      !mounted.current
      || operationRef.current?.id !== operation.id
      || !operation.outcome
      || operation.reconciling
    ) return;
    operation.reconciling = true;
    setPhase("reconciling");
    const preferredSelectedId = operation.outcome.kind === "success"
      ? operation.outcome.documentType.id
      : undefined;
    const result = await reconcileRef.current({
      preferredSelectedId,
      preferenceIsCurrent: () => operation.effect?.isCurrent() ?? false,
    });
    operation.reconciling = false;
    if (!mounted.current || operationRef.current?.id !== operation.id) return;
    if (result.kind === "applied") {
      if (result.preferenceCurrent) {
        void refreshHostRef.current().catch(() => undefined);
        if (operation.outcome.kind === "success") {
          const commandDocumentType = operation.outcome.documentType;
          operation.onSuccess(
            result.rows.find(
              (row) => row.id === commandDocumentType.id,
            ) || null,
          );
        } else {
          operation.onError(operation.outcome.error);
        }
      }
      completeOperation(operation);
      return;
    }
    setPhase("pending");
    if (result.kind === "failed") {
      operation.effect?.runIfCurrent(() => operation.onPending(result.error));
    } else if (result.kind === "superseded") {
      setRetryRevision((current) => current + 1);
    }
  }, [completeOperation]);

  const runOperation = useCallback(async ({
    action,
    target,
    execute,
    onSuccess,
    onError,
    onPending,
  }: ComplianceMutationRunInput) => {
    if (operationRef.current) return false;
    const capturedAuthorityEpoch = authority.epoch;
    const captured = complianceMutationDispatchSnapshot(
      boundaryRef.current,
      interactionRef.current,
    );
    const operation: ComplianceMutationOperation = {
      id: ++operationSequence.current,
      action,
      effect: null,
      outcome: null,
      reconciling: false,
      execute,
      onSuccess,
      onError,
      onPending,
    };
    operationRef.current = operation;
    setPhase("command");
    await Promise.resolve();
    const dispatchCurrent = isComplianceMutationDispatchCurrent(
      captured,
      boundaryRef.current,
      interactionRef.current,
    );
    const targetCurrent = !target || (
      captured.interaction.selectedId === target.id
      && captured.interaction.selectedVersion === target.version
    );
    if (
      !authority.isCurrentEpoch(capturedAuthorityEpoch)
      || !dispatchCurrent
      || !targetCurrent
      || !mounted.current
    ) {
      completeOperation(operation);
      return false;
    }
    const effect = beginComplianceMutationEffect(
      authority,
      boundaryRef,
      interactionRef,
      onUnauthorizedRef,
    );
    operation.effect = effect;
    supersedeReadsRef.current();
    try {
      operation.outcome = {
        kind: "success",
        documentType: await execute({
          onUnauthorized: effect.request.onUnauthorized,
          idempotencyKey: complianceMutationIdempotencyKey(action),
        }),
      };
    } catch (error) {
      if (isComplianceApiError(error) && error.status === 401) {
        completeOperation(operation);
        return false;
      }
      operation.outcome = { kind: "error", error };
    }
    if (!mounted.current) {
      completeOperation(operation);
      return false;
    }
    setPhase("pending");
    await attemptReconciliation(operation);
    return operation.outcome.kind === "success";
  }, [attemptReconciliation, authority, completeOperation, interactionRef]);

  const retryPendingReconciliation = useCallback(async () => {
    const operation = operationRef.current;
    if (!operation?.outcome) return false;
    await attemptReconciliation(operation);
    return operationRef.current === null;
  }, [attemptReconciliation]);

  useEffect(() => {
    const operation = operationRef.current;
    if (operation?.outcome) {
      void attemptReconciliation(operation);
    }
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
      operationRef.current?.effect?.release();
    };
  }, [authority]);

  const operation = operationRef.current;
  return {
    operationActive: phase !== "idle",
    reconciliationPending: phase === "pending",
    busyAction: operation
      ? operation.effect?.isCurrent() ? operation.action : "reconcile"
      : "",
    runOperation,
    retryPendingReconciliation,
  };
}

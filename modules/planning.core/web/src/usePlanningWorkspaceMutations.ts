import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";

import {
  isPlanningPreconditionError,
  loadPlanningSchedule,
  type PlanningPreconditionError,
  type PlanningStrongEtag,
} from "./planningApi";
import type { PlanningMutationIntent, PlanningStaleRecovery } from "./planningConcurrencyState";
import {
  type PlanningHistoryEntry,
  withPlanningHistorySource,
} from "./planningHistory";
import { executePlanningHistoryBatch, planningHistoryBatchSupported } from "./planningHistoryExecution";
import { planningIntent } from "./planningMutationIntents";
import { planningWorkspaceActions } from "./planningWorkspaceActions";
import { planningWorkspaceErrorMessage, planningWorkspaceErrorStatus, planningWorkspaceHistoryState } from "./planningWorkspaceStatus";
import type { PlanningProject, PlanningSchedule } from "./types";
import { usePlanningOperation } from "./usePlanningOperation";
import { usePlanningProjectOperations } from "./usePlanningProjectOperations";

const historyLimit = 25;

export function usePlanningWorkspaceMutations({
  token,
  operational,
  schedule,
  selectedProjectId,
  setProjects,
  setSchedule,
  setSelectedProjectId,
  setSelectedTaskId,
}: {
  token: string;
  operational: boolean;
  schedule: PlanningSchedule | null;
  selectedProjectId: string;
  setProjects: Dispatch<SetStateAction<PlanningProject[]>>;
  setSchedule: (schedule: PlanningSchedule | null) => void;
  setSelectedProjectId: (projectId: string) => void;
  setSelectedTaskId: (update: string | ((current: string) => string)) => void;
}) {
  const [status, setStatus] = useState<unknown>("Planning module ready.");
  const [scheduleEtag, setScheduleEtag] = useState<PlanningStrongEtag | null>(null);
  const [staleRecovery, setStaleRecovery] = useState<PlanningStaleRecovery | null>(null);
  const [undoStack, setUndoStack] = useState<PlanningHistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<PlanningHistoryEntry[]>([]);
  const etagRef = useRef<PlanningStrongEtag | null>(null);
  const pendingIntentRef = useRef<PlanningMutationIntent | null>(null);
  const { busy, finish: finishOperation, invalidate: invalidateOperation, isCurrent: isOperationCurrent, start: startOperation } = usePlanningOperation();
  const setCurrentEtag = useCallback((etag: PlanningStrongEtag | null) => {
    etagRef.current = etag;
    setScheduleEtag(etag);
  }, []);
  const clearHistory = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, []);
  const clearRecovery = useCallback(() => {
    pendingIntentRef.current = null;
    setStaleRecovery(null);
  }, []);
  const history = planningWorkspaceHistoryState(undoStack, redoStack);
  const workspaceActions = planningWorkspaceActions({ token, projectId: selectedProjectId, mutate });
  const reloadSchedule = useCallback(async (projectId: string, current: () => boolean = () => true) => {
    const snapshot = await loadPlanningSchedule(token, projectId);
    if (!current()) throw new Error("Planning operation was superseded.");
    setSchedule(snapshot.schedule);
    setCurrentEtag(snapshot.etag);
    setSelectedTaskId((current) => snapshot.schedule.tasks.some((task) => task.id === current) ? current : snapshot.schedule.tasks[0]?.id || "");
    return snapshot.schedule;
  }, [setCurrentEtag, setSchedule, setSelectedTaskId, token]);
  const projectOperations = usePlanningProjectOperations({
    token, operational, selectedProjectId, setProjects, setSchedule, setSelectedProjectId, setSelectedTaskId, setStatus,
    setCurrentEtag, reloadSchedule, clearHistory, clearRecovery, startOperation, finishOperation, invalidateOperation, isOperationCurrent,
  });

  return {
    ...workspaceActions,
    bulkUpdatesAvailable: true,
    busy,
    changeProject: projectOperations.changeProject,
    createProject: projectOperations.createProject,
    createDemoSchedule: projectOperations.createDemoSchedule,
    history,
    keepLatestSchedule,
    reapplyStaleMutation,
    refresh: projectOperations.refresh,
    reloadStaleSchedule,
    runHistory,
    scheduleEtag,
    staleRecovery,
    status,
  };
  async function mutate(mutation: PlanningMutationIntent) {
    if (!selectedProjectId || !etagRef.current) return setStatus({ status: "unavailable", message: "Reload the schedule before making changes." });
    const before = schedule;
    const ticket = startOperation(mutation.action);
    if (!ticket) return;
    try {
      const response = await mutation.run(etagRef.current);
      if (!isOperationCurrent(ticket)) return;
      setCurrentEtag(response.etag);
      const after = await reloadSchedule(selectedProjectId, () => isOperationCurrent(ticket));
      if (!isOperationCurrent(ticket)) return;
      if (before) pushHistory(withPlanningHistorySource(mutation.history(before, after, mutation.label), response.data, after.project.revision));
      clearRecovery();
      setStatus({ status: "validated", ...mutation.okStatus, ...mutation.successStatus?.(response.data) });
    } catch (error) {
      if (!isOperationCurrent(ticket)) return;
      if (isPlanningPreconditionError(error)) await beginStaleRecovery(error, mutation, ticket);
      else {
        setStatus(planningWorkspaceErrorStatus(error));
        await reloadSchedule(selectedProjectId, () => isOperationCurrent(ticket)).catch(() => undefined);
      }
    } finally {
      finishOperation(ticket);
    }
  }

  async function beginStaleRecovery(error: PlanningPreconditionError, mutation: PlanningMutationIntent, ticket: number) {
    pendingIntentRef.current = mutation;
    clearHistory();
    setStaleRecovery({ detail: error.detail, label: mutation.label, reloadFailed: true });
    try {
      await reloadSchedule(selectedProjectId, () => isOperationCurrent(ticket));
      if (!isOperationCurrent(ticket)) return;
      setStaleRecovery({ detail: error.detail, label: mutation.label, reloadFailed: false });
      setStatus({ status: "stale", code: error.detail.code, message: error.detail.message, current_revision: error.detail.current_revision });
    } catch (reloadError) {
      if (isOperationCurrent(ticket)) setStatus({ status: "reload_failed", message: planningWorkspaceErrorMessage(reloadError) });
    }
  }

  async function reloadStaleSchedule() {
    if (!staleRecovery || !selectedProjectId) return;
    const action = "recovery-reload";
    const ticket = startOperation(action);
    if (!ticket) return;
    try {
      await reloadSchedule(selectedProjectId, () => isOperationCurrent(ticket));
      if (!isOperationCurrent(ticket)) return;
      setStaleRecovery({ ...staleRecovery, reloadFailed: false });
    } catch (error) {
      if (isOperationCurrent(ticket)) setStatus({ status: "reload_failed", message: planningWorkspaceErrorMessage(error) });
    } finally {
      finishOperation(ticket);
    }
  }

  async function reapplyStaleMutation() {
    const mutation = pendingIntentRef.current;
    if (!mutation || staleRecovery?.reloadFailed || !etagRef.current) return;
    const before = schedule;
    const action = "reapply";
    const ticket = startOperation(action);
    if (!ticket) return;
    try {
      const response = await mutation.run(etagRef.current);
      if (!isOperationCurrent(ticket)) return;
      setCurrentEtag(response.etag);
      const after = await reloadSchedule(selectedProjectId, () => isOperationCurrent(ticket));
      if (!isOperationCurrent(ticket)) return;
      if (before) pushHistory(withPlanningHistorySource(mutation.history(before, after, mutation.label), response.data, after.project.revision));
      clearRecovery();
      setStatus({ status: "validated", reapplied: true, ...mutation.okStatus, ...mutation.successStatus?.(response.data) });
    } catch (error) {
      if (!isOperationCurrent(ticket)) return;
      if (isPlanningPreconditionError(error)) await beginStaleRecovery(error, mutation, ticket);
      else setStatus(planningWorkspaceErrorStatus(error));
    } finally {
      finishOperation(ticket);
    }
  }

  function keepLatestSchedule() {
    clearRecovery();
    setStatus({ status: "ready", message: "Kept the latest server schedule." });
  }

  async function runHistory(direction: "undo" | "redo") {
    const source = direction === "undo" ? undoStack : redoStack;
    const entry = source.at(-1);
    const steps = entry && (direction === "undo" ? entry.undo : entry.redo);
    if (!entry || !steps || !selectedProjectId || !schedule || !etagRef.current) return;
    if (!planningHistoryBatchSupported(steps)) return setStatus({ status: "unavailable", message: "This history entry contains operations not yet supported by the atomic task batch endpoint." });
    if (!entry.sourceCommandId) return setStatus({ status: "unavailable", message: "This history entry has no source command correlation and cannot be replayed safely." });
    const historyIntent = planningIntent(direction, `${direction === "undo" ? "Undo" : "Redo"} ${entry.label}`, { action: direction, label: entry.label }, (etag) => (
      executePlanningHistoryBatch(token, schedule, steps, etag, entry.sourceCommandId as string, `${direction === "undo" ? "Undo" : "Redo"} ${entry.label}`)
    ));
    const ticket = startOperation(direction);
    if (!ticket) return;
    try {
      const response = await historyIntent.run(etagRef.current);
      if (!isOperationCurrent(ticket)) return;
      setCurrentEtag(response.etag);
      const after = await reloadSchedule(selectedProjectId, () => isOperationCurrent(ticket));
      if (!isOperationCurrent(ticket)) return;
      const replayedEntry = withPlanningHistorySource(entry, response.data, after.project.revision) || entry;
      if (direction === "undo") {
        setUndoStack((items) => items.slice(0, -1));
        setRedoStack((items) => [...items, replayedEntry].slice(-historyLimit));
      } else {
        setRedoStack((items) => items.slice(0, -1));
        setUndoStack((items) => [...items, replayedEntry].slice(-historyLimit));
      }
      setStatus({ status: "validated", action: direction, label: entry.label });
    } catch (error) {
      if (!isOperationCurrent(ticket)) return;
      if (isPlanningPreconditionError(error)) await beginStaleRecovery(error, historyIntent, ticket);
      else setStatus(planningWorkspaceErrorStatus(error));
    } finally {
      finishOperation(ticket);
    }
  }

  function pushHistory(entry: PlanningHistoryEntry | null) {
    if (!entry) return;
    setUndoStack((items) => [...items, entry].slice(-historyLimit));
    setRedoStack([]);
  }

}

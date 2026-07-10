import { useCallback, useEffect, useRef, useState } from "react";

import {
  isPlanningPreconditionError,
  loadPlanningSchedule,
  listPlanningProjects,
  PlanningApiError,
  type PlanningPreconditionError,
  type PlanningStrongEtag,
} from "./planningApi";
import type { PlanningMutationIntent, PlanningStaleRecovery } from "./planningConcurrencyState";
import { createPlanningDemoSchedule } from "./planningDemoSchedule";
import {
  type PlanningHistoryEntry,
  type PlanningHistoryState,
} from "./planningHistory";
import { executePlanningHistoryStep } from "./planningHistoryExecution";
import { planningIntent } from "./planningMutationIntents";
import { planningWorkspaceActions } from "./planningWorkspaceActions";
import type { PlanningProject, PlanningSchedule } from "./types";

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
  setProjects: (projects: PlanningProject[]) => void;
  setSchedule: (schedule: PlanningSchedule | null) => void;
  setSelectedProjectId: (projectId: string) => void;
  setSelectedTaskId: (update: string | ((current: string) => string)) => void;
}) {
  const [status, setStatus] = useState<unknown>("Planning module ready.");
  const [busy, setBusy] = useState("");
  const [scheduleEtag, setScheduleEtag] = useState<PlanningStrongEtag | null>(null);
  const [staleRecovery, setStaleRecovery] = useState<PlanningStaleRecovery | null>(null);
  const [undoStack, setUndoStack] = useState<PlanningHistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<PlanningHistoryEntry[]>([]);
  const etagRef = useRef<PlanningStrongEtag | null>(null);
  const pendingIntentRef = useRef<PlanningMutationIntent | null>(null);
  const undoEntry = undoStack.at(-1);
  const redoEntry = redoStack.at(-1);
  const history: PlanningHistoryState = {
    canUndo: Boolean(undoEntry && undoEntry.undo.length === 1),
    canRedo: Boolean(redoEntry && redoEntry.redo.length === 1),
    undoLabel: historyLabel(undoEntry, "undo"),
    redoLabel: historyLabel(redoEntry, "redo"),
  };
  const workspaceActions = planningWorkspaceActions({ token, projectId: selectedProjectId, mutate, setStatus });

  const reloadSchedule = useCallback(async (projectId: string) => {
    const snapshot = await loadPlanningSchedule(token, projectId);
    setSchedule(snapshot.schedule);
    setCurrentEtag(snapshot.etag);
    setSelectedTaskId((current) => snapshot.schedule.tasks.some((task) => task.id === current) ? current : snapshot.schedule.tasks[0]?.id || "");
    return snapshot.schedule;
  }, [setSchedule, setSelectedTaskId, token]);

  const refresh = useCallback(async () => {
    if (!token || !operational) return;
    setBusy("refresh");
    try {
      const rows = await listPlanningProjects(token);
      setProjects(rows);
      const projectId = selectedProjectId || rows[0]?.id || "";
      setSelectedProjectId(projectId);
      if (projectId) await reloadSchedule(projectId);
      else {
        setSchedule(null);
        setCurrentEtag(null);
      }
      setStatus({ status: "ready", projects: rows.length });
    } catch (error) {
      setStatus(errorStatus(error));
    } finally {
      setBusy("");
    }
  }, [operational, reloadSchedule, selectedProjectId, setProjects, setSchedule, setSelectedProjectId, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    ...workspaceActions,
    bulkUpdatesAvailable: false,
    busy,
    changeProject,
    createDemoSchedule,
    history,
    keepLatestSchedule,
    reapplyStaleMutation,
    refresh,
    reloadStaleSchedule,
    runHistory,
    scheduleEtag,
    staleRecovery,
    status,
  };

  async function createDemoSchedule() {
    setBusy("demo");
    try {
      const created = await createPlanningDemoSchedule(token);
      setCurrentEtag(created.etag);
      setProjects(await listPlanningProjects(token));
      setSelectedProjectId(created.projectId);
      await reloadSchedule(created.projectId);
      clearHistory();
      clearRecovery();
      setStatus({ status: "created", project_id: created.projectId });
    } catch (error) {
      setStatus(errorStatus(error));
    } finally {
      setBusy("");
    }
  }

  async function changeProject(projectId: string) {
    setSelectedProjectId(projectId);
    setCurrentEtag(null);
    await reloadSchedule(projectId);
    clearHistory();
    clearRecovery();
  }

  async function mutate(mutation: PlanningMutationIntent) {
    if (!selectedProjectId || !etagRef.current) return setStatus({ status: "unavailable", message: "Reload the schedule before making changes." });
    const before = schedule;
    setBusy(mutation.action);
    try {
      const response = await mutation.run(etagRef.current);
      setCurrentEtag(response.etag);
      const after = await reloadSchedule(selectedProjectId);
      if (before) pushHistory(mutation.history(before, after, mutation.label));
      clearRecovery();
      setStatus({ status: "validated", ...mutation.okStatus });
    } catch (error) {
      if (isPlanningPreconditionError(error)) await beginStaleRecovery(error, mutation);
      else {
        setStatus(errorStatus(error));
        await reloadSchedule(selectedProjectId).catch(() => undefined);
      }
    } finally {
      setBusy("");
    }
  }

  async function beginStaleRecovery(error: PlanningPreconditionError, mutation: PlanningMutationIntent) {
    pendingIntentRef.current = mutation;
    clearHistory();
    setStaleRecovery({ detail: error.detail, label: mutation.label, reloadFailed: true });
    try {
      await reloadSchedule(selectedProjectId);
      setStaleRecovery({ detail: error.detail, label: mutation.label, reloadFailed: false });
      setStatus({ status: "stale", code: error.detail.code, message: error.detail.message, current_revision: error.detail.current_revision });
    } catch (reloadError) {
      setStatus({ status: "reload_failed", message: errorMessage(reloadError) });
    }
  }

  async function reloadStaleSchedule() {
    if (!staleRecovery || !selectedProjectId) return;
    setBusy("recovery-reload");
    try {
      await reloadSchedule(selectedProjectId);
      setStaleRecovery({ ...staleRecovery, reloadFailed: false });
    } catch (error) {
      setStatus({ status: "reload_failed", message: errorMessage(error) });
    } finally {
      setBusy("");
    }
  }

  async function reapplyStaleMutation() {
    const mutation = pendingIntentRef.current;
    if (!mutation || staleRecovery?.reloadFailed || !etagRef.current) return;
    const before = schedule;
    setBusy("reapply");
    try {
      const response = await mutation.run(etagRef.current);
      setCurrentEtag(response.etag);
      const after = await reloadSchedule(selectedProjectId);
      if (before) pushHistory(mutation.history(before, after, mutation.label));
      clearRecovery();
      setStatus({ status: "validated", reapplied: true, ...mutation.okStatus });
    } catch (error) {
      if (isPlanningPreconditionError(error)) await beginStaleRecovery(error, mutation);
      else setStatus(errorStatus(error));
    } finally {
      setBusy("");
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
    if (!entry || !steps || !selectedProjectId || !etagRef.current) return;
    if (steps.length !== 1) return setStatus({ status: "unavailable", message: "Multi-step history is disabled until the atomic Planning batch endpoint is available." });
    const historyIntent = planningIntent(direction, `${direction === "undo" ? "Undo" : "Redo"} ${entry.label}`, { action: direction, label: entry.label }, (etag) => executePlanningHistoryStep(token, schedule, steps[0], etag));
    setBusy(direction);
    try {
      const response = await historyIntent.run(etagRef.current);
      setCurrentEtag(response.etag);
      await reloadSchedule(selectedProjectId);
      if (direction === "undo") {
        setUndoStack((items) => items.slice(0, -1));
        setRedoStack((items) => [...items, entry].slice(-historyLimit));
      } else {
        setRedoStack((items) => items.slice(0, -1));
        setUndoStack((items) => [...items, entry].slice(-historyLimit));
      }
      setStatus({ status: "validated", action: direction, label: entry.label });
    } catch (error) {
      if (isPlanningPreconditionError(error)) await beginStaleRecovery(error, historyIntent);
      else setStatus(errorStatus(error));
    } finally {
      setBusy("");
    }
  }

  function setCurrentEtag(etag: PlanningStrongEtag | null) {
    etagRef.current = etag;
    setScheduleEtag(etag);
  }

  function pushHistory(entry: PlanningHistoryEntry | null) {
    if (!entry) return;
    setUndoStack((items) => [...items, entry].slice(-historyLimit));
    setRedoStack([]);
  }

  function clearHistory() {
    setUndoStack([]);
    setRedoStack([]);
  }

  function clearRecovery() {
    pendingIntentRef.current = null;
    setStaleRecovery(null);
  }
}

function historyLabel(entry: PlanningHistoryEntry | undefined, direction: "undo" | "redo") {
  if (!entry) return "";
  const steps = direction === "undo" ? entry.undo : entry.redo;
  return steps.length === 1 ? entry.label : `${entry.label} requires atomic batch support`;
}

function errorStatus(error: unknown) {
  if (error instanceof PlanningApiError) return { status: "error", http_status: error.status, message: error.message };
  return { status: "error", message: errorMessage(error) };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Planning request failed.";
}

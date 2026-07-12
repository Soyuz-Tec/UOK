import { isPlanningDomainError, PlanningApiError } from "./planningApi";
import type { PlanningHistoryEntry, PlanningHistoryState } from "./planningHistory";
import { planningHistoryBatchSupported } from "./planningHistoryExecution";

export function planningHistoryLabel(entry: PlanningHistoryEntry | undefined, direction: "undo" | "redo") {
  if (!entry) return "";
  const steps = direction === "undo" ? entry.undo : entry.redo;
  if (!planningHistoryBatchSupported(steps)) return `${entry.label} has unsupported history operations`;
  return entry.sourceCommandId ? entry.label : `${entry.label} has no source command correlation`;
}

export function planningWorkspaceHistoryState(undoStack: PlanningHistoryEntry[], redoStack: PlanningHistoryEntry[]): PlanningHistoryState {
  const undoEntry = undoStack.at(-1);
  const redoEntry = redoStack.at(-1);
  return {
    canUndo: Boolean(undoEntry?.sourceCommandId && planningHistoryBatchSupported(undoEntry.undo)),
    canRedo: Boolean(redoEntry?.sourceCommandId && planningHistoryBatchSupported(redoEntry.redo)),
    undoLabel: planningHistoryLabel(undoEntry, "undo"),
    redoLabel: planningHistoryLabel(redoEntry, "redo"),
  };
}

export function planningWorkspaceErrorStatus(error: unknown) {
  if (isPlanningDomainError(error)) return {
    status: "error",
    http_status: error.status,
    ...error.detail,
  };
  if (error instanceof PlanningApiError) return { status: "error", http_status: error.status, message: error.message };
  return { status: "error", message: planningWorkspaceErrorMessage(error) };
}

export function planningWorkspaceErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Planning request failed.";
}

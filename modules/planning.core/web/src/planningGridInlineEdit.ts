import type { PlanningTask, PlanningTaskStatus } from "./types";
import type { PlanningTaskUpdateRequest } from "./planningContracts";

const editableColumns = new Set(["task", "start", "end", "progress", "status"]);

export function planningGridCellEditPayload(columnId: string, value: string): PlanningTaskUpdateRequest {
  const next = value.trim();
  if (columnId === "task") return { title: next };
  if (columnId === "start") return { start: next };
  if (columnId === "end") return { end: next };
  if (columnId === "status") return { status: next as PlanningTaskStatus };
  if (columnId === "progress") return { progress: Number(next) };
  return {};
}

export function planningGridCellEditValidation(columnId: string, value: string) {
  const next = value.trim();
  if (!isEditablePlanningGridColumn(columnId)) return "This column is read only.";
  if (!next) return "Enter a value.";
  if ((columnId === "start" || columnId === "end") && !/^\d{4}-\d{2}-\d{2}$/.test(next)) return "Use YYYY-MM-DD.";
  if (columnId === "progress") {
    const progress = Number(next);
    if (!Number.isInteger(progress) || progress < 0 || progress > 100) return "Use 0 to 100.";
  }
  if (columnId === "status" && !["planned", "in_progress", "blocked", "complete"].includes(next)) return "Use planned, in_progress, blocked, or complete.";
  return "";
}

export function isEditablePlanningGridColumn(columnId: string) {
  return editableColumns.has(columnId);
}

export function planningGridCellEditLabel(columnLabel: string, task: PlanningTask) {
  return `${columnLabel} for ${task.title}`;
}

import { gridValue } from "./planningGanttModel";
import type { PlanningTask } from "./types";

export type PlanningGridSort = {
  columnId: string;
  direction: "asc" | "desc";
} | null;

export function nextPlanningGridSort(current: PlanningGridSort, columnId: string): PlanningGridSort {
  if (current?.columnId !== columnId) return { columnId, direction: "asc" };
  return { columnId, direction: current.direction === "asc" ? "desc" : "asc" };
}

export function sortPlanningTasks(tasks: PlanningTask[], sort: PlanningGridSort, assignedByTask: Map<string, string>) {
  if (!sort) return tasks;
  const direction = sort.direction === "asc" ? 1 : -1;
  return tasks
    .map((task, index) => ({ index, task }))
    .sort((a, b) => {
      const comparison = compareTaskColumn(sort.columnId, a.task, b.task, assignedByTask);
      return comparison ? comparison * direction : a.index - b.index;
    })
    .map((item) => item.task);
}

function compareTaskColumn(columnId: string, a: PlanningTask, b: PlanningTask, assignedByTask: Map<string, string>) {
  if (columnId === "duration") return a.duration_days - b.duration_days;
  if (columnId === "progress") return a.progress - b.progress;
  if (columnId === "critical") return Number(a.critical) - Number(b.critical);
  return String(gridValue(columnId, a, assignedByTask)).localeCompare(String(gridValue(columnId, b, assignedByTask)), undefined, { numeric: true, sensitivity: "base" });
}

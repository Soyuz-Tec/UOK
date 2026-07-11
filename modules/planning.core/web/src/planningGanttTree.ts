import type { PlanningTask } from "./types";

export function visibleRows(tasks: PlanningTask[], collapsedSummaryIds: Set<string>) {
  if (collapsedSummaryIds.size === 0) return tasks;
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  return tasks.filter((task) => !hasCollapsedAncestor(task, taskById, collapsedSummaryIds));
}

export function summaryTaskIds(tasks: PlanningTask[]) {
  return tasks.filter((task) => task.task_type === "summary").map((task) => task.id);
}

function hasCollapsedAncestor(task: PlanningTask, taskById: Map<string, PlanningTask>, collapsedSummaryIds: Set<string>) {
  let parentId = task.parent_task_id;
  while (parentId) {
    if (collapsedSummaryIds.has(parentId)) return true;
    parentId = taskById.get(parentId)?.parent_task_id || null;
  }
  return false;
}

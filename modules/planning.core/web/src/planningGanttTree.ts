import type { PlanningTask } from "./types";

export function visibleRows(tasks: PlanningTask[], collapsedSummaryIds: Set<string>) {
  if (collapsedSummaryIds.size === 0) return tasks;
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  return tasks.filter((task) => !hasCollapsedAncestor(task, taskById, collapsedSummaryIds));
}

export function summaryTaskIds(tasks: PlanningTask[]) {
  return tasks.filter((task) => task.task_type === "summary").map((task) => task.id);
}

export function planningTaskDepths(tasks: PlanningTask[]) {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const depths = new Map<string, number>();
  for (const task of tasks) {
    let depth = 0;
    let parentId = task.parent_task_id;
    const visited = new Set([task.id]);
    while (parentId && !visited.has(parentId)) {
      const parent = taskById.get(parentId);
      if (!parent) break;
      depth += 1;
      visited.add(parentId);
      parentId = parent.parent_task_id;
    }
    depths.set(task.id, depth);
  }
  return depths;
}

function hasCollapsedAncestor(task: PlanningTask, taskById: Map<string, PlanningTask>, collapsedSummaryIds: Set<string>) {
  let parentId = task.parent_task_id;
  while (parentId) {
    if (collapsedSummaryIds.has(parentId)) return true;
    parentId = taskById.get(parentId)?.parent_task_id || null;
  }
  return false;
}

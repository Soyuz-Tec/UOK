import type { PlanningSchedule } from "./types";

export type PlanningDependencyChain = {
  taskKinds: Map<string, "predecessor" | "successor" | "related">;
  dependencyIds: Set<string>;
};

export function selectedDependencyChain(schedule: PlanningSchedule, selectedTaskId: string): PlanningDependencyChain {
  const taskKinds = new Map<string, "predecessor" | "successor" | "related">();
  const dependencyIds = new Set<string>();
  if (!selectedTaskId) return { taskKinds, dependencyIds };
  walkChain(schedule, selectedTaskId, "predecessor", taskKinds, dependencyIds);
  walkChain(schedule, selectedTaskId, "successor", taskKinds, dependencyIds);
  taskKinds.delete(selectedTaskId);
  return { taskKinds, dependencyIds };
}

export function taskDependencyChainClass(chain: PlanningDependencyChain, taskId: string) {
  const kind = chain.taskKinds.get(taskId);
  return kind ? `chain-${kind}` : "";
}

function walkChain(
  schedule: PlanningSchedule,
  taskId: string,
  direction: "predecessor" | "successor",
  taskKinds: PlanningDependencyChain["taskKinds"],
  dependencyIds: Set<string>,
  visited = new Set<string>()
) {
  if (visited.has(taskId)) return;
  visited.add(taskId);
  for (const dependency of schedule.dependencies) {
    const nextTaskId = direction === "predecessor" && dependency.successor_task_id === taskId
      ? dependency.predecessor_task_id
      : direction === "successor" && dependency.predecessor_task_id === taskId
        ? dependency.successor_task_id
        : "";
    if (!nextTaskId) continue;
    dependencyIds.add(dependency.id);
    markTask(taskKinds, nextTaskId, direction);
    walkChain(schedule, nextTaskId, direction, taskKinds, dependencyIds, visited);
  }
}

function markTask(taskKinds: PlanningDependencyChain["taskKinds"], taskId: string, direction: "predecessor" | "successor") {
  const current = taskKinds.get(taskId);
  taskKinds.set(taskId, current && current !== direction ? "related" : direction);
}

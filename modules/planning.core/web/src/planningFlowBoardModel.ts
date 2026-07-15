import type {
  PlanningSchedule,
  PlanningTask,
  PlanningTaskFlowStatus,
  PlanningTaskStatus,
} from "./types";

export type PlanningFlowLane = PlanningTaskFlowStatus & {
  tasks: PlanningTask[];
};

export function planningFlowLanes(schedule: PlanningSchedule): PlanningFlowLane[] {
  return (schedule.task_flow?.statuses || []).map((status) => ({
    ...status,
    tasks: schedule.tasks.filter((task) => task.status === status.status),
  }));
}

export function planningFlowStatus(
  schedule: PlanningSchedule,
  status: PlanningTaskStatus,
): PlanningTaskFlowStatus | undefined {
  return schedule.task_flow?.statuses.find((item) => item.status === status);
}

export function planningFlowTargets(
  schedule: PlanningSchedule,
  task: PlanningTask,
): PlanningTaskFlowStatus[] {
  const current = planningFlowStatus(schedule, task.status);
  if (!current) return [];
  const allowed = new Set(current.allowed_transitions);
  return (schedule.task_flow?.statuses || []).filter((item) => allowed.has(item.status));
}

import type { PlanningBulkTaskUpdate } from "./PlanningBulkEditControls";
import type { PlanningMutationIntent } from "./planningConcurrencyState";
import {
  addBaselineIntent,
  addDependencyIntent,
  addResourceIntent,
  addTaskIntent,
  assignResourceIntent,
  levelResourcesIntent,
  removeDependencyIntent,
  removeTaskIntent,
  rescheduleTaskIntent,
  saveCalendarIntent,
  saveDependencyIntent,
  saveTaskIntent,
} from "./planningMutationIntents";
import { planningTaskMenuMutation, type PlanningTaskMenuAction } from "./planningTaskMenuModel";
import type { PlanningTask } from "./types";

export function planningWorkspaceActions({
  token,
  projectId,
  mutate,
  setStatus,
}: {
  token: string;
  projectId: string;
  mutate: (intent: PlanningMutationIntent) => Promise<void>;
  setStatus: (status: unknown) => void;
}) {
  const actions = {
    rescheduleTask: (taskId: string, start: string, end: string, cascade = true) => mutate(rescheduleTaskIntent(token, taskId, start, end, cascade)),
    saveTask: (taskId: string, payload: Record<string, unknown>, cascade = true) => mutate(saveTaskIntent(token, taskId, payload, cascade)),
    addTask: (payload: Record<string, unknown>) => mutate(addTaskIntent(token, projectId, payload)),
    removeTask: (taskId: string) => mutate(removeTaskIntent(token, taskId)),
    addDependency: (payload: Record<string, unknown>) => mutate(addDependencyIntent(token, projectId, payload)),
    saveDependency: (dependencyId: string, payload: Record<string, unknown>) => mutate(saveDependencyIntent(token, dependencyId, payload)),
    removeDependency: (dependencyId: string) => mutate(removeDependencyIntent(token, dependencyId)),
    saveCalendar: (payload: Record<string, unknown>) => mutate(saveCalendarIntent(token, projectId, payload)),
    addBaseline: (payload: Record<string, unknown>) => mutate(addBaselineIntent(token, projectId, payload)),
    addResource: (payload: Record<string, unknown>) => mutate(addResourceIntent(token, projectId, payload)),
    assignResource: (payload: Record<string, unknown>) => mutate(assignResourceIntent(token, payload)),
    levelResources: () => mutate(levelResourcesIntent(token, projectId)),
    saveTaskBatch: async (updates: PlanningBulkTaskUpdate[]) => {
      setStatus({ status: "unavailable", action: "bulk_task_update", tasks: updates.length, message: "Bulk edits are disabled until the atomic Planning batch endpoint is available." });
    },
    runTaskMenuAction: async (action: PlanningTaskMenuAction, task: PlanningTask) => {
      const mutation = planningTaskMenuMutation(action, task);
      if (!mutation) return;
      if (mutation.kind === "create") await actions.addTask(mutation.payload);
      else if (mutation.kind === "update") await actions.saveTask(mutation.taskId, mutation.payload);
      else await actions.removeTask(mutation.taskId);
    },
  };
  return actions;
}

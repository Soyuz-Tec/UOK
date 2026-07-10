import {
  assignPlanningResource,
  createPlanningBaseline,
  createPlanningDependency,
  createPlanningResource,
  createPlanningTask,
  deletePlanningTask,
  planningCommand,
  removePlanningDependency,
  setPlanningCalendar,
  updatePlanningDependency,
  updatePlanningTask,
} from "./planningApi";
import type { PlanningMutationIntent } from "./planningConcurrencyState";
import { planningHistoryDiff, planningLevelHistory } from "./planningHistory";
import { withCascade } from "./planningWorkspaceHelpers";
import type { PlanningSchedule } from "./types";

export function rescheduleTaskIntent(token: string, taskId: string, start: string, end: string, cascade: boolean) {
  return intent("reschedule", "Reschedule task", { taskId, start, end, cascade }, (etag) => updatePlanningTask(token, taskId, { start, end, cascade }, { ifMatch: etag }));
}

export function saveTaskIntent(token: string, taskId: string, payload: Record<string, unknown>, cascade: boolean) {
  return intent("task", "Edit task", { taskId, cascade }, (etag) => updatePlanningTask(token, taskId, withCascade(payload, cascade), { ifMatch: etag }));
}

export function addTaskIntent(token: string, projectId: string, payload: Record<string, unknown>) {
  return intent("task", "Create task", { action: "task_created" }, (etag) => createPlanningTask(token, projectId, payload, { ifMatch: etag }));
}

export function removeTaskIntent(token: string, taskId: string) {
  return intent("task", "Delete task", { taskId, action: "task_deleted" }, (etag) => deletePlanningTask(token, taskId, { ifMatch: etag }));
}

export function addDependencyIntent(token: string, projectId: string, payload: Record<string, unknown>) {
  return intent("dependency", "Create dependency", { action: "dependency_created" }, (etag) => createPlanningDependency(token, projectId, payload, { ifMatch: etag }));
}

export function saveDependencyIntent(token: string, dependencyId: string, payload: Record<string, unknown>) {
  return intent("dependency", "Edit dependency", { dependencyId }, (etag) => updatePlanningDependency(token, dependencyId, payload, { ifMatch: etag }));
}

export function removeDependencyIntent(token: string, dependencyId: string) {
  return intent("dependency", "Remove dependency", { dependencyId, action: "dependency_removed" }, (etag) => removePlanningDependency(token, dependencyId, { ifMatch: etag }));
}

export function saveCalendarIntent(token: string, projectId: string, payload: Record<string, unknown>) {
  return intent("calendar", "Edit calendar", { action: "calendar_updated" }, (etag) => setPlanningCalendar(token, projectId, payload, { ifMatch: etag }));
}

export function addBaselineIntent(token: string, projectId: string, payload: Record<string, unknown>) {
  return intent("baseline", "Create baseline", { action: "baseline_created" }, (etag) => createPlanningBaseline(token, projectId, payload, { ifMatch: etag }));
}

export function addResourceIntent(token: string, projectId: string, payload: Record<string, unknown>) {
  return intent("resource", "Create resource", { action: "resource_created" }, (etag) => createPlanningResource(token, projectId, payload, { ifMatch: etag }));
}

export function assignResourceIntent(token: string, payload: Record<string, unknown>) {
  return intent("resource", "Assign resource", { action: "resource_assigned" }, (etag) => assignPlanningResource(token, payload, { ifMatch: etag }));
}

export function levelResourcesIntent(token: string, projectId: string) {
  return intent("level", "Level resources", { action: "resources_leveled" }, (etag) => planningCommand<PlanningSchedule>(token, "LevelPlanningResources", { project_id: projectId }, "planning-level", { ifMatch: etag }), planningLevelHistory);
}

export function planningIntent(
  action: string,
  label: string,
  okStatus: Record<string, unknown>,
  run: PlanningMutationIntent["run"],
  history = planningHistoryDiff,
): PlanningMutationIntent {
  return { action, label, okStatus, run, history };
}

const intent = planningIntent;

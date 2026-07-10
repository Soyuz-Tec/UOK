import {
  assignPlanningResource,
  batchPlanningTaskUpdates,
  createPlanningBaseline,
  createPlanningDependency,
  createPlanningLink,
  createPlanningResource,
  createPlanningTask,
  deletePlanningTask,
  planningCommand,
  removePlanningDependency,
  removePlanningLink,
  setPlanningCalendar,
  updatePlanningDependency,
  updatePlanningTask,
  updatePlanningTaskDates,
} from "./planningApi";
import type { PlanningMutationIntent } from "./planningConcurrencyState";
import { planningHistoryDiff, planningLevelHistory } from "./planningHistory";
import { withCascade } from "./planningWorkspaceHelpers";
import type { PlanningSchedule } from "./types";
import type { PlanningBulkTaskUpdate } from "./PlanningBulkEditControls";
import type {
  PlanningAssignmentCreateRequest,
  PlanningBaselineCreateRequest,
  PlanningCalendarUpdateRequest,
  PlanningDependencyCreateRequest,
  PlanningDependencyUpdateRequest,
  PlanningLinkCreateRequest,
  PlanningResourceCreateRequest,
  PlanningTaskCreateRequest,
  PlanningTaskDateUpdateRequest,
  PlanningTaskUpdateRequest,
} from "./planningContracts";

export function rescheduleTaskIntent(token: string, taskId: string, start: string, end: string, cascade: boolean) {
  return intent("reschedule", "Reschedule task", { taskId, start, end, cascade }, (etag) => updatePlanningTask(token, taskId, { start, end, cascade }, { ifMatch: etag }));
}

export function saveTaskIntent(token: string, taskId: string, payload: PlanningTaskUpdateRequest, cascade: boolean) {
  return intent("task", "Edit task", { taskId, cascade }, (etag) => updatePlanningTask(token, taskId, withCascade(payload, cascade), { ifMatch: etag }));
}

export function saveTaskDatesIntent(token: string, taskId: string, payload: PlanningTaskDateUpdateRequest) {
  return intent("task-dates", "Edit task execution dates", { taskId, action: "task_dates_updated" }, (etag) => updatePlanningTaskDates(token, taskId, payload, { ifMatch: etag }));
}

export function addTaskIntent(token: string, projectId: string, payload: PlanningTaskCreateRequest) {
  return intent("task", "Create task", { action: "task_created" }, (etag) => createPlanningTask(token, projectId, payload, { ifMatch: etag }));
}

export function removeTaskIntent(token: string, taskId: string) {
  return intent("task", "Delete task", { taskId, action: "task_deleted" }, (etag) => deletePlanningTask(token, taskId, { ifMatch: etag }));
}

export function addDependencyIntent(token: string, projectId: string, payload: PlanningDependencyCreateRequest) {
  return intent("dependency", "Create dependency", { action: "dependency_created" }, (etag) => createPlanningDependency(token, projectId, payload, { ifMatch: etag }));
}

export function saveDependencyIntent(token: string, dependencyId: string, payload: PlanningDependencyUpdateRequest) {
  return intent("dependency", "Edit dependency", { dependencyId }, (etag) => updatePlanningDependency(token, dependencyId, payload, { ifMatch: etag }));
}

export function removeDependencyIntent(token: string, dependencyId: string) {
  return intent("dependency", "Remove dependency", { dependencyId, action: "dependency_removed" }, (etag) => removePlanningDependency(token, dependencyId, { ifMatch: etag }));
}

export function addPlanningLinkIntent(token: string, projectId: string, payload: PlanningLinkCreateRequest) {
  return intent("planning-link", "Create operation link", { action: "planning_link_created" }, (etag) => createPlanningLink(token, projectId, payload, { ifMatch: etag }));
}

export function removePlanningLinkIntent(token: string, projectId: string, linkId: string) {
  return intent("planning-link", "Remove operation link", { linkId, action: "planning_link_removed" }, (etag) => removePlanningLink(token, projectId, linkId, { ifMatch: etag }));
}

export function saveCalendarIntent(token: string, projectId: string, payload: PlanningCalendarUpdateRequest) {
  return intent("calendar", "Edit calendar", { action: "calendar_updated" }, (etag) => setPlanningCalendar(token, projectId, payload, { ifMatch: etag }));
}

export function addBaselineIntent(token: string, projectId: string, payload: PlanningBaselineCreateRequest) {
  return intent("baseline", "Create baseline", { action: "baseline_created" }, (etag) => createPlanningBaseline(token, projectId, payload, { ifMatch: etag }));
}

export function addResourceIntent(token: string, projectId: string, payload: PlanningResourceCreateRequest) {
  return intent("resource", "Create resource", { action: "resource_created" }, (etag) => createPlanningResource(token, projectId, payload, { ifMatch: etag }));
}

export function assignResourceIntent(token: string, payload: PlanningAssignmentCreateRequest) {
  return intent("resource", "Assign resource", { action: "resource_assigned" }, (etag) => assignPlanningResource(token, payload, { ifMatch: etag }));
}

export function levelResourcesIntent(token: string, projectId: string) {
  return intent("level", "Level resources", { action: "resources_leveled" }, (etag) => planningCommand<PlanningSchedule, { project_id: string }>(token, "LevelPlanningResources", { project_id: projectId }, "planning-level", { ifMatch: etag }), planningLevelHistory);
}

export function batchTaskUpdatesIntent(token: string, projectId: string, updates: PlanningBulkTaskUpdate[]) {
  return intent(
    "bulk-task",
    `Update ${updates.length} tasks`,
    { action: "bulk_task_update", tasks: updates.length },
    (etag) => batchPlanningTaskUpdates(token, projectId, updates, { ifMatch: etag }),
  );
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

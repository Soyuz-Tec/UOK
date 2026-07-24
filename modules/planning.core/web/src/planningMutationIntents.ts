import {
  assignPlanningResource,
  addPlanningTaskParticipant,
  createPlanningBaseline,
  createPlanningDependency,
  createPlanningLink,
  createPlanningResource,
  createPlanningTask,
  createPlanningTaskRequirement,
  advancePlanningTaskRequirement,
  decidePlanningTaskRequirement,
  setPlanningTaskRequirementLink,
  deletePlanningTask,
  planningCommand,
  removePlanningDependency,
  removePlanningLink,
  removePlanningTaskParticipant,
  setPlanningCalendar,
  updatePlanningDependency,
  updatePlanningTask,
  updatePlanningTaskDates,
} from "./planningApi";
import { batchPlanningTaskUpdates } from "./planningBatchApi";
import { setPlanningResourceCalendar } from "./planningResourceCalendarApi";
import { applyPlanningRecommendation, createPlanningOptimization, createPlanningRiskAnalysis, createPlanningWhatIfSnapshot, decidePlanningRecommendation, rollbackPlanningRecommendation } from "./planningAnalysisApi";
import type { PlanningMutationIntent } from "./planningConcurrencyState";
import { planningHistoryDiff, planningLevelHistory } from "./planningHistory";
import { withCascade } from "./planningWorkspaceHelpers";
import type { PlanningSchedule } from "./types";
import type { PlanningLevelingCommandResult } from "./levelingTypes";
import type { PlanningBulkTaskUpdate } from "./PlanningBulkEditControls";
import type {
  PlanningAssignmentCreateRequest,
  PlanningBaselineCreateRequest,
  PlanningCalendarUpdateRequest,
  PlanningDependencyCreateRequest,
  PlanningDependencyUpdateRequest,
  PlanningLinkCreateRequest,
  PlanningResourceCreateRequest,
  PlanningResourceCalendarUpdateRequest,
  PlanningTaskCreateRequest,
  PlanningTaskParticipantCreateRequest,
  PlanningTaskRequirementAdvanceRequest,
  PlanningTaskRequirementCreateRequest,
  PlanningTaskRequirementDecisionRequest,
  PlanningTaskRequirementLinkRequest,
  PlanningTaskDateUpdateRequest,
  PlanningTaskUpdateRequest,
} from "./planningContracts";
import type { PlanningOptimizationCreateRequest, PlanningRiskCreateRequest, PlanningWhatIfCreateRequest } from "./analysisTypes";

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

export function addTaskParticipantIntent(token: string, taskId: string, payload: PlanningTaskParticipantCreateRequest) {
  return intent("participant", "Add task participant", { taskId, action: "task_participant_added" }, (etag) => addPlanningTaskParticipant(token, taskId, payload, { ifMatch: etag }));
}

export function removeTaskParticipantIntent(token: string, taskId: string, participantId: string) {
  return intent("participant", "Remove task participant", { taskId, participantId, action: "task_participant_removed" }, (etag) => removePlanningTaskParticipant(token, taskId, participantId, { ifMatch: etag }));
}

export function addTaskRequirementIntent(token: string, taskId: string, payload: PlanningTaskRequirementCreateRequest) {
  return intent("requirement", "Create task gate", { taskId, action: "task_requirement_created" }, (etag) => createPlanningTaskRequirement(token, taskId, payload, { ifMatch: etag }));
}

export function advanceTaskRequirementIntent(token: string, taskId: string, requirementId: string, payload: PlanningTaskRequirementAdvanceRequest) {
  return intent("requirement", "Advance task gate", { taskId, requirementId, action: "task_requirement_advanced" }, (etag) => advancePlanningTaskRequirement(token, taskId, requirementId, payload, { ifMatch: etag }));
}

export function decideTaskRequirementIntent(token: string, taskId: string, requirementId: string, payload: PlanningTaskRequirementDecisionRequest) {
  return intent("requirement-decision", "Decide task gate", { taskId, requirementId, action: "task_requirement_decided" }, (etag) => decidePlanningTaskRequirement(token, taskId, requirementId, payload, { ifMatch: etag }));
}

export function setTaskRequirementLinkIntent(token: string, taskId: string, requirementId: string, payload: PlanningTaskRequirementLinkRequest) {
  return intent("requirement", "Update task gate source", { taskId, requirementId, action: "task_requirement_link_set" }, (etag) => setPlanningTaskRequirementLink(token, taskId, requirementId, payload, { ifMatch: etag }));
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

export function saveResourceCalendarIntent(token: string, projectId: string, resourceId: string, payload: PlanningResourceCalendarUpdateRequest) {
  return intent("resource-calendar", "Edit resource capacity calendar", { action: "resource_calendar_updated" }, (etag) => setPlanningResourceCalendar(token, projectId, resourceId, payload, { ifMatch: etag }));
}

export function levelResourcesIntent(token: string, projectId: string, horizonDays: number) {
  return intent(
    "level",
    "Level resources",
    { action: "resources_leveled" },
    (etag) => planningCommand<PlanningLevelingCommandResult, { project_id: string; horizon_days: number }>(token, "LevelPlanningResources", { project_id: projectId, horizon_days: horizonDays }, "planning-level", { ifMatch: etag }),
    planningLevelHistory,
    levelingSuccessStatus,
  );
}

export function createWhatIfSnapshotIntent(token: string, projectId: string, payload: PlanningWhatIfCreateRequest) {
  return intent(
    "what-if",
    "Create what-if snapshot",
    { action: "what_if_snapshot_created" },
    (etag) => createPlanningWhatIfSnapshot(token, projectId, payload, { ifMatch: etag }),
  );
}

export function runRiskAnalysisIntent(token: string, projectId: string, payload: PlanningRiskCreateRequest) {
  return intent(
    "risk",
    "Run risk analysis",
    { action: "risk_analysis_completed" },
    (etag) => createPlanningRiskAnalysis(token, projectId, payload, { ifMatch: etag }),
  );
}

export function runOptimizationIntent(token: string, projectId: string, payload: PlanningOptimizationCreateRequest) {
  return intent("optimize", "Run bounded optimization", { action: "optimization_completed" }, (etag) => createPlanningOptimization(token, projectId, payload, { ifMatch: etag }));
}

export function decideRecommendationIntent(token: string, projectId: string, recommendationId: string, decision: "approve" | "reject", reason: string) {
  return intent("recommendation-decision", `${decision} recommendation`, { action: "recommendation_decided", decision }, (etag) => decidePlanningRecommendation(token, projectId, recommendationId, decision, reason, { ifMatch: etag }));
}

export function applyRecommendationIntent(token: string, projectId: string, recommendationId: string) {
  return intent("recommendation-apply", "Apply approved recommendation", { action: "recommendation_applied" }, (etag) => applyPlanningRecommendation(token, projectId, recommendationId, { ifMatch: etag }));
}

export function rollbackRecommendationIntent(token: string, projectId: string, recommendationId: string) {
  return intent("recommendation-rollback", "Rollback recommendation", { action: "recommendation_rolled_back" }, (etag) => rollbackPlanningRecommendation(token, projectId, recommendationId, { ifMatch: etag }));
}

export function levelingSuccessStatus(responseData: unknown): Record<string, unknown> {
  const leveling = (responseData as Partial<PlanningLevelingCommandResult> | null)?.leveling;
  return leveling ? { leveling } : {};
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
  successStatus?: PlanningMutationIntent["successStatus"],
): PlanningMutationIntent {
  return { action, label, okStatus, run, history, successStatus };
}

const intent = planningIntent;

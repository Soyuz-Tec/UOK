import type { PlanningBulkTaskUpdate } from "./PlanningBulkEditControls";
import type { PlanningMutationIntent } from "./planningConcurrencyState";
import {
  addBaselineIntent,
  batchTaskUpdatesIntent,
  addDependencyIntent,
  addPlanningLinkIntent,
  addTaskParticipantIntent,
  addTaskRequirementIntent,
  advanceTaskRequirementIntent,
  decideTaskRequirementIntent,
  setTaskRequirementLinkIntent,
  addResourceIntent,
  addTaskIntent,
  assignResourceIntent,
  levelResourcesIntent,
  createWhatIfSnapshotIntent,
  runRiskAnalysisIntent,
  runOptimizationIntent,
  decideRecommendationIntent,
  applyRecommendationIntent,
  rollbackRecommendationIntent,
  removeDependencyIntent,
  removePlanningLinkIntent,
  removeTaskParticipantIntent,
  removeTaskIntent,
  rescheduleTaskIntent,
  saveCalendarIntent,
  saveResourceCalendarIntent,
  saveDependencyIntent,
  saveTaskIntent,
  saveTaskDatesIntent,
} from "./planningMutationIntents";
import { planningTaskMenuMutation, type PlanningTaskMenuAction } from "./planningTaskMenuModel";
import type { PlanningTask } from "./types";
import type { PlanningOptimizationCreateRequest, PlanningRiskCreateRequest, PlanningWhatIfCreateRequest } from "./analysisTypes";
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

export function planningWorkspaceActions({
  token,
  projectId,
  mutate,
  mutateWithOutcome,
  mutateConfirmed,
}: {
  token: string;
  projectId: string;
  mutate: (intent: PlanningMutationIntent) => Promise<void>;
  mutateWithOutcome: (intent: PlanningMutationIntent) => Promise<boolean>;
  mutateConfirmed: (intent: PlanningMutationIntent) => Promise<void>;
}) {
  const actions = {
    rescheduleTask: (taskId: string, start: string, end: string, cascade = true) => mutate(rescheduleTaskIntent(token, taskId, start, end, cascade)),
    saveTask: (taskId: string, payload: PlanningTaskUpdateRequest, cascade = true) => mutate(saveTaskIntent(token, taskId, payload, cascade)),
    saveTaskWithOutcome: (taskId: string, payload: PlanningTaskUpdateRequest, cascade = true) => mutateWithOutcome(saveTaskIntent(token, taskId, payload, cascade)),
    saveTaskDates: (taskId: string, payload: PlanningTaskDateUpdateRequest) => mutate(saveTaskDatesIntent(token, taskId, payload)),
    addTask: (payload: PlanningTaskCreateRequest) => mutate(addTaskIntent(token, projectId, payload)),
    removeTask: (taskId: string) => mutateConfirmed(removeTaskIntent(token, taskId)),
    addDependency: (payload: PlanningDependencyCreateRequest) => mutate(addDependencyIntent(token, projectId, payload)),
    saveDependency: (dependencyId: string, payload: PlanningDependencyUpdateRequest) => mutate(saveDependencyIntent(token, dependencyId, payload)),
    removeDependency: (dependencyId: string) => mutate(removeDependencyIntent(token, dependencyId)),
    addPlanningLink: (payload: PlanningLinkCreateRequest) => mutate(addPlanningLinkIntent(token, projectId, payload)),
    removePlanningLink: (linkId: string) => mutate(removePlanningLinkIntent(token, projectId, linkId)),
    addTaskParticipant: (taskId: string, payload: PlanningTaskParticipantCreateRequest) => mutate(addTaskParticipantIntent(token, taskId, payload)),
    removeTaskParticipant: (taskId: string, participantId: string) => mutate(removeTaskParticipantIntent(token, taskId, participantId)),
    addTaskRequirement: (taskId: string, payload: PlanningTaskRequirementCreateRequest) => mutate(addTaskRequirementIntent(token, taskId, payload)),
    advanceTaskRequirement: (taskId: string, requirementId: string, payload: PlanningTaskRequirementAdvanceRequest) => mutate(advanceTaskRequirementIntent(token, taskId, requirementId, payload)),
    decideTaskRequirement: (taskId: string, requirementId: string, payload: PlanningTaskRequirementDecisionRequest) => mutate(decideTaskRequirementIntent(token, taskId, requirementId, payload)),
    setTaskRequirementLink: (taskId: string, requirementId: string, payload: PlanningTaskRequirementLinkRequest) => mutate(setTaskRequirementLinkIntent(token, taskId, requirementId, payload)),
    saveCalendar: (payload: PlanningCalendarUpdateRequest) => mutate(saveCalendarIntent(token, projectId, payload)),
    addBaseline: (payload: PlanningBaselineCreateRequest) => mutate(addBaselineIntent(token, projectId, payload)),
    addResource: (payload: PlanningResourceCreateRequest) => mutate(addResourceIntent(token, projectId, payload)),
    assignResource: (payload: PlanningAssignmentCreateRequest) => mutate(assignResourceIntent(token, payload)),
    saveResourceCalendar: (resourceId: string, payload: PlanningResourceCalendarUpdateRequest) => mutate(saveResourceCalendarIntent(token, projectId, resourceId, payload)),
    levelResources: (horizonDays: number) => mutate(levelResourcesIntent(token, projectId, horizonDays)),
    createWhatIfSnapshot: (payload: PlanningWhatIfCreateRequest) => mutate(createWhatIfSnapshotIntent(token, projectId, payload)),
    runRiskAnalysis: (payload: PlanningRiskCreateRequest) => mutate(runRiskAnalysisIntent(token, projectId, payload)),
    runOptimization: (payload: PlanningOptimizationCreateRequest) => mutate(runOptimizationIntent(token, projectId, payload)),
    decideRecommendation: (recommendationId: string, decision: "approve" | "reject", reason: string) => mutate(decideRecommendationIntent(token, projectId, recommendationId, decision, reason)),
    applyRecommendation: (recommendationId: string) => mutate(applyRecommendationIntent(token, projectId, recommendationId)),
    rollbackRecommendation: (recommendationId: string) => mutate(rollbackRecommendationIntent(token, projectId, recommendationId)),
    saveTaskBatch: (updates: PlanningBulkTaskUpdate[]) => mutate(batchTaskUpdatesIntent(token, projectId, updates)),
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

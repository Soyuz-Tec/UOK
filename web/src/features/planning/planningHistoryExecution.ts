import {
  assignPlanningResource,
  batchPlanningTaskUpdates,
  createPlanningDependency,
  createPlanningTask,
  deletePlanningTask,
  planningCommand,
  removePlanningDependency,
  setPlanningCalendar,
  updatePlanningDependency,
  updatePlanningTask,
  type PlanningStrongEtag,
} from "./planningApi";
import { findDependencyByMatch, findTaskByMatch, type PlanningHistoryStep } from "./planningHistory";
import type { PlanningSchedule } from "./types";

export function executePlanningHistoryStep(token: string, schedule: PlanningSchedule | null, step: PlanningHistoryStep, etag: PlanningStrongEtag) {
  if (step.kind === "update-task") return updatePlanningTask(token, step.taskId, step.payload, { ifMatch: etag });
  if (step.kind === "create-task") return createPlanningTask(token, step.projectId, step.payload, { ifMatch: etag });
  if (step.kind === "delete-task") return deletePlanningTask(token, resolvedTaskId(schedule, step.taskId, step.match), { ifMatch: etag });
  if (step.kind === "update-dependency") return updatePlanningDependency(token, step.dependencyId, step.payload, { ifMatch: etag });
  if (step.kind === "create-dependency") return createPlanningDependency(token, step.projectId, step.payload, { ifMatch: etag });
  if (step.kind === "remove-dependency") return removePlanningDependency(token, resolvedDependencyId(schedule, step.dependencyId, step.match), { ifMatch: etag });
  if (step.kind === "set-calendar") return setPlanningCalendar(token, step.projectId, step.payload, { ifMatch: etag });
  if (step.kind === "assign-resource") return assignPlanningResource(token, step.payload, { ifMatch: etag });
  return planningCommand<PlanningSchedule, { project_id: string }>(token, "LevelPlanningResources", { project_id: step.projectId }, "planning-level", { ifMatch: etag });
}

export function planningHistoryBatchSupported(steps: PlanningHistoryStep[]) {
  return steps.length >= 1 && steps.length <= 500 && steps.every((step) => step.kind === "update-task");
}

export function executePlanningHistoryBatch(
  token: string,
  schedule: PlanningSchedule,
  steps: PlanningHistoryStep[],
  etag: PlanningStrongEtag,
) {
  if (!planningHistoryBatchSupported(steps)) throw new Error("These history operations are not supported by the atomic task batch endpoint.");
  const updates = steps.map((step) => {
    if (step.kind !== "update-task") throw new Error("History batch contains an unsupported operation.");
    return { taskId: step.taskId, payload: step.payload };
  });
  return batchPlanningTaskUpdates(token, schedule.project.id, updates, { ifMatch: etag });
}

function resolvedTaskId(schedule: PlanningSchedule | null, taskId: string | undefined, match: Record<string, unknown>) {
  if (taskId && schedule?.tasks.some((task) => task.id === taskId)) return taskId;
  const matchedId = schedule ? findTaskByMatch(schedule, match)?.id : "";
  if (!matchedId) throw new Error("Undo task match was not found in the current schedule.");
  return matchedId;
}

function resolvedDependencyId(schedule: PlanningSchedule | null, dependencyId: string | undefined, match: Record<string, unknown>) {
  if (dependencyId && schedule?.dependencies.some((dep) => dep.id === dependencyId)) return dependencyId;
  const matchedId = schedule ? findDependencyByMatch(schedule, match)?.id : "";
  if (!matchedId) throw new Error("Undo dependency match was not found in the current schedule.");
  return matchedId;
}

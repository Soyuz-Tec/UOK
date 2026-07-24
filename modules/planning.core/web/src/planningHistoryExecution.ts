import { type PlanningStrongEtag } from "./planningApi";
import { batchPlanningOperations } from "./planningBatchApi";
import type { PlanningBatchOperation } from "./planningContracts";
import { findDependencyByMatch, type PlanningHistoryStep } from "./planningHistory";
import type { PlanningSchedule } from "./types";

const SUPPORTED_HISTORY_KINDS = new Set<PlanningHistoryStep["kind"]>([
  "update-task",
  "create-dependency",
  "update-dependency",
  "remove-dependency",
  "set-calendar",
  "assign-resource",
  "unassign-resource",
]);

export function planningHistoryBatchSupported(steps: PlanningHistoryStep[]) {
  return steps.length >= 1 && steps.length <= 500 && steps.every((step) => SUPPORTED_HISTORY_KINDS.has(step.kind));
}

export function executePlanningHistoryBatch(
  token: string,
  schedule: PlanningSchedule,
  steps: PlanningHistoryStep[],
  etag: PlanningStrongEtag,
  sourceCommandId: string,
  label: string,
) {
  if (!planningHistoryBatchSupported(steps)) throw new Error("These history operations are not supported by the atomic batch endpoint.");
  const operations = steps.map((step, index) => historyOperation(step, schedule, index));
  return batchPlanningOperations(
    token,
    schedule.project.id,
    { operations, source_command_id: sourceCommandId, reason: label },
    { ifMatch: etag },
  );
}

function historyOperation(step: PlanningHistoryStep, schedule: PlanningSchedule, index: number): PlanningBatchOperation {
  const operation_id = `history-${index + 1}`;
  if (step.kind === "update-task") {
    return { operation_id, kind: "update_task", payload: { task_id: step.taskId, ...withoutRevision(step.payload) } };
  }
  if (step.kind === "create-dependency") {
    assertProject(step.projectId, schedule.project.id);
    const payload = withoutRevision(step.payload);
    return {
      operation_id,
      kind: "create_dependency",
      payload: { ...payload, dependency_type: payload.dependency_type || "finish_to_start", lag_days: payload.lag_days ?? 0 },
    };
  }
  if (step.kind === "update-dependency") {
    return {
      operation_id,
      kind: "update_dependency",
      payload: {
        dependency_id: step.dependencyId,
        ...(step.payload.dependency_type ? { dependency_type: step.payload.dependency_type } : {}),
        ...(step.payload.lag_days !== undefined ? { lag_days: step.payload.lag_days } : {}),
      },
    };
  }
  if (step.kind === "remove-dependency") {
    const current = schedule.dependencies.find((row) => row.id === step.dependencyId)
      || findDependencyByMatch(schedule, step.match);
    if (!current) throw new Error("The dependency represented by this history entry no longer exists.");
    return { operation_id, kind: "remove_dependency", payload: { dependency_id: current.id } };
  }
  if (step.kind === "set-calendar") {
    assertProject(step.projectId, schedule.project.id);
    const payload = withoutRevision(step.payload);
    return { operation_id, kind: "set_calendar", payload: { ...payload, name: payload.name || "Standard" } };
  }
  if (step.kind === "assign-resource") {
    const payload = withoutRevision(step.payload);
    return { operation_id, kind: "assign_resource", payload: { ...payload, allocation_percent: payload.allocation_percent ?? 100 } };
  }
  if (step.kind === "unassign-resource") {
    return { operation_id, kind: "unassign_resource", payload: { task_id: step.taskId, resource_id: step.resourceId } };
  }
  throw new Error("History batch contains an unsupported operation.");
}

function withoutRevision<T extends { expected_revision?: number }>(payload: T): Omit<T, "expected_revision"> {
  const { expected_revision: _ignored, ...current } = payload;
  return current;
}

function assertProject(stepProjectId: string, scheduleProjectId: string) {
  if (stepProjectId !== scheduleProjectId) throw new Error("History operation belongs to another Planning project.");
}

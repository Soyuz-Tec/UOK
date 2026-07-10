import { planningMutationJson, planningMutationKey, type PlanningMutationOptions } from "./planningApi";
import type { PlanningBatchOperation, PlanningBatchRequest, PlanningTaskUpdateRequest } from "./planningContracts";
import type { PlanningSchedule } from "./types";

export type PlanningBatchTaskUpdate = {
  taskId: string;
  payload: Omit<PlanningTaskUpdateRequest, "expected_revision">;
};

export type PlanningBatchResult = {
  correlation_id: string;
  source_command_id: string | null;
  previous_revision: number;
  revision: number;
  operation_results: Array<{ operation_id: string; status: "applied"; object_ids: string[] }>;
  schedule: PlanningSchedule;
};

export function batchPlanningTaskUpdates(
  token: string,
  projectId: string,
  updates: PlanningBatchTaskUpdate[],
  mutation: PlanningMutationOptions,
  history: { sourceCommandId?: string; reason?: string } = {},
) {
  const idempotencyKey = mutation.idempotencyKey || planningMutationKey("planning-task-batch");
  const operations: PlanningBatchOperation[] = updates.map((update, index) => ({
    operation_id: `${index + 1}:${idempotencyKey.slice(-70)}`,
    kind: "update_task" as const,
    payload: { task_id: update.taskId, ...update.payload },
  }));
  return batchPlanningOperations(token, projectId, {
    operations,
    ...(history.sourceCommandId ? { source_command_id: history.sourceCommandId } : {}),
    ...(history.reason ? { reason: history.reason } : {}),
  }, { ...mutation, idempotencyKey });
}

export function batchPlanningOperations(
  token: string,
  projectId: string,
  request: PlanningBatchRequest,
  mutation: PlanningMutationOptions,
) {
  const idempotencyKey = mutation.idempotencyKey || planningMutationKey("planning-batch");
  return planningMutationJson<PlanningBatchResult>(
    token,
    `/api/planning/projects/${projectId}/mutations:batch`,
    { method: "POST", body: JSON.stringify(request) },
    "planning-batch",
    { ...mutation, idempotencyKey },
  );
}

import type { PlanningTaskCreateRequest, PlanningTaskUpdateRequest } from "./planningContracts";

export function taskPayload(
  title: string,
  start: string,
  end: string,
  progress: number,
  sortOrder: number,
  taskType: NonNullable<PlanningTaskCreateRequest["task_type"]> = "task",
  parentTaskId?: string,
): PlanningTaskCreateRequest {
  return { title, start, end, progress, sort_order: sortOrder, task_type: taskType, parent_task_id: parentTaskId };
}

export function resultId(value: unknown) {
  return String((value as { id?: string; result?: { id?: string } }).id || (value as { result?: { id?: string } }).result?.id || "");
}

export function withCascade(payload: PlanningTaskUpdateRequest, cascade: boolean): PlanningTaskUpdateRequest {
  return payload.start || payload.end ? { ...payload, cascade } : payload;
}

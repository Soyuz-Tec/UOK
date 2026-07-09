export function taskPayload(title: string, start: string, end: string, progress: number, sortOrder: number, taskType = "task", parentTaskId?: string) {
  return { title, start, end, progress, sort_order: sortOrder, task_type: taskType, parent_task_id: parentTaskId };
}

export function resultId(value: unknown) {
  return String((value as { id?: string; result?: { id?: string } }).id || (value as { result?: { id?: string } }).result?.id || "");
}

export function withCascade(payload: Record<string, unknown>, cascade: boolean) {
  return payload.start || payload.end ? { ...payload, cascade } : payload;
}

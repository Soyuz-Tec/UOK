import { batchPlanningTaskUpdates, type PlanningStrongEtag } from "./planningApi";
import type { PlanningHistoryStep } from "./planningHistory";
import type { PlanningSchedule } from "./types";

export function planningHistoryBatchSupported(steps: PlanningHistoryStep[]) {
  return steps.length >= 1 && steps.length <= 500 && steps.every((step) => step.kind === "update-task");
}

export function executePlanningHistoryBatch(
  token: string,
  schedule: PlanningSchedule,
  steps: PlanningHistoryStep[],
  etag: PlanningStrongEtag,
  sourceCommandId: string,
  label: string,
) {
  if (!planningHistoryBatchSupported(steps)) throw new Error("These history operations are not supported by the atomic task batch endpoint.");
  const updates = steps.map((step) => {
    if (step.kind !== "update-task") throw new Error("History batch contains an unsupported operation.");
    return { taskId: step.taskId, payload: step.payload };
  });
  return batchPlanningTaskUpdates(
    token,
    schedule.project.id,
    updates,
    { ifMatch: etag },
    { sourceCommandId, reason: label },
  );
}

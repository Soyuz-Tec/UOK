import { planningJson, planningMutationJson, type PlanningMutationOptions } from "./planningApi";
import type { PlanningWhatIfCreateRequest, PlanningWhatIfCreateResult, PlanningWhatIfDetail, PlanningWhatIfMetadata } from "./analysisTypes";

export function listPlanningWhatIfSnapshots(token: string, projectId: string) {
  return planningJson<PlanningWhatIfMetadata[]>(token, `/api/planning/projects/${projectId}/what-if-snapshots`);
}

export function loadPlanningWhatIfSnapshot(token: string, projectId: string, snapshotId: string) {
  return planningJson<PlanningWhatIfDetail>(token, `/api/planning/projects/${projectId}/what-if-snapshots/${snapshotId}`);
}

export function createPlanningWhatIfSnapshot(
  token: string,
  projectId: string,
  payload: PlanningWhatIfCreateRequest,
  mutation: PlanningMutationOptions,
) {
  return planningMutationJson<PlanningWhatIfCreateResult>(
    token,
    `/api/planning/projects/${projectId}/what-if-snapshots`,
    { method: "POST", body: JSON.stringify(payload) },
    "planning-what-if",
    mutation,
  );
}

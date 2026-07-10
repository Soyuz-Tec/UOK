import { planningJson, planningMutationJson, type PlanningMutationOptions } from "./planningApi";
import type { PlanningRiskCreateRequest, PlanningRiskCreateResult, PlanningRiskDetail, PlanningRiskMetadata, PlanningWhatIfCreateRequest, PlanningWhatIfCreateResult, PlanningWhatIfDetail, PlanningWhatIfMetadata } from "./analysisTypes";

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

export function listPlanningRiskAnalyses(token: string, projectId: string) {
  return planningJson<PlanningRiskMetadata[]>(token, `/api/planning/projects/${projectId}/risk-analyses`);
}

export function loadPlanningRiskAnalysis(token: string, projectId: string, runId: string) {
  return planningJson<PlanningRiskDetail>(token, `/api/planning/projects/${projectId}/risk-analyses/${runId}`);
}

export function createPlanningRiskAnalysis(token: string, projectId: string, payload: PlanningRiskCreateRequest, mutation: PlanningMutationOptions) {
  return planningMutationJson<PlanningRiskCreateResult>(
    token,
    `/api/planning/projects/${projectId}/risk-analyses`,
    { method: "POST", body: JSON.stringify(payload) },
    "planning-risk",
    mutation,
  );
}

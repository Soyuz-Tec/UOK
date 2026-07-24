import { planningJson, planningMutationJson, type PlanningMutationOptions } from "./planningApi";
import type { PlanningOptimizationCreateRequest, PlanningOptimizationCreateResult, PlanningOptimizationMetadata, PlanningRecommendation, PlanningRecommendationMutationResult, PlanningRiskCreateRequest, PlanningRiskCreateResult, PlanningRiskDetail, PlanningRiskMetadata, PlanningWhatIfCreateRequest, PlanningWhatIfCreateResult, PlanningWhatIfDetail, PlanningWhatIfMetadata } from "./analysisTypes";

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

export function listPlanningOptimizations(token: string, projectId: string) {
  return planningJson<PlanningOptimizationMetadata[]>(token, `/api/planning/projects/${projectId}/optimizations`);
}

export function listPlanningRecommendations(token: string, projectId: string) {
  return planningJson<PlanningRecommendation[]>(token, `/api/planning/projects/${projectId}/recommendations`);
}

export function createPlanningOptimization(token: string, projectId: string, payload: PlanningOptimizationCreateRequest, mutation: PlanningMutationOptions) {
  return planningMutationJson<PlanningOptimizationCreateResult>(token, `/api/planning/projects/${projectId}/optimizations`, { method: "POST", body: JSON.stringify(payload) }, "planning-optimize", mutation);
}

export function decidePlanningRecommendation(token: string, projectId: string, recommendationId: string, decision: "approve" | "reject", reason: string, mutation: PlanningMutationOptions) {
  return planningMutationJson<PlanningRecommendationMutationResult>(token, `/api/planning/projects/${projectId}/recommendations/${recommendationId}/decision`, { method: "POST", body: JSON.stringify({ decision, reason }) }, "planning-recommendation-decision", mutation);
}

export function applyPlanningRecommendation(token: string, projectId: string, recommendationId: string, mutation: PlanningMutationOptions) {
  return planningMutationJson<PlanningRecommendationMutationResult>(token, `/api/planning/projects/${projectId}/recommendations/${recommendationId}/apply`, { method: "POST", body: "{}" }, "planning-recommendation-apply", mutation);
}

export function rollbackPlanningRecommendation(token: string, projectId: string, recommendationId: string, mutation: PlanningMutationOptions) {
  return planningMutationJson<PlanningRecommendationMutationResult>(token, `/api/planning/projects/${projectId}/recommendations/${recommendationId}/rollback`, { method: "POST", body: "{}" }, "planning-recommendation-rollback", mutation);
}

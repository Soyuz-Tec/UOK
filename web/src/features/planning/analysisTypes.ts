import type { PlanningMutationMetadata } from "./planningContracts";

export type PlanningWhatIfTaskChange = {
  task_id: string;
  start?: string;
  end?: string;
  progress?: number;
};

export type PlanningWhatIfCreateRequest = {
  expected_revision?: number;
  name: string;
  task_changes: PlanningWhatIfTaskChange[];
};

export type PlanningWhatIfMetadata = {
  id: string;
  project_id: string;
  name: string;
  schema_version: 1;
  checksum: string;
  source_revision: number;
  created_by_user_id: string;
  correlation_id: string;
  created_at: string;
  integrity: {
    status: "verified" | "invalid_snapshot" | "checksum_mismatch" | "corrupt" | string;
    verified: boolean;
    algorithm?: "sha256";
    calculated_checksum?: string | null;
    message: string;
  };
};

export type PlanningWhatIfDetail = PlanningWhatIfMetadata & {
  snapshot: {
    schema_version: 1;
    source: { project_id: string; revision: number; captured_at: string };
    proposal: { name: string; task_changes: PlanningWhatIfTaskChange[]; temporary: true };
    approved: Record<string, unknown>;
    preview: {
      tasks: Array<{ id: string; start: string; end: string; duration_days: number; progress: number }>;
      calculation: Record<string, unknown>;
      validation: { ok: boolean; violations: string[]; independent_issue_count: number };
    };
  };
};

export type PlanningWhatIfCreateResult = PlanningMutationMetadata & {
  what_if_snapshot: PlanningWhatIfMetadata;
};

export type PlanningRiskCreateRequest = {
  expected_revision?: number;
  snapshot_id: string;
  seed: number;
  iterations: number;
  task_risks: Array<{
    task_id: string;
    distribution: "triangular";
    minimum_days: number;
    most_likely_days: number;
    maximum_days: number;
    correlation_group?: string;
  }>;
  correlations: Array<{ group: string; coefficient: number }>;
};

export type PlanningRiskMetadata = {
  id: string;
  project_id: string;
  snapshot_id: string;
  analysis_type: "risk";
  status: "completed" | "timeout" | "infeasible";
  engine: { name: string; version: string };
  seed: number;
  checksum: string;
  correlation_id: string;
  created_at: string;
  result_summary: {
    finish_percentiles: Record<"p50" | "p80" | "p90" | "p95", string>;
    probability_on_or_before_target: number;
    sample_count: number;
  };
  integrity: PlanningWhatIfMetadata["integrity"];
};

export type PlanningRiskDetail = PlanningRiskMetadata & {
  inputs: PlanningRiskCreateRequest & { snapshot_checksum: string };
  limits: Record<string, number>;
  result: PlanningRiskMetadata["result_summary"] & {
    duration_percentiles_days: Record<"p50" | "p80" | "p90" | "p95", number>;
    independent_validation: { ok: boolean; violations: Array<Record<string, unknown>> };
  };
};

export type PlanningRiskCreateResult = PlanningMutationMetadata & { risk_analysis: PlanningRiskMetadata };

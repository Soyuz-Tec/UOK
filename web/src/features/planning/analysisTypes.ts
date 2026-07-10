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

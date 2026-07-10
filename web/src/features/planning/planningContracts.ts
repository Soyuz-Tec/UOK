import type { PlanningDependencyType, PlanningLink, PlanningLinkRelationship, PlanningLinkTargetKind, PlanningParticipantRole, PlanningSchedule, PlanningSchedulingMode, PlanningTask, PlanningTaskParticipant, PlanningTaskStatus, PlanningTaskType } from "./types";


export type PlanningMutationMetadata = {
  revision: number;
  correlation_id: string;
};

export type PlanningProjectCreateRequest = {
  name: string;
  start: string;
  end: string;
  timezone?: string;
};

export type PlanningTaskCreateRequest = {
  expected_revision?: number;
  title: string;
  start: string;
  end: string;
  task_type?: PlanningTaskType;
  status?: PlanningTaskStatus;
  progress?: number;
  parent_task_id?: string | null;
  sort_order?: number;
  scheduling_mode?: PlanningSchedulingMode;
  constraint_type?: string | null;
  constraint_date?: string | null;
};

export type PlanningTaskUpdateRequest = Partial<PlanningTaskCreateRequest> & {
  cascade?: boolean;
};

export type PlanningTaskDateUpdateRequest = {
  expected_revision?: number;
  forecast_start?: string | null;
  forecast_end?: string | null;
  actual_start?: string | null;
  actual_end?: string | null;
  deadline?: string | null;
  reason?: string | null;
};

export type PlanningDependencyCreateRequest = {
  expected_revision?: number;
  predecessor_task_id: string;
  successor_task_id: string;
  dependency_type?: PlanningDependencyType;
  lag_days?: number;
};

export type PlanningDependencyUpdateRequest = Pick<PlanningDependencyCreateRequest, "expected_revision" | "dependency_type" | "lag_days">;

export type PlanningCalendarUpdateRequest = {
  expected_revision?: number;
  name?: string;
  working_days?: number[];
  holidays?: string[];
  ignored_periods?: string[];
};

export type PlanningBaselineCreateRequest = { expected_revision?: number; name?: string };
export type PlanningResourceCreateRequest = { expected_revision?: number; name: string; role?: string };
export type PlanningAssignmentCreateRequest = {
  expected_revision?: number;
  task_id: string;
  resource_id: string;
  allocation_percent?: number;
};

export type PlanningLinkCreateRequest = {
  expected_revision?: number;
  scope_type: "project" | "task";
  task_id?: string | null;
  relationship: PlanningLinkRelationship;
  blocking?: boolean;
  target: { kind: PlanningLinkTargetKind; id: string };
};

export type PlanningTaskParticipantCreateRequest = {
  expected_revision?: number;
  party_id: string;
  role: PlanningParticipantRole;
};

export type PlanningTaskCreateResult = PlanningTask & PlanningMutationMetadata;
export type PlanningTaskUpdateResult = PlanningMutationMetadata & {
  task: PlanningTask;
  validation: PlanningSchedule["validation"];
};
export type PlanningScheduleMutationResult = PlanningSchedule & PlanningMutationMetadata;
export type PlanningLinkCreateResult = PlanningLink & PlanningMutationMetadata;
export type PlanningLinkRemoveResult = PlanningMutationMetadata & { id: string; project_id: string; removed: true };
export type PlanningTaskParticipantCreateResult = PlanningTaskParticipant & PlanningMutationMetadata;
export type PlanningTaskParticipantRemoveResult = PlanningMutationMetadata & { id: string; project_id: string; task_id: string; removed: true };

export type PlanningDomainErrorDetail = {
  code: string;
  message: string;
  field: string | null;
  object_ids: string[];
  repair: string;
  current_revision: number | null;
  correlation_id: string | null;
};

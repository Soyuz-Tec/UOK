import type { Appearance, ModuleStatus } from "../../shared/types";
import type { PlanningCapacityUnit, PlanningResourceCalendar, PlanningResourceCanonicalKind, PlanningResourceType } from "./resourceTypes";
import type { PlanningCapabilities } from "./planningCapabilities";
export type { PlanningCapacityUnit, PlanningResourceCalendar, PlanningResourceCanonicalKind, PlanningResourceType } from "./resourceTypes";
export type { PlanningCapabilities } from "./planningCapabilities";

export type PlanningProjectStatus = "draft" | "active" | "on_hold" | "completed" | "archived";

export type PlanningProject = {
  id: string;
  name: string;
  status: PlanningProjectStatus;
  start: string;
  end: string;
  target_finish: string;
  calculated_finish: string;
  timezone?: string;
  revision: number;
  updated_at?: string | null;
};

export type PlanningTaskType = "task" | "summary" | "milestone";
export type PlanningSchedulingMode = "auto" | "manual";
export type PlanningDependencyType = "finish_to_start" | "start_to_start" | "finish_to_finish" | "start_to_finish";
export type PlanningTaskStatus = "planned" | "in_progress" | "blocked" | "complete";
export type PlanningLinkTargetKind = "operation" | "gate" | "evidence" | "party" | "shipment" | "document" | "location" | "asset" | "agreement" | "communication_thread" | "calendar_event";
export type PlanningLinkRelationship = "implements" | "blocks_on" | "requires" | "proves" | "owned_by" | "moves" | "occurs_at" | "discussed_in" | "publishes_to";
export type PlanningParticipantRole = "owner" | "assignee" | "approver" | "consulted" | "informed" | "external_contact";
export type PlanningRequirementType = "evidence" | "approval" | "compliance" | "finance" | "shipment" | "document" | "custom";
export type PlanningRequirementState = "missing" | "submitted" | "under_review" | "satisfied" | "rejected" | "waived";
export type PlanningReadiness = {
  ready: boolean;
  required_count: number;
  blocking_count: number;
  blocking_requirement_ids: string[];
};

export type PlanningTask = {
  id: string;
  project_id: string;
  version: number;
  parent_task_id?: string | null;
  wbs?: string;
  title: string;
  task_type: PlanningTaskType;
  status: PlanningTaskStatus;
  start: string;
  end: string;
  planned_start?: string;
  planned_end?: string;
  forecast_start?: string | null;
  forecast_end?: string | null;
  actual_start?: string | null;
  actual_end?: string | null;
  deadline?: string | null;
  forecast_start_variance_days?: number | null;
  forecast_end_variance_days?: number | null;
  actual_start_variance_days?: number | null;
  actual_end_variance_days?: number | null;
  deadline_variance_days?: number | null;
  participant_ids?: string[];
  participant_roles?: PlanningParticipantRole[];
  readiness?: PlanningReadiness;
  duration_days: number;
  progress: number;
  sort_order: number;
  critical: boolean;
  early_start?: string;
  early_finish?: string;
  late_start?: string;
  late_finish?: string;
  total_slack_days?: number;
  free_float_days?: number;
  baseline_start?: string | null;
  baseline_end?: string | null;
  start_variance_days?: number | null;
  end_variance_days?: number | null;
  scheduling_mode?: PlanningSchedulingMode | null;
  constraint_type?: string | null;
  constraint_date?: string | null;
};

export type PlanningDependency = {
  id: string;
  project_id: string;
  predecessor_task_id: string;
  successor_task_id: string;
  dependency_type: PlanningDependencyType;
  lag_days: number;
};

export type PlanningCalendar = {
  id?: string;
  name: string;
  working_days: number[];
  holidays: string[];
  ignored_periods?: Array<{ start: string; end: string }>;
};

export type PlanningAvailability = {
  source_module: "calendar.core" | string;
  scope: string;
  status: "ready" | "unavailable" | string;
  from: string;
  to: string;
  reason?: string;
  warnings?: string[];
  correlation?: { party_count: number; task_count: number };
  busy: Array<{ event_id: string; start: string; end: string; title: string; participant_ids?: string[]; task_ids?: string[] }>;
  events: Array<Record<string, unknown>>;
};

export type PlanningResource = {
  id: string;
  project_id: string;
  name: string;
  role: string;
  resource_type: PlanningResourceType;
  capacity_value: number;
  capacity_unit: PlanningCapacityUnit;
  canonical_target_kind: PlanningResourceCanonicalKind | null;
  canonical_target_id: string | null;
  canonical_resolution: Pick<PlanningLink["resolution"], "status" | "display_label" | "status_summary" | "open_path"> | null;
  effective_start: string | null;
  effective_end: string | null;
  calendar: PlanningResourceCalendar | null;
};

export type PlanningAssignment = {
  id: string;
  task_id: string;
  resource_id: string;
  allocation_percent: number;
};

export type PlanningLink = {
  id: string;
  project_id: string;
  task_id?: string | null;
  scope_type: "project" | "task";
  relationship: PlanningLinkRelationship;
  blocking: boolean;
  target: {
    kind: PlanningLinkTargetKind;
    id: string | null;
    resolver: string;
    resolver_version: string;
  };
  resolution: {
    status: "ready" | "unavailable" | "denied" | "missing";
    display_label: string | null;
    status_summary: string;
    checked_at: string;
    open_path: string | null;
  };
  created_at: string;
  updated_at: string;
};

export type PlanningTaskParticipant = {
  id: string;
  project_id: string;
  task_id: string;
  role: PlanningParticipantRole;
  source_module: "contacts.core";
  party: { id: string | null; resolver: "contacts.party"; resolver_version: "1" };
  resolution: {
    status: "ready" | "unavailable" | "denied" | "missing";
    display_label: string | null;
    status_summary: string;
    checked_at: string;
    open_path: string | null;
  };
  created_at: string;
  updated_at: string;
};

export type PlanningPartyOption = { id: string; display_name: string; status: string };

export type PlanningTaskRequirement = {
  id: string;
  project_id: string;
  task_id: string;
  requirement_type: PlanningRequirementType;
  title: string;
  state: PlanningRequirementState;
  required: boolean;
  blocking: boolean;
  target_link_id: string | null;
  target_link_state: "ready" | "unavailable" | "denied" | "missing" | "unlinked";
  due: string | null;
  decision_reason: string | null;
  decided_by_actor_id: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PlanningBaseline = {
  id: string;
  project_id: string;
  name: string;
  schema_version: number;
  completeness: "partial" | "complete";
  checksum?: string | null;
  source_revision?: number | null;
  created_by_user_id?: string | null;
  correlation_id?: string | null;
  created_at: string;
  integrity: {
    status: "partial" | "verified" | "checksum_mismatch" | "corrupt" | string;
    verified: boolean;
    algorithm?: "sha256" | null;
    calculated_checksum?: string;
    missing_facts: string[];
    message: string;
  };
};

export type PlanningBaselineDetail = PlanningBaseline & {
  snapshot: Record<string, unknown>;
};

export type PlanningBaselineComparison = {
  project_id: string;
  supported: boolean;
  left: PlanningBaseline;
  right: PlanningBaseline;
  limitations: string[];
  changes: Record<string, unknown> | null;
};

export type PlanningSchedule = {
  project: PlanningProject;
  capabilities?: PlanningCapabilities;
  tasks: PlanningTask[];
  dependencies: PlanningDependency[];
  calendar?: PlanningCalendar;
  availability?: PlanningAvailability;
  resources: PlanningResource[];
  assignments: PlanningAssignment[];
  links: PlanningLink[];
  participants?: PlanningTaskParticipant[];
  requirements?: PlanningTaskRequirement[];
  readiness?: PlanningReadiness & { task_blocker_count: number };
  date_semantics?: {
    precision: "calendar_date";
    project_timezone: string;
    storage_timezone: "UTC";
    planned: { fields: string[]; authority: "scheduler" };
    forecast: { fields: string[]; authority: "planner" };
    actual: { fields: string[]; authority: "explicit_fact_with_reason" };
    deadline: { fields: string[]; authority: "planner_commitment" };
    subday_scales: "visual_only";
  };
  baselines: PlanningBaseline[];
  calculation?: {
    engine_version: string;
    project_start: string;
    calculated_finish: string;
    target_finish: string;
    target_variance_days: number;
    independent_validation: {
      ok: boolean;
      violations: Array<{ code: string; message: string; object_ids: string[] }>;
    };
    resource_capacity?: {
      engine_version: string;
      default_capacity_percent: number;
      load_points: Array<{
        resource_id: string;
        date: string;
        allocation_percent: number;
        capacity_percent: number;
        task_ids: string[];
        overallocated: boolean;
      }>;
      overallocated_count: number;
      independent_validation: {
        ok: boolean;
        violations: Array<{ code: string; message: string; object_ids: string[] }>;
      };
    };
  };
  validation: { ok: boolean; violations: string[]; warnings?: string[] };
};

export type PlanningWorkspaceProps = {
  token: string;
  appearance: Appearance;
  module?: ModuleStatus;
  moduleRows: ModuleStatus[];
  busyAction: string;
  onActivate: (moduleName?: string, action?: "install" | "enable") => void;
};

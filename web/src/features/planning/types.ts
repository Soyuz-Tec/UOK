import type { Appearance, ModuleStatus } from "../../shared/types";

export type PlanningProject = {
  id: string;
  name: string;
  status: string;
  start: string;
  end: string;
  updated_at?: string | null;
};

export type PlanningTask = {
  id: string;
  project_id: string;
  parent_task_id?: string | null;
  wbs?: string;
  title: string;
  task_type: "task" | "summary" | "milestone" | string;
  status: string;
  start: string;
  end: string;
  duration_days: number;
  progress: number;
  sort_order: number;
  critical: boolean;
  early_start?: string;
  early_finish?: string;
  late_start?: string;
  late_finish?: string;
  total_slack_days?: number;
  baseline_start?: string | null;
  baseline_end?: string | null;
  start_variance_days?: number | null;
  end_variance_days?: number | null;
  scheduling_mode?: "auto" | "manual" | string | null;
  constraint_type?: string | null;
  constraint_date?: string | null;
};

export type PlanningDependency = {
  id: string;
  project_id: string;
  predecessor_task_id: string;
  successor_task_id: string;
  dependency_type: string;
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
  busy: Array<{ event_id: string; start: string; end: string; title: string }>;
  events: Array<Record<string, unknown>>;
};

export type PlanningResource = {
  id: string;
  project_id: string;
  name: string;
  role: string;
};

export type PlanningAssignment = {
  id: string;
  task_id: string;
  resource_id: string;
  allocation_percent: number;
};

export type PlanningBaseline = {
  id: string;
  project_id: string;
  name: string;
  created_at: string;
};

export type PlanningSchedule = {
  project: PlanningProject;
  tasks: PlanningTask[];
  dependencies: PlanningDependency[];
  calendar?: PlanningCalendar;
  availability?: PlanningAvailability;
  resources: PlanningResource[];
  assignments: PlanningAssignment[];
  baselines: PlanningBaseline[];
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

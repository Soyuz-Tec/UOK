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
  title: string;
  task_type: "task" | "summary" | "milestone" | string;
  status: string;
  start: string;
  end: string;
  duration_days: number;
  progress: number;
  sort_order: number;
  critical: boolean;
};

export type PlanningDependency = {
  id: string;
  project_id: string;
  predecessor_task_id: string;
  successor_task_id: string;
  dependency_type: string;
  lag_days: number;
};

export type PlanningSchedule = {
  project: PlanningProject;
  tasks: PlanningTask[];
  dependencies: PlanningDependency[];
  validation: { ok: boolean; violations: string[] };
};

export type PlanningWorkspaceProps = {
  token: string;
  appearance: Appearance;
  module?: ModuleStatus;
  busyAction: string;
  onActivate: () => void;
};

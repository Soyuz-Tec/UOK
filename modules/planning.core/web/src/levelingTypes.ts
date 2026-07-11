import type { PlanningSchedule } from "./types";

export type PlanningLevelingOutcome = "leveled" | "partially_leveled" | "infeasible";

export type PlanningLevelingReason = {
  code: string;
  message: string;
  task_ids: string[];
  resource_ids: string[];
  date: string;
};

export type PlanningLevelingResult = {
  engine_version: string;
  strategy: "simple_forward" | string;
  outcome: PlanningLevelingOutcome;
  horizon_days: number;
  passes: number;
  initial_overload_count: number;
  changed_task_ids: string[];
  remaining_overloads: Array<{
    resource_id: string;
    date: string;
    allocation_percent: number;
    capacity_percent: number;
    task_ids: string[];
    overallocated: true;
  }>;
  reasons: PlanningLevelingReason[];
  independent_validation: {
    ok: boolean;
    violations: Array<{ code: string; message: string; object_ids: string[] }>;
  };
};

export type PlanningLevelingCommandResult = PlanningSchedule & {
  leveling: PlanningLevelingResult;
};

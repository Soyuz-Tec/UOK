export type PlanningPortfolioHealth = "on_track" | "attention" | "blocked";

export type PlanningPortfolioProject = {
  id: string;
  name: string;
  status: string;
  start: string;
  end: string;
  timezone: string;
  revision: number;
  updated_at: string | null;
  metrics: {
    task_count: number;
    completed_task_count: number;
    in_progress_task_count: number;
    blocked_task_count: number;
    milestone_count: number;
    dependency_count: number;
    completion_percent: number;
  };
  attention: {
    health: PlanningPortfolioHealth;
    overdue_task_count: number;
    gate_blocker_count: number;
    unavailable_blocking_link_count: number;
    project_overdue: boolean;
    issue_count: number;
  };
};

export type PlanningPortfolioResponse = {
  total: number;
  limit: number;
  offset: number;
  query: string;
  status: string;
  projects: PlanningPortfolioProject[];
  summary: {
    visible_project_count: number;
    total_project_count: number;
    task_count: number;
    completed_task_count: number;
    blocked_task_count: number;
    overdue_task_count: number;
    gate_blocker_count: number;
    at_risk_project_count: number;
    status_counts: Record<string, number>;
    range_start: string | null;
    range_end: string | null;
  };
  diagnostics: {
    strategy: "bounded_aggregate_v1";
    query_count: number;
    elapsed_ms: number;
  };
};

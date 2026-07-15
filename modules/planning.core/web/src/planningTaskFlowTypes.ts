export type PlanningTaskStatus = "planned" | "in_progress" | "blocked" | "complete";

export type PlanningTaskFlowStatus = {
  status: PlanningTaskStatus;
  display_label: string;
  allowed_transitions: PlanningTaskStatus[];
};

export type PlanningTaskFlow = {
  schema_version: 1;
  statuses: PlanningTaskFlowStatus[];
};

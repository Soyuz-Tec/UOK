import { EmptyState } from "@uok/shared/data-display";

type PlanningGanttEmptyStateProps = {
  variant: "grid" | "timeline";
};

export function PlanningGanttEmptyState({ variant }: PlanningGanttEmptyStateProps) {
  const label = variant === "grid" ? "No visible planning grid tasks" : "No visible planning timeline tasks";

  return <EmptyState ariaLabel={label} className={`planning-owned-empty-state ${variant}`} title="No visible tasks" text="Clear filters or add a task to build the schedule." />;
}

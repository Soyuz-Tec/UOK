type PlanningGanttEmptyStateProps = {
  variant: "grid" | "timeline";
};

export function PlanningGanttEmptyState({ variant }: PlanningGanttEmptyStateProps) {
  const label = variant === "grid" ? "No visible planning grid tasks" : "No visible planning timeline tasks";

  return (
    <div className={`planning-owned-empty-state ${variant}`} aria-label={label}>
      <strong>No visible tasks</strong>
      <span>Clear filters or add a task to build the schedule.</span>
    </div>
  );
}

import { StatusPill } from "@uok/shared/data-display";
import type { PlanningAssignment, PlanningResource, PlanningTask } from "./types";

export function PlanningTaskGrid({ tasks, resources, assignments, selectedTaskId, onSelect }: {
  tasks: PlanningTask[];
  resources?: PlanningResource[];
  assignments?: PlanningAssignment[];
  selectedTaskId: string;
  onSelect: (taskId: string) => void;
}) {
  const resourceNames = new Map((resources || []).map((resource) => [resource.id, resource.name]));
  const assignmentsByTask = new Map<string, string[]>();
  (assignments || []).forEach((assignment) => {
    const label = `${resourceNames.get(assignment.resource_id) || "Resource"} ${assignment.allocation_percent}%`;
    assignmentsByTask.set(assignment.task_id, [...(assignmentsByTask.get(assignment.task_id) || []), label]);
  });

  return (
    <div className="planning-task-grid-wrap">
      <table className="planning-task-grid" aria-label="Planning tasks">
        <thead>
          <tr>
            <th>WBS</th>
            <th>Task</th>
            <th>Type</th>
            <th>Planned start</th>
            <th>Planned end</th>
            <th>Baseline</th>
            <th>Slack</th>
            <th>Resources</th>
            <th>Progress</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr
              key={task.id}
              className={selectedTaskId === task.id ? "selected" : ""}
              tabIndex={0}
              aria-selected={selectedTaskId === task.id}
              onClick={() => onSelect(task.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(task.id);
                }
              }}
            >
              <td>{task.wbs || "-"}</td>
              <td>
                <strong style={{ paddingInlineStart: `${Math.max(0, (task.wbs?.split(".").length || 1) - 1) * 14}px` }}>{task.title}</strong>
                {task.critical && <span className="planning-critical-label">Critical</span>}
              </td>
              <td>{task.task_type}</td>
              <td>{task.start}</td>
              <td>{task.end}</td>
              <td>{formatVariance(task.start_variance_days, task.end_variance_days)}</td>
              <td>{task.total_slack_days ?? 0}d</td>
              <td>{assignmentsByTask.get(task.id)?.join(", ") || "-"}</td>
              <td>{task.progress}%</td>
              <td><StatusPill label={task.status} tone={task.status === "blocked" ? "warning" : "info"} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatVariance(start?: number | null, end?: number | null) {
  if (start == null && end == null) return "-";
  return `S ${signed(start || 0)} / F ${signed(end || 0)}`;
}

function signed(value: number) {
  return value > 0 ? `+${value}d` : `${value}d`;
}

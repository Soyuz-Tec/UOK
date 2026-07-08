import { StatusPill } from "../../shared/data-display";
import type { PlanningTask } from "./types";

export function PlanningTaskGrid({ tasks, selectedTaskId, onSelect }: {
  tasks: PlanningTask[];
  selectedTaskId: string;
  onSelect: (taskId: string) => void;
}) {
  return (
    <div className="planning-task-grid-wrap">
      <table className="planning-task-grid" aria-label="Planning tasks">
        <thead>
          <tr>
            <th>Task</th>
            <th>Start</th>
            <th>End</th>
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
              <td>
                <strong>{task.title}</strong>
                {task.critical && <span className="planning-critical-label">Critical</span>}
              </td>
              <td>{task.start}</td>
              <td>{task.end}</td>
              <td>{task.progress}%</td>
              <td><StatusPill label={task.status} tone={task.status === "blocked" ? "warning" : "info"} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

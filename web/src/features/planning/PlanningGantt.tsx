import { Gantt, Willow, WillowDark, type ILink, type ITask } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";

import type { Appearance } from "../../shared/types";
import type { PlanningSchedule } from "./types";

export function PlanningGantt({ schedule, appearance, onTaskReschedule }: {
  schedule: PlanningSchedule;
  appearance: Appearance;
  onTaskReschedule: (taskId: string, start: string, end: string) => void;
}) {
  const tasks: Partial<ITask>[] = schedule.tasks.map((task) => ({
    id: task.id,
    text: task.title,
    start: dateValue(task.start),
    end: dateValue(task.end),
    duration: task.duration_days,
    progress: task.progress,
    type: task.task_type === "milestone" ? "milestone" : task.task_type === "summary" ? "summary" : "task",
    parent: task.parent_task_id || 0,
    css: task.critical ? "planning-gantt-critical" : undefined,
  }));
  const links: ILink[] = schedule.dependencies.map((dependency) => ({
    id: dependency.id,
    source: dependency.predecessor_task_id,
    target: dependency.successor_task_id,
    type: linkType(dependency.dependency_type),
  }));
  const Theme = appearance === "dark" ? WillowDark : Willow;

  return (
    <div className="planning-gantt-shell" aria-label="Planning Gantt chart">
      <Theme fonts={false}>
        <Gantt
          tasks={tasks}
          links={links}
          columns={[
            { id: "text", header: "Task", width: 220 },
            { id: "start", header: "Start", width: 112 },
            { id: "end", header: "End", width: 112 },
          ]}
          cellBorders="column"
          onupdatetask={(event) => {
            if (event?.inProgress || !event?.task?.start || !event?.task?.end) return;
            onTaskReschedule(String(event.id), toIsoDate(event.task.start), toIsoDate(event.task.end));
          }}
        />
      </Theme>
    </div>
  );
}

function dateValue(value: string) {
  return new Date(`${value}T00:00:00`);
}

function toIsoDate(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value));
  return date.toISOString().slice(0, 10);
}

function linkType(type: string) {
  if (type === "start_to_start") return "s2s";
  if (type === "finish_to_finish") return "e2e";
  if (type === "start_to_finish") return "s2e";
  return "e2s";
}

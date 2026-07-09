import { Gantt, Willow, WillowDark, type ILink, type IScaleConfig, type ITask } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";

import type { Appearance } from "../../shared/types";
import type { PlanningSchedule } from "./types";

export function PlanningGantt({
  schedule,
  appearance,
  scale,
  showCritical,
  showBaselines,
  selectedTaskId,
  onTaskSelect,
  onTaskReschedule,
}: {
  schedule: PlanningSchedule;
  appearance: Appearance;
  scale: "day" | "week" | "month";
  showCritical: boolean;
  showBaselines: boolean;
  selectedTaskId: string;
  onTaskSelect: (taskId: string) => void;
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
    open: task.task_type === "summary" ? true : undefined,
    base_start: task.baseline_start ? dateValue(task.baseline_start) : undefined,
    base_duration: task.baseline_start && task.baseline_end ? baselineDuration(task.baseline_start, task.baseline_end) : undefined,
    css: showCritical && task.critical ? "planning-gantt-critical" : undefined,
  }));
  const links: ILink[] = schedule.dependencies.map((dependency) => ({
    id: dependency.id,
    source: dependency.predecessor_task_id,
    target: dependency.successor_task_id,
    type: linkType(dependency.dependency_type),
  }));
  const Theme = appearance === "dark" ? WillowDark : Willow;
  const layout = ganttLayout(scale);

  return (
    <div className="planning-gantt-shell" aria-label="Planning Gantt chart">
      <Theme fonts={false}>
        <Gantt
          tasks={tasks}
          links={links}
          selected={selectedTaskId ? [selectedTaskId] : []}
          baselines={showBaselines}
          scales={scaleConfig(scale)}
          lengthUnit={scale === "month" ? "week" : "day"}
          cellWidth={layout.cellWidth}
          cellHeight={50}
          scaleHeight={44}
          gridWidth={layout.gridWidth}
          markers={[{ start: new Date(), text: "Today", css: "planning-gantt-today" }]}
          start={dateValue(schedule.project.start)}
          end={dateValue(schedule.project.end)}
          columns={[
            { id: "text", header: "Task", width: 220 },
            { id: "start", header: "Start", width: 92 },
            { id: "end", header: "End", width: 92 },
            { id: "duration", header: "Dur.", width: 48 },
            { id: "progress", header: "%", width: 44 },
          ]}
          cellBorders="column"
          onselecttask={(event) => {
            if (event?.id) onTaskSelect(String(event.id));
          }}
          onupdatetask={(event) => {
            if (event?.inProgress || !event?.task?.start || !event?.task?.end) return;
            onTaskReschedule(String(event.id), toIsoDate(event.task.start), toIsoDate(event.task.end));
          }}
        />
      </Theme>
    </div>
  );
}

function ganttLayout(scale: "day" | "week" | "month") {
  if (scale === "month") return { cellWidth: 96, gridWidth: 500 };
  if (scale === "week") return { cellWidth: 76, gridWidth: 500 };
  return { cellWidth: 60, gridWidth: 500 };
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

function baselineDuration(start: string, end: string) {
  const startDate = dateValue(start);
  const endDate = dateValue(end);
  return Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1);
}

function scaleConfig(scale: "day" | "week" | "month"): IScaleConfig[] {
  if (scale === "month") {
    return [
      { unit: "year", step: 1, format: (date) => String(date.getFullYear()) },
      { unit: "month", step: 1, format: (date) => date.toLocaleString("en-US", { month: "short" }) },
    ];
  }
  if (scale === "week") {
    return [
      { unit: "month", step: 1, format: (date) => date.toLocaleString("en-US", { month: "long", year: "numeric" }) },
      { unit: "week", step: 1, format: (date) => `W${weekNumber(date)}` },
    ];
  }
  return [
    { unit: "month", step: 1, format: (date) => date.toLocaleString("en-US", { month: "long", year: "numeric" }) },
    { unit: "day", step: 1, format: (date) => String(date.getDate()) },
  ];
}

function weekNumber(value: Date) {
  const first = new Date(value.getFullYear(), 0, 1);
  return Math.ceil((((value.getTime() - first.getTime()) / 86_400_000) + first.getDay() + 1) / 7);
}

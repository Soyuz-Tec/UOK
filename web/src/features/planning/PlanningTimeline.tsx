import { Baseline, CalendarClock, Flag, Link2, Maximize2, Milestone, Plus, Users } from "lucide-react";

import { CommandButton } from "../../shared/primitives";
import type { Appearance } from "../../shared/types";
import { PlanningGantt } from "./PlanningGantt";
import type { PlanningSchedule } from "./types";

export function PlanningTimeline({
  schedule,
  appearance,
  scale,
  showCritical,
  showBaselines,
  selectedTaskId,
  onScaleChange,
  onToggleCritical,
  onToggleBaselines,
  onTaskSelect,
  onTaskReschedule,
  onNewTask,
  onOpenDependencies,
  onCreateBaseline,
  onOpenResources,
}: {
  schedule: PlanningSchedule;
  appearance: Appearance;
  scale: "day" | "week" | "month";
  showCritical: boolean;
  showBaselines: boolean;
  selectedTaskId: string;
  onScaleChange: (scale: "day" | "week" | "month") => void;
  onToggleCritical: () => void;
  onToggleBaselines: () => void;
  onTaskSelect: (taskId: string) => void;
  onTaskReschedule: (taskId: string, start: string, end: string) => void;
  onNewTask: (taskType: "task" | "milestone") => void;
  onOpenDependencies: () => void;
  onCreateBaseline: () => void;
  onOpenResources: () => void;
}) {
  return (
    <div className="planning-timeline-workbench">
      <div className="planning-gantt-toolbar" aria-label="Gantt toolbar">
        <div className="planning-toolbar-group" aria-label="Schedule commands">
          <CommandButton icon={Plus} onClick={() => onNewTask("task")} primary>Task</CommandButton>
          <CommandButton icon={Milestone} onClick={() => onNewTask("milestone")}>Milestone</CommandButton>
          <CommandButton icon={Link2} onClick={onOpenDependencies}>Link</CommandButton>
          <CommandButton icon={Baseline} onClick={onCreateBaseline}>Baseline</CommandButton>
          <CommandButton icon={Users} onClick={onOpenResources}>Resources</CommandButton>
        </div>
        <div className="planning-toolbar-group" aria-label="Timeline controls">
          <div className="planning-segmented-control" aria-label="Timeline scale">
            {(["day", "week", "month"] as const).map((item) => (
              <button key={item} type="button" className={scale === item ? "selected" : ""} onClick={() => onScaleChange(item)}>
                {item}
              </button>
            ))}
          </div>
          <button type="button" className="planning-toolbar-toggle" onClick={() => onScaleChange("day")}>
            <CalendarClock size={16} aria-hidden="true" />
            <span>Today</span>
          </button>
          <button type="button" className="planning-toolbar-toggle" onClick={() => onScaleChange("month")}>
            <Maximize2 size={16} aria-hidden="true" />
            <span>Fit</span>
          </button>
          <button type="button" className={`planning-toolbar-toggle ${showCritical ? "selected" : ""}`} aria-pressed={showCritical} onClick={onToggleCritical}>
            <Flag size={16} aria-hidden="true" />
            <span>Critical</span>
          </button>
          <button type="button" className={`planning-toolbar-toggle ${showBaselines ? "selected" : ""}`} aria-pressed={showBaselines} onClick={onToggleBaselines}>
            <Baseline size={16} aria-hidden="true" />
            <span>Baselines</span>
          </button>
        </div>
      </div>
      <PlanningGantt
        schedule={schedule}
        appearance={appearance}
        scale={scale}
        showCritical={showCritical}
        showBaselines={showBaselines}
        selectedTaskId={selectedTaskId}
        onTaskSelect={onTaskSelect}
        onTaskReschedule={onTaskReschedule}
      />
    </div>
  );
}

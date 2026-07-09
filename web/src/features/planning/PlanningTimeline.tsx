import { Baseline, CalendarClock, Flag, FolderKanban, Link2, Maximize2, Milestone, Plus, RefreshCw, Users } from "lucide-react";

import { CommandButton } from "../../shared/primitives";
import type { Appearance } from "../../shared/types";
import { PlanningGantt } from "./PlanningGantt";
import type { PlanningProject, PlanningSchedule } from "./types";

const planningViews = ["Gantt chart", "Board", "List", "Calendar", "Workload", "People", "Dashboard"] as const;

export function PlanningTimeline({
  projects,
  schedule,
  appearance,
  scale,
  showCritical,
  showBaselines,
  selectedTaskId,
  selectedProjectId,
  busy,
  onScaleChange,
  onToggleCritical,
  onToggleBaselines,
  onTaskSelect,
  onTaskReschedule,
  onProjectChange,
  onCreateDemoSchedule,
  onRefresh,
  onNewTask,
  onOpenDependencies,
  onCreateBaseline,
  onOpenResources,
}: {
  projects: PlanningProject[];
  schedule: PlanningSchedule;
  appearance: Appearance;
  scale: "day" | "week" | "month";
  showCritical: boolean;
  showBaselines: boolean;
  selectedTaskId: string;
  selectedProjectId: string;
  busy: string;
  onScaleChange: (scale: "day" | "week" | "month") => void;
  onToggleCritical: () => void;
  onToggleBaselines: () => void;
  onTaskSelect: (taskId: string) => void;
  onTaskReschedule: (taskId: string, start: string, end: string) => void;
  onProjectChange: (projectId: string) => void;
  onCreateDemoSchedule: () => void;
  onRefresh: () => void;
  onNewTask: (taskType: "task" | "milestone") => void;
  onOpenDependencies: () => void;
  onCreateBaseline: () => void;
  onOpenResources: () => void;
}) {
  return (
    <div className="planning-timeline-workbench">
      <div className="planning-gantt-toolbar" aria-label="Gantt toolbar">
        <div className="planning-toolbar-title">
          <span className="eyebrow">Planning</span>
          <h2>Project schedule</h2>
          <span>{schedule.tasks.length} tasks, {schedule.dependencies.length} dependencies</span>
        </div>
        <label className="planning-project-picker">
          <span>Project</span>
          <select value={selectedProjectId} onChange={(event) => onProjectChange(event.target.value)}>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>
        <div className="planning-toolbar-group planning-plan-actions" aria-label="Plan actions">
          <CommandButton icon={FolderKanban} onClick={onCreateDemoSchedule} loading={busy === "demo"}>
            New sample plan
          </CommandButton>
          <CommandButton icon={RefreshCw} onClick={onRefresh} loading={busy === "refresh"}>
            Refresh
          </CommandButton>
        </div>
        <nav className="planning-view-tabs" aria-label="Planning views">
          {planningViews.map((view) => {
            const isCurrent = view === "Gantt chart";
            return (
              <button
                key={view}
                type="button"
                className={isCurrent ? "selected" : ""}
                aria-current={isCurrent ? "page" : undefined}
                aria-disabled={isCurrent ? undefined : "true"}
                tabIndex={isCurrent ? 0 : -1}
              >
                {view}
              </button>
            );
          })}
        </nav>
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

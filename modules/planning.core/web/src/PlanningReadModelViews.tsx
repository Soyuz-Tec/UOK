import type { PlanningSchedule } from "./types";
import type { PlanningTaskUpdateRequest } from "./planningContracts";
import type { PlanningView } from "./planningTimelineModel";
import { planningCriticalPathSummary, planningTargetVarianceLabel } from "./planningCriticalPathModel";
import { planningResourceWorkloads } from "./planningWorkloadModel";
import { PlanningFlowBoard } from "./PlanningFlowBoard";
import { PlanningScheduleList } from "./PlanningScheduleList";

export function PlanningReadModelView({
  view,
  busy = false,
  readOnly = false,
  schedule,
  onTaskSelect,
  onTaskUpdate = () => false,
}: {
  view: PlanningView;
  busy?: boolean;
  readOnly?: boolean;
  schedule: PlanningSchedule;
  onTaskSelect: (taskId: string) => void;
  onTaskUpdate?: (taskId: string, payload: PlanningTaskUpdateRequest) => Promise<boolean> | boolean;
}) {
  if (view === "Board") return <PlanningFlowBoard busy={busy} readOnly={readOnly} schedule={schedule} onTaskOpen={onTaskSelect} onTaskUpdate={onTaskUpdate} />;
  if (view === "List") return <PlanningScheduleList schedule={schedule} onTaskOpen={onTaskSelect} />;
  if (view === "Calendar") return <PlanningCalendarView schedule={schedule} onTaskSelect={onTaskSelect} />;
  if (view === "Workload") return <PlanningWorkload schedule={schedule} />;
  if (view === "People") return <PlanningPeople schedule={schedule} />;
  return <PlanningDashboard schedule={schedule} onTaskSelect={onTaskSelect} />;
}

function PlanningCalendarView({ schedule, onTaskSelect }: { schedule: PlanningSchedule; onTaskSelect: (taskId: string) => void }) {
  return (
    <div className="planning-read-view planning-calendar-view" aria-label="Planning calendar">
      {schedule.tasks.map((task) => (
        <button key={task.id} type="button" onClick={() => onTaskSelect(task.id)}>
          <strong>{task.start}</strong>
          <span>{task.title}</span>
          <small>{task.end}</small>
        </button>
      ))}
    </div>
  );
}

function PlanningWorkload({ schedule }: { schedule: PlanningSchedule }) {
  const workloads = planningResourceWorkloads(schedule);
  return (
    <div className="planning-read-view planning-workload-view" aria-label="Planning workload">
      {workloads.map((workload) => (
        <section key={workload.resourceId} className="planning-workload-lane">
          <header>
            <div>
              <h3>{workload.resourceName}</h3>
              <span>{workload.role} · {workload.taskCount} tasks</span>
            </div>
            <strong className={workload.overloadedDays ? "overloaded" : ""}>{workload.peakAllocation}% peak</strong>
          </header>
          <div className="planning-workload-days" aria-label={`${workload.resourceName} daily allocation`}>
            {workload.days.slice(0, 14).map((day) => (
              <span key={day.date} className={day.overallocated ? "overloaded" : ""} title={`${day.date}: ${day.allocation}% allocation / ${day.capacity}% capacity · ${day.taskTitles.join(", ")}`}>
                <b style={{ height: `${Math.min(day.allocation, 160) / 1.6}%` }} />
                <small>{day.date.slice(5)}</small>
                <em>{day.allocation}%</em>
              </span>
            ))}
          </div>
          <small className={workload.overloadedDays ? "overloaded" : ""}>{workload.overloadedDays ? `${workload.overloadedDays} overloaded days` : "No overload detected"}</small>
        </section>
      ))}
      {!workloads.length ? <MetricTile label="Resources" value="0" detail="No resources assigned" /> : null}
    </div>
  );
}

function PlanningPeople({ schedule }: { schedule: PlanningSchedule }) {
  const participants = schedule.participants || [];
  return (
    <div className="planning-read-view planning-metric-grid" aria-label="Planning people">
      {participants.map((participant) => <MetricTile key={participant.id} label={participant.resolution.display_label || "Protected or unavailable Party"} value={participant.role.replace("_", " ")} detail={`Task participant · ${participant.resolution.status}`} />)}
      {schedule.resources.map((resource) => <MetricTile key={resource.id} label={resource.name} value={resource.role || "Role"} detail="Assigned resource" />)}
      {!participants.length && !schedule.resources.length ? <MetricTile label="People" value="0" detail="No people in this plan" /> : null}
    </div>
  );
}

function PlanningDashboard({ schedule, onTaskSelect }: { schedule: PlanningSchedule; onTaskSelect: (taskId: string) => void }) {
  const critical = schedule.tasks.filter((task) => task.critical).length;
  const milestones = schedule.tasks.filter((task) => task.task_type === "milestone").length;
  const progress = Math.round(schedule.tasks.reduce((sum, task) => sum + (task.progress || 0), 0) / Math.max(schedule.tasks.length, 1));
  const criticalPath = planningCriticalPathSummary(schedule);
  return (
    <div className="planning-read-view planning-dashboard-view" aria-label="Planning dashboard">
      <div className="planning-metric-grid">
        <MetricTile label="Tasks" value={String(schedule.tasks.length)} detail="Visible schedule items" />
        <MetricTile label="Critical" value={String(critical)} detail="Critical path tasks" />
        <MetricTile label="Milestones" value={String(milestones)} detail="Delivery markers" />
        <MetricTile label="Progress" value={`${progress}%`} detail="Average completion" />
        <MetricTile label="Gate blockers" value={String(schedule.readiness?.blocking_count || 0)} detail={`${schedule.readiness?.task_blocker_count || 0} task(s) not ready`} />
        {criticalPath.targetVarianceDays === null ? null : (
          <MetricTile
            label="Target variance"
            value={planningTargetVarianceLabel(criticalPath.targetVarianceDays)}
            detail={`${criticalPath.engineVersion} · finish ${criticalPath.calculatedFinish} vs target ${criticalPath.targetFinish}`}
          />
        )}
      </div>
      <section className="planning-critical-path-panel" aria-label="Critical path explanation">
        <header>
          <h3>Critical path</h3>
          <span>{criticalPath.criticalCount} critical · {criticalPath.zeroSlackCount} zero-slack</span>
        </header>
        {criticalPath.items.map((item) => (
          <button key={item.id} type="button" className="planning-critical-path-item" onClick={() => onTaskSelect(item.id)}>
            <strong>{item.wbs}</strong>
            <span>{item.label}</span>
            <small>{item.window} · slack {item.slack}d</small>
          </button>
        ))}
        {!criticalPath.items.length ? <small>No critical tasks in this schedule</small> : null}
      </section>
    </div>
  );
}

function MetricTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <section className="planning-metric-tile"><span>{label}</span><strong>{value}</strong><small>{detail}</small></section>;
}

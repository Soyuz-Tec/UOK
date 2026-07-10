import type { PlanningSchedule } from "./types";
import type { PlanningView } from "./planningTimelineModel";
import { planningCriticalPathSummary, planningTargetVarianceLabel } from "./planningCriticalPathModel";
import { planningResourceWorkloads } from "./planningWorkloadModel";

export function PlanningReadModelView({
  view,
  schedule,
  onTaskSelect,
}: {
  view: PlanningView;
  schedule: PlanningSchedule;
  onTaskSelect: (taskId: string) => void;
}) {
  if (view === "Board") return <PlanningBoard schedule={schedule} onTaskSelect={onTaskSelect} />;
  if (view === "List") return <PlanningList schedule={schedule} onTaskSelect={onTaskSelect} />;
  if (view === "Calendar") return <PlanningCalendarView schedule={schedule} onTaskSelect={onTaskSelect} />;
  if (view === "Workload") return <PlanningWorkload schedule={schedule} />;
  if (view === "People") return <PlanningPeople schedule={schedule} />;
  return <PlanningDashboard schedule={schedule} onTaskSelect={onTaskSelect} />;
}

function PlanningBoard({ schedule, onTaskSelect }: { schedule: PlanningSchedule; onTaskSelect: (taskId: string) => void }) {
  const statuses = Array.from(new Set(schedule.tasks.map((task) => task.status || "planned")));
  return (
    <div className="planning-read-view planning-board-view" aria-label="Planning board">
      {statuses.map((status) => (
        <section key={status} className="planning-read-lane">
          <h3>{status}</h3>
          {schedule.tasks.filter((task) => (task.status || "planned") === status).map((task) => (
            <button key={task.id} type="button" onClick={() => onTaskSelect(task.id)}>
              <strong>{task.wbs || "-"}</strong>
              <span>{task.title}</span>
              <small>{task.start} - {task.end}</small>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}

function PlanningList({ schedule, onTaskSelect }: { schedule: PlanningSchedule; onTaskSelect: (taskId: string) => void }) {
  return (
    <div className="planning-read-view" aria-label="Planning list">
      <table className="planning-read-table">
        <thead><tr><th>WBS</th><th>Task</th><th>Type</th><th>Start</th><th>End</th><th>Progress</th></tr></thead>
        <tbody>
          {schedule.tasks.map((task) => (
            <tr key={task.id} onClick={() => onTaskSelect(task.id)}>
              <td>{task.wbs || "-"}</td><td>{task.title}</td><td>{task.task_type}</td><td>{task.start}</td><td>{task.end}</td><td>{task.progress}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
            <strong className={workload.peakAllocation > 100 ? "overloaded" : ""}>{workload.peakAllocation}% peak</strong>
          </header>
          <div className="planning-workload-days" aria-label={`${workload.resourceName} daily allocation`}>
            {workload.days.slice(0, 14).map((day) => (
              <span key={day.date} className={day.allocation > 100 ? "overloaded" : ""} title={`${day.date}: ${day.allocation}% ${day.taskTitles.join(", ")}`}>
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

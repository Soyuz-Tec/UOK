import type { PlanningSchedule } from "./types";
import type { PlanningView } from "./planningTimelineModel";

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
  return <PlanningDashboard schedule={schedule} />;
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
  return (
    <div className="planning-read-view planning-metric-grid" aria-label="Planning workload">
      {schedule.resources.map((resource) => {
        const assignments = schedule.assignments.filter((assignment) => assignment.resource_id === resource.id);
        const allocation = assignments.reduce((sum, assignment) => sum + assignment.allocation_percent, 0);
        return <MetricTile key={resource.id} label={resource.name} value={`${allocation}%`} detail={resource.role || "Resource"} />;
      })}
      {!schedule.resources.length ? <MetricTile label="Resources" value="0" detail="No resources assigned" /> : null}
    </div>
  );
}

function PlanningPeople({ schedule }: { schedule: PlanningSchedule }) {
  return (
    <div className="planning-read-view planning-metric-grid" aria-label="Planning people">
      {schedule.resources.map((resource) => <MetricTile key={resource.id} label={resource.name} value={resource.role || "Role"} detail="Assigned resource" />)}
      {!schedule.resources.length ? <MetricTile label="People" value="0" detail="No people in this plan" /> : null}
    </div>
  );
}

function PlanningDashboard({ schedule }: { schedule: PlanningSchedule }) {
  const critical = schedule.tasks.filter((task) => task.critical).length;
  const milestones = schedule.tasks.filter((task) => task.task_type === "milestone").length;
  const progress = Math.round(schedule.tasks.reduce((sum, task) => sum + (task.progress || 0), 0) / Math.max(schedule.tasks.length, 1));
  return (
    <div className="planning-read-view planning-metric-grid" aria-label="Planning dashboard">
      <MetricTile label="Tasks" value={String(schedule.tasks.length)} detail="Visible schedule items" />
      <MetricTile label="Critical" value={String(critical)} detail="Critical path tasks" />
      <MetricTile label="Milestones" value={String(milestones)} detail="Delivery markers" />
      <MetricTile label="Progress" value={`${progress}%`} detail="Average completion" />
    </div>
  );
}

function MetricTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <section className="planning-metric-tile"><span>{label}</span><strong>{value}</strong><small>{detail}</small></section>;
}

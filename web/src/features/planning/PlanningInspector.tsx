import { CalendarDays, Flag, Link2, Save, Trash2, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { CommandButton } from "../../shared/primitives";
import { Pane } from "../../shared/layout";
import { PlanningAvailabilityPanel } from "./PlanningAvailabilityPanel";
import { PlanningTaskConstraintFields } from "./PlanningTaskConstraintFields";
import type { PlanningDependency, PlanningProject, PlanningSchedule, PlanningTask } from "./types";

const dependencyTypes = [
  ["finish_to_start", "Finish to start"],
  ["start_to_start", "Start to start"],
  ["finish_to_finish", "Finish to finish"],
  ["start_to_finish", "Start to finish"],
];
export type PlanningInspectorTab = "task" | "links" | "calendar" | "resources" | "status";

export function PlanningInspector(props: {
  projects: PlanningProject[];
  schedule: PlanningSchedule;
  selectedTask: PlanningTask | null;
  activeTab: PlanningInspectorTab;
  newTaskType: "task" | "milestone";
  status: unknown;
  busy: string;
  readOnly: boolean;
  onTabChange: (tab: PlanningInspectorTab) => void;
  onProjectChange: (projectId: string) => void;
  onSaveTask: (taskId: string, payload: Record<string, unknown>) => Promise<void>;
  onCreateTask: (payload: Record<string, unknown>) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onCreateDependency: (payload: Record<string, unknown>) => Promise<void>;
  onUpdateDependency: (dependencyId: string, payload: Record<string, unknown>) => Promise<void>;
  onRemoveDependency: (dependencyId: string) => Promise<void>;
  onSetCalendar: (payload: Record<string, unknown>) => Promise<void>;
  onCreateBaseline: (payload: Record<string, unknown>) => Promise<void>;
  onCreateResource: (payload: Record<string, unknown>) => Promise<void>;
  onAssignResource: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const { projects, schedule, selectedTask, activeTab, newTaskType, status, busy, readOnly, onProjectChange, onTabChange } = props;

  return (
    <Pane title="Inspector" description={schedule.project.name}>
      <div className="planning-inspector-top">
        <label className="field">
          <span>Project</span>
          <select value={schedule.project.id} onChange={(event) => onProjectChange(event.target.value)}>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>
        <div className="planning-selected-summary" aria-label="Selected task">
          <strong>{selectedTask?.title || "New task"}</strong>
          <span>{selectedTask ? `${selectedTask.wbs || "-"} - ${selectedTask.start} to ${selectedTask.end}` : "Blank task form"}</span>
        </div>
      </div>
      <div className="planning-inspector-tabs" role="tablist" aria-label="Planning inspector sections">
        {[
          ["task", "Task"],
          ["links", "Links"],
          ["calendar", "Calendar"],
          ["resources", "Resources"],
          ["status", "Status"],
        ].map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? "selected" : ""} onClick={() => onTabChange(id as PlanningInspectorTab)}>
            {label}
          </button>
        ))}
      </div>
      {readOnly ? <span className="planning-muted">Review mode prevents schedule changes.</span> : null}
      <fieldset className="planning-editor-fieldset" disabled={readOnly} aria-disabled={readOnly}>
        {activeTab === "task" && <TaskEditor key={selectedTask?.id || "new"} schedule={schedule} selectedTask={selectedTask} newTaskType={newTaskType} busy={busy} onSaveTask={props.onSaveTask} onCreateTask={props.onCreateTask} onDeleteTask={props.onDeleteTask} />}
        {activeTab === "links" && <DependencyEditor schedule={schedule} busy={busy} onCreateDependency={props.onCreateDependency} onUpdateDependency={props.onUpdateDependency} onRemoveDependency={props.onRemoveDependency} />}
        {activeTab === "calendar" && <CalendarBaselinePanel schedule={schedule} busy={busy} onSetCalendar={props.onSetCalendar} onCreateBaseline={props.onCreateBaseline} />}
        {activeTab === "resources" && <ResourcePanel schedule={schedule} selectedTask={selectedTask} busy={busy} onCreateResource={props.onCreateResource} onAssignResource={props.onAssignResource} />}
      </fieldset>
      {activeTab === "status" && <ValidationPanel schedule={schedule} status={status} />}
    </Pane>
  );
}

function ValidationPanel({ schedule, status }: { schedule: PlanningSchedule; status: unknown }) {
  const warnings = schedule.validation.warnings || [];
  return (
    <div className="planning-validation" aria-label="Planning validation status">
      <strong>{schedule.validation.ok ? "Schedule valid" : "Schedule needs attention"}</strong>
      {[...schedule.validation.violations, ...warnings].map((item) => <span key={item}>{item}</span>)}
      <pre>{JSON.stringify(status, null, 2)}</pre>
    </div>
  );
}

function TaskEditor({ schedule, selectedTask, newTaskType, busy, onSaveTask, onCreateTask, onDeleteTask }: {
  schedule: PlanningSchedule;
  selectedTask: PlanningTask | null;
  newTaskType: "task" | "milestone";
  busy: string;
  onSaveTask: (taskId: string, payload: Record<string, unknown>) => Promise<void>;
  onCreateTask: (payload: Record<string, unknown>) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
}) {
  const [form, setForm] = useState(taskForm(selectedTask, schedule.tasks.length + 1, newTaskType));

  useEffect(() => setForm(taskForm(selectedTask, schedule.tasks.length + 1, newTaskType)), [newTaskType, schedule.tasks.length, selectedTask]);

  const payload = {
    title: form.title,
    start: form.start,
    end: form.end,
    task_type: form.task_type,
    parent_task_id: form.parent_task_id || null,
    status: form.status,
    progress: Number(form.progress),
    sort_order: Number(form.sort_order),
    scheduling_mode: form.scheduling_mode,
    constraint_type: form.constraint_type || null,
    constraint_date: form.constraint_date || null,
  };

  return (
    <section className="planning-editor" aria-label="Task editor">
      <h3>Task</h3>
      <div className="planning-form-grid">
        <label className="field"><span>Title</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <label className="field"><span>Type</span><select value={form.task_type} onChange={(event) => setForm({ ...form, task_type: event.target.value })}>
          <option value="task">Task</option><option value="summary">Summary</option><option value="milestone">Milestone</option>
        </select></label>
        <label className="field"><span>Parent</span><select value={form.parent_task_id} onChange={(event) => setForm({ ...form, parent_task_id: event.target.value })}>
          <option value="">None</option>
          {schedule.tasks.filter((task) => task.id !== selectedTask?.id).map((task) => <option key={task.id} value={task.id}>{task.wbs} {task.title}</option>)}
        </select></label>
        <label className="field"><span>Status</span><input value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} /></label>
        <label className="field"><span>Start</span><input type="date" value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })} /></label>
        <label className="field"><span>End</span><input type="date" value={form.end} onChange={(event) => setForm({ ...form, end: event.target.value })} /></label>
        <label className="field"><span>Progress</span><input type="number" min="0" max="100" value={form.progress} onChange={(event) => setForm({ ...form, progress: event.target.value })} /></label>
        <label className="field"><span>Order</span><input type="number" min="0" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: event.target.value })} /></label>
        <PlanningTaskConstraintFields mode={form.scheduling_mode} type={form.constraint_type} date={form.constraint_date} onModeChange={(value) => setForm({ ...form, scheduling_mode: value })} onTypeChange={(value) => setForm({ ...form, constraint_type: value })} onDateChange={(value) => setForm({ ...form, constraint_date: value })} />
      </div>
      <div className="planning-action-row">
        <CommandButton icon={Save} loading={busy === "task"} onClick={() => selectedTask ? onSaveTask(selectedTask.id, payload) : onCreateTask(payload)}>
          {selectedTask ? "Save task" : "Add task"}
        </CommandButton>
        {selectedTask && <CommandButton icon={Trash2} loading={busy === "task"} onClick={() => onDeleteTask(selectedTask.id)}>Delete</CommandButton>}
      </div>
    </section>
  );
}

function DependencyEditor({ schedule, busy, onCreateDependency, onUpdateDependency, onRemoveDependency }: {
  schedule: PlanningSchedule;
  busy: string;
  onCreateDependency: (payload: Record<string, unknown>) => Promise<void>;
  onUpdateDependency: (dependencyId: string, payload: Record<string, unknown>) => Promise<void>;
  onRemoveDependency: (dependencyId: string) => Promise<void>;
}) {
  const [form, setForm] = useState({ predecessor_task_id: "", successor_task_id: "", dependency_type: "finish_to_start", lag_days: "0" });
  const payload = { ...form, lag_days: Number(form.lag_days) };
  return (
    <section className="planning-editor" aria-label="Dependency editor">
      <h3>Dependencies</h3>
      <div className="planning-form-grid">
        <TaskSelect label="Predecessor" value={form.predecessor_task_id} tasks={schedule.tasks} onChange={(value) => setForm({ ...form, predecessor_task_id: value })} />
        <TaskSelect label="Successor" value={form.successor_task_id} tasks={schedule.tasks} onChange={(value) => setForm({ ...form, successor_task_id: value })} />
        <DependencyTypeSelect value={form.dependency_type} onChange={(value) => setForm({ ...form, dependency_type: value })} />
        <label className="field"><span>Lag / lead</span><input type="number" min="-30" max="30" value={form.lag_days} onChange={(event) => setForm({ ...form, lag_days: event.target.value })} /></label>
      </div>
      <CommandButton icon={Link2} loading={busy === "dependency"} onClick={() => onCreateDependency(payload)}>Link tasks</CommandButton>
      <div className="planning-list">
        {schedule.dependencies.map((dependency) => (
          <DependencyRow
            key={dependency.id}
            dependency={dependency}
            tasks={schedule.tasks}
            busy={busy}
            onUpdateDependency={onUpdateDependency}
            onRemoveDependency={onRemoveDependency}
          />
        ))}
      </div>
    </section>
  );
}

function DependencyRow({ dependency, tasks, busy, onUpdateDependency, onRemoveDependency }: {
  dependency: PlanningDependency;
  tasks: PlanningTask[];
  busy: string;
  onUpdateDependency: (dependencyId: string, payload: Record<string, unknown>) => Promise<void>;
  onRemoveDependency: (dependencyId: string) => Promise<void>;
}) {
  const [type, setType] = useState(dependency.dependency_type);
  const [lag, setLag] = useState(String(dependency.lag_days));
  const byId = useMemo(() => new Map(tasks.map((task) => [task.id, task.title])), [tasks]);
  return (
    <div className="planning-dependency-row">
      <span>{byId.get(dependency.predecessor_task_id)} to {byId.get(dependency.successor_task_id)}</span>
      <DependencyTypeSelect value={type} onChange={setType} />
      <input aria-label="Lag or lead days" type="number" min="-30" max="30" value={lag} onChange={(event) => setLag(event.target.value)} />
      <CommandButton icon={Save} loading={busy === "dependency"} onClick={() => onUpdateDependency(dependency.id, { dependency_type: type, lag_days: Number(lag) })}>Save</CommandButton>
      <CommandButton icon={Trash2} loading={busy === "dependency"} onClick={() => onRemoveDependency(dependency.id)}>Remove</CommandButton>
    </div>
  );
}

function CalendarBaselinePanel({ schedule, busy, onSetCalendar, onCreateBaseline }: {
  schedule: PlanningSchedule;
  busy: string;
  onSetCalendar: (payload: Record<string, unknown>) => Promise<void>;
  onCreateBaseline: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const calendar = schedule.calendar || { name: "Standard", working_days: [1, 2, 3, 4, 5], holidays: [], ignored_periods: [] };
  const latestBaseline = schedule.baselines[0];
  const [holidays, setHolidays] = useState(calendar.holidays.join("\n"));
  const [ignoredPeriods, setIgnoredPeriods] = useState((calendar.ignored_periods || []).map((period) => `${period.start}..${period.end}`).join("\n"));
  return (
    <section className="planning-editor" aria-label="Calendar and baseline">
      <h3>Calendar and baseline</h3>
      <label className="field"><span>Holidays</span><textarea value={holidays} onChange={(event) => setHolidays(event.target.value)} /></label>
      <label className="field"><span>Ignored periods</span><textarea aria-label="Ignored periods" value={ignoredPeriods} onChange={(event) => setIgnoredPeriods(event.target.value)} /></label>
      <div className="planning-action-row">
        <CommandButton icon={CalendarDays} loading={busy === "calendar"} onClick={() => onSetCalendar({ name: calendar.name, working_days: calendar.working_days, holidays: holidays.split(/\s+/).filter(Boolean), ignored_periods: ignoredPeriods.split(/\s+/).filter(Boolean) })}>
          Save calendar
        </CommandButton>
        <CommandButton icon={Flag} loading={busy === "baseline"} disabled={schedule.capabilities?.baseline_create !== true} onClick={() => onCreateBaseline({ name: `Baseline ${schedule.baselines.length + 1}` })}>
          Set baseline
        </CommandButton>
      </div>
      {latestBaseline ? <span className="planning-baseline-integrity" data-status={latestBaseline.completeness} data-integrity={latestBaseline.integrity.verified ? "verified" : "warning"} role="status">
        {latestBaseline.completeness === "partial" ? `Legacy partial baseline: ${latestBaseline.name}. Complete verification and comparison are unavailable.` : latestBaseline.integrity.verified ? `Latest verified baseline: ${latestBaseline.name} (source revision ${latestBaseline.source_revision}).` : `Baseline integrity warning: ${latestBaseline.name} is not hash verified.`}
      </span> : <span className="planning-muted">No baseline captured</span>}
      <PlanningAvailabilityPanel availability={schedule.availability} />
    </section>
  );
}

function ResourcePanel({ schedule, selectedTask, busy, onCreateResource, onAssignResource }: {
  schedule: PlanningSchedule;
  selectedTask: PlanningTask | null;
  busy: string;
  onCreateResource: (payload: Record<string, unknown>) => Promise<void>;
  onAssignResource: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [resource, setResource] = useState({ name: "", role: "" });
  const [assignment, setAssignment] = useState({ resource_id: "", allocation_percent: "100" });
  return (
    <section className="planning-editor" aria-label="Resource assignments">
      <h3>Resources</h3>
      <div className="planning-form-grid">
        <label className="field"><span>Name</span><input value={resource.name} onChange={(event) => setResource({ ...resource, name: event.target.value })} /></label>
        <label className="field"><span>Role</span><input value={resource.role} onChange={(event) => setResource({ ...resource, role: event.target.value })} /></label>
      </div>
      <CommandButton icon={UserPlus} loading={busy === "resource"} onClick={() => onCreateResource(resource)}>Add resource</CommandButton>
      <div className="planning-form-grid">
        <label className="field"><span>Assign</span><select value={assignment.resource_id} onChange={(event) => setAssignment({ ...assignment, resource_id: event.target.value })}>
          <option value="">Select resource</option>
          {schedule.resources.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
        </select></label>
        <label className="field"><span>Allocation</span><input type="number" min="1" max="300" value={assignment.allocation_percent} onChange={(event) => setAssignment({ ...assignment, allocation_percent: event.target.value })} /></label>
      </div>
      <CommandButton icon={Save} disabled={!selectedTask} loading={busy === "resource"} onClick={() => selectedTask && onAssignResource({ task_id: selectedTask.id, resource_id: assignment.resource_id, allocation_percent: Number(assignment.allocation_percent) })}>
        Assign selected
      </CommandButton>
    </section>
  );
}

function TaskSelect({ label, value, tasks, onChange }: { label: string; value: string; tasks: PlanningTask[]; onChange: (value: string) => void }) {
  return (
    <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Select task</option>
      {tasks.map((task) => <option key={task.id} value={task.id}>{task.wbs} {task.title}</option>)}
    </select></label>
  );
}

function DependencyTypeSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="field"><span>Type</span><select value={value} onChange={(event) => onChange(event.target.value)}>
      {dependencyTypes.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
    </select></label>
  );
}

function taskForm(task: PlanningTask | null, order: number, newTaskType: "task" | "milestone") {
  return {
    title: task?.title || "",
    task_type: task?.task_type || newTaskType,
    parent_task_id: task?.parent_task_id || "",
    status: task?.status || "planned",
    start: task?.start || "2026-08-01",
    end: task?.end || "2026-08-01",
    progress: String(task?.progress ?? 0),
    sort_order: String(task?.sort_order ?? order),
    scheduling_mode: task?.scheduling_mode || "auto",
    constraint_type: task?.constraint_type || "",
    constraint_date: task?.constraint_date || "",
  };
}

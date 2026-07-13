import { useEffect, useState } from "react";

import { WorkspaceActionButton } from "@uok/shared/actions";
import type { PlanningTaskCreateRequest, PlanningTaskDateUpdateRequest, PlanningTaskUpdateRequest } from "./planningContracts";
import { PlanningTaskConstraintFields } from "./PlanningTaskConstraintFields";
import { PlanningTaskDateFields } from "./PlanningTaskDateFields";
import type { PlanningSchedule, PlanningSchedulingMode, PlanningTask, PlanningTaskStatus, PlanningTaskType } from "./types";

export function PlanningTaskEditor({ schedule, selectedTask, newTaskType, busy, onSaveTask, onSaveTaskDates, onCreateTask, onDeleteTask }: {
  schedule: PlanningSchedule;
  selectedTask: PlanningTask | null;
  newTaskType: "task" | "milestone";
  busy: string;
  onSaveTask: (taskId: string, payload: PlanningTaskUpdateRequest) => Promise<void>;
  onSaveTaskDates: (taskId: string, payload: PlanningTaskDateUpdateRequest) => Promise<void>;
  onCreateTask: (payload: PlanningTaskCreateRequest) => Promise<void>;
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
        <label className="field"><span>Type</span><select value={form.task_type} onChange={(event) => setForm({ ...form, task_type: event.target.value as PlanningTaskType })}>
          <option value="task">Task</option><option value="summary">Summary</option><option value="milestone">Milestone</option>
        </select></label>
        <label className="field"><span>Parent</span><select value={form.parent_task_id} onChange={(event) => setForm({ ...form, parent_task_id: event.target.value })}>
          <option value="">None</option>
          {schedule.tasks.filter((task) => task.id !== selectedTask?.id).map((task) => <option key={task.id} value={task.id}>{task.wbs} {task.title}</option>)}
        </select></label>
        <label className="field"><span>Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as PlanningTaskStatus })}>
          <option value="planned">Planned</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="complete">Complete</option>
        </select></label>
        <label className="field"><span>Planned start</span><input type="date" value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })} /></label>
        <label className="field"><span>Planned end</span><input type="date" value={form.end} onChange={(event) => setForm({ ...form, end: event.target.value })} /></label>
        <label className="field"><span>Progress</span><input type="number" min="0" max="100" value={form.progress} onChange={(event) => setForm({ ...form, progress: event.target.value })} /></label>
        <label className="field"><span>Order</span><input type="number" min="0" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: event.target.value })} /></label>
        <PlanningTaskConstraintFields mode={form.scheduling_mode} type={form.constraint_type} date={form.constraint_date} onModeChange={(value) => setForm({ ...form, scheduling_mode: value as PlanningSchedulingMode })} onTypeChange={(value) => setForm({ ...form, constraint_type: value })} onDateChange={(value) => setForm({ ...form, constraint_date: value })} />
      </div>
      <div className="planning-action-row">
        <WorkspaceActionButton action={selectedTask ? "save" : "create"} labelKey={selectedTask ? "command.saveTask" : "command.addTask"} fallbackLabel={selectedTask ? "Save task" : "Add task"} loading={busy === "task"} onClick={() => selectedTask ? onSaveTask(selectedTask.id, payload) : onCreateTask(payload)} />
        {selectedTask && <WorkspaceActionButton action="delete" loading={busy === "task"} onClick={() => onDeleteTask(selectedTask.id)} />}
      </div>
      {selectedTask ? <PlanningTaskDateFields task={selectedTask} timezone={schedule.project.timezone || "UTC"} busy={busy === "task-dates"} onSave={(dates) => onSaveTaskDates(selectedTask.id, dates)} /> : <span className="planning-muted">Create the task before recording forecast, actual, or deadline dates.</span>}
    </section>
  );
}

type TaskForm = {
  title: string; task_type: PlanningTaskType; parent_task_id: string; status: PlanningTaskStatus;
  start: string; end: string; progress: string; sort_order: string; scheduling_mode: PlanningSchedulingMode;
  constraint_type: string; constraint_date: string;
};

function taskForm(task: PlanningTask | null, order: number, newTaskType: "task" | "milestone"): TaskForm {
  return {
    title: task?.title || "", task_type: task?.task_type || newTaskType, parent_task_id: task?.parent_task_id || "",
    status: task?.status || "planned", start: task?.start || "2026-08-01", end: task?.end || "2026-08-01",
    progress: String(task?.progress ?? 0), sort_order: String(task?.sort_order ?? order), scheduling_mode: task?.scheduling_mode || "auto",
    constraint_type: task?.constraint_type || "", constraint_date: task?.constraint_date || "",
  };
}

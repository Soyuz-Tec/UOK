import { CalendarDays, Flag, Link2, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { CommandButton } from "../../shared/primitives";
import { Pane } from "../../shared/layout";
import { PlanningAvailabilityPanel } from "./PlanningAvailabilityPanel";
import { PlanningTaskEditor } from "./PlanningTaskEditor";
import { PlanningResourcePanel } from "./PlanningResourcePanel";
import { PlanningOperationLinksPanel } from "./PlanningOperationLinksPanel";
import { PlanningParticipantsPanel } from "./PlanningParticipantsPanel";
import { PlanningRequirementsPanel } from "./PlanningRequirementsPanel";
import { PlanningAnalysisPanel } from "./PlanningAnalysisPanel";
import type { PlanningDependency, PlanningDependencyType, PlanningProject, PlanningSchedule, PlanningTask } from "./types";
import type {
  PlanningAssignmentCreateRequest,
  PlanningBaselineCreateRequest,
  PlanningCalendarUpdateRequest,
  PlanningDependencyCreateRequest,
  PlanningDependencyUpdateRequest,
  PlanningLinkCreateRequest,
  PlanningResourceCreateRequest,
  PlanningResourceCalendarUpdateRequest,
  PlanningTaskCreateRequest,
  PlanningTaskDateUpdateRequest,
  PlanningTaskParticipantCreateRequest,
  PlanningTaskRequirementAdvanceRequest,
  PlanningTaskRequirementCreateRequest,
  PlanningTaskRequirementDecisionRequest,
  PlanningTaskRequirementLinkRequest,
  PlanningTaskUpdateRequest,
} from "./planningContracts";
import type { PlanningRiskCreateRequest, PlanningWhatIfCreateRequest } from "./analysisTypes";

const dependencyTypes: Array<[PlanningDependencyType, string]> = [
  ["finish_to_start", "Finish to start"],
  ["start_to_start", "Start to start"],
  ["finish_to_finish", "Finish to finish"],
  ["start_to_finish", "Start to finish"],
];
export type PlanningInspectorTab = "task" | "dependencies" | "links" | "participants" | "gates" | "calendar" | "resources" | "analysis" | "status";

export function PlanningInspector(props: {
  projects: PlanningProject[];
  schedule: PlanningSchedule;
  token: string;
  selectedTask: PlanningTask | null;
  activeTab: PlanningInspectorTab;
  newTaskType: "task" | "milestone";
  status: unknown;
  busy: string;
  readOnly: boolean;
  linkReadOnly: boolean;
  canApproveGates: boolean;
  canAnalyze: boolean;
  onTabChange: (tab: PlanningInspectorTab) => void;
  onProjectChange: (projectId: string) => void;
  onSaveTask: (taskId: string, payload: PlanningTaskUpdateRequest) => Promise<void>;
  onSaveTaskDates: (taskId: string, payload: PlanningTaskDateUpdateRequest) => Promise<void>;
  onCreateTask: (payload: PlanningTaskCreateRequest) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onCreateDependency: (payload: PlanningDependencyCreateRequest) => Promise<void>;
  onUpdateDependency: (dependencyId: string, payload: PlanningDependencyUpdateRequest) => Promise<void>;
  onRemoveDependency: (dependencyId: string) => Promise<void>;
  onCreatePlanningLink: (payload: PlanningLinkCreateRequest) => Promise<void>;
  onRemovePlanningLink: (linkId: string) => Promise<void>;
  onAddTaskParticipant: (taskId: string, payload: PlanningTaskParticipantCreateRequest) => Promise<void>;
  onRemoveTaskParticipant: (taskId: string, participantId: string) => Promise<void>;
  onCreateTaskRequirement: (taskId: string, payload: PlanningTaskRequirementCreateRequest) => Promise<void>;
  onAdvanceTaskRequirement: (taskId: string, requirementId: string, payload: PlanningTaskRequirementAdvanceRequest) => Promise<void>;
  onSetTaskRequirementLink: (taskId: string, requirementId: string, payload: PlanningTaskRequirementLinkRequest) => Promise<void>;
  onDecideTaskRequirement: (taskId: string, requirementId: string, payload: PlanningTaskRequirementDecisionRequest) => Promise<void>;
  onSetCalendar: (payload: PlanningCalendarUpdateRequest) => Promise<void>;
  onCreateBaseline: (payload: PlanningBaselineCreateRequest) => Promise<void>;
  onCreateResource: (payload: PlanningResourceCreateRequest) => Promise<void>;
  onAssignResource: (payload: PlanningAssignmentCreateRequest) => Promise<void>;
  onSetResourceCalendar: (resourceId: string, payload: PlanningResourceCalendarUpdateRequest) => Promise<void>;
  onCreateWhatIfSnapshot: (payload: PlanningWhatIfCreateRequest) => Promise<void>;
  onRunRiskAnalysis: (payload: PlanningRiskCreateRequest) => Promise<void>;
}) {
  const { projects, schedule, selectedTask, activeTab, newTaskType, status, busy, readOnly, linkReadOnly, onProjectChange, onTabChange } = props;

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
          ["dependencies", "Dependencies"],
          ["links", "Links"],
          ["participants", "People"],
          ["gates", "Gates"],
          ["calendar", "Calendar"],
          ["resources", "Resources"],
          ["analysis", "Analysis"],
          ["status", "Status"],
        ].map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? "selected" : ""} onClick={() => onTabChange(id as PlanningInspectorTab)}>
            {label}
          </button>
        ))}
      </div>
      {readOnly ? <span className="planning-muted">Review mode prevents schedule changes.</span> : null}
      <fieldset className="planning-editor-fieldset" disabled={readOnly} aria-disabled={readOnly}>
        {activeTab === "task" && <PlanningTaskEditor key={selectedTask?.id || "new"} schedule={schedule} selectedTask={selectedTask} newTaskType={newTaskType} busy={busy} onSaveTask={props.onSaveTask} onSaveTaskDates={props.onSaveTaskDates} onCreateTask={props.onCreateTask} onDeleteTask={props.onDeleteTask} />}
        {activeTab === "dependencies" && <DependencyEditor schedule={schedule} busy={busy} onCreateDependency={props.onCreateDependency} onUpdateDependency={props.onUpdateDependency} onRemoveDependency={props.onRemoveDependency} />}
        {activeTab === "links" && <PlanningOperationLinksPanel schedule={schedule} selectedTask={selectedTask} busy={busy} readOnly={readOnly || linkReadOnly} onCreate={props.onCreatePlanningLink} onRemove={props.onRemovePlanningLink} />}
        {activeTab === "participants" && <PlanningParticipantsPanel token={props.token} schedule={schedule} selectedTask={selectedTask} busy={busy} readOnly={readOnly} onAdd={props.onAddTaskParticipant} onRemove={props.onRemoveTaskParticipant} />}
        {activeTab === "gates" && <PlanningRequirementsPanel schedule={schedule} selectedTask={selectedTask} busy={busy} readOnly={readOnly} canApprove={props.canApproveGates} onCreate={props.onCreateTaskRequirement} onAdvance={props.onAdvanceTaskRequirement} onSetLink={props.onSetTaskRequirementLink} onDecide={props.onDecideTaskRequirement} />}
        {activeTab === "calendar" && <CalendarBaselinePanel schedule={schedule} busy={busy} onSetCalendar={props.onSetCalendar} onCreateBaseline={props.onCreateBaseline} />}
        {activeTab === "resources" && <PlanningResourcePanel schedule={schedule} selectedTask={selectedTask} busy={busy} onCreateResource={props.onCreateResource} onAssignResource={props.onAssignResource} onSetResourceCalendar={props.onSetResourceCalendar} />}
        {activeTab === "analysis" && <PlanningAnalysisPanel token={props.token} schedule={schedule} busy={busy} readOnly={readOnly} canAnalyze={props.canAnalyze} onCreate={props.onCreateWhatIfSnapshot} onRunRisk={props.onRunRiskAnalysis} />}
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

function DependencyEditor({ schedule, busy, onCreateDependency, onUpdateDependency, onRemoveDependency }: {
  schedule: PlanningSchedule;
  busy: string;
  onCreateDependency: (payload: PlanningDependencyCreateRequest) => Promise<void>;
  onUpdateDependency: (dependencyId: string, payload: PlanningDependencyUpdateRequest) => Promise<void>;
  onRemoveDependency: (dependencyId: string) => Promise<void>;
}) {
  const [form, setForm] = useState<{ predecessor_task_id: string; successor_task_id: string; dependency_type: PlanningDependencyType; lag_days: string }>({ predecessor_task_id: "", successor_task_id: "", dependency_type: "finish_to_start", lag_days: "0" });
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
  onUpdateDependency: (dependencyId: string, payload: PlanningDependencyUpdateRequest) => Promise<void>;
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
  onSetCalendar: (payload: PlanningCalendarUpdateRequest) => Promise<void>;
  onCreateBaseline: (payload: PlanningBaselineCreateRequest) => Promise<void>;
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

function TaskSelect({ label, value, tasks, onChange }: { label: string; value: string; tasks: PlanningTask[]; onChange: (value: string) => void }) {
  return (
    <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Select task</option>
      {tasks.map((task) => <option key={task.id} value={task.id}>{task.wbs} {task.title}</option>)}
    </select></label>
  );
}

function DependencyTypeSelect({ value, onChange }: { value: PlanningDependencyType; onChange: (value: PlanningDependencyType) => void }) {
  return (
    <label className="field"><span>Type</span><select value={value} onChange={(event) => onChange(event.target.value as PlanningDependencyType)}>
      {dependencyTypes.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
    </select></label>
  );
}

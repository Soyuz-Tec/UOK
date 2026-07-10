import { FlaskConical, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { CommandButton } from "../../shared/primitives";
import type { PlanningWhatIfCreateRequest, PlanningWhatIfDetail, PlanningWhatIfMetadata } from "./analysisTypes";
import { listPlanningWhatIfSnapshots, loadPlanningWhatIfSnapshot } from "./planningAnalysisApi";
import type { PlanningSchedule } from "./types";

export function PlanningAnalysisPanel({
  token,
  schedule,
  busy,
  readOnly,
  canAnalyze,
  onCreate,
}: {
  token: string;
  schedule: PlanningSchedule;
  busy: string;
  readOnly: boolean;
  canAnalyze: boolean;
  onCreate: (payload: PlanningWhatIfCreateRequest) => Promise<void>;
}) {
  const firstTask = schedule.tasks.find((task) => task.task_type !== "summary");
  const [taskId, setTaskId] = useState(firstTask?.id || "");
  const selected = schedule.tasks.find((task) => task.id === taskId) || firstTask;
  const [name, setName] = useState("What-if schedule");
  const [start, setStart] = useState(selected?.start || "");
  const [end, setEnd] = useState(selected?.end || "");
  const [rows, setRows] = useState<PlanningWhatIfMetadata[]>([]);
  const [detail, setDetail] = useState<PlanningWhatIfDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void refresh();
  }, [schedule.project.id]);

  return (
    <section className="planning-editor" aria-label="Planning analysis scenarios">
      <h3>Immutable what-if</h3>
      <p className="planning-muted">Preview temporary date changes without mutating the approved schedule. Every snapshot is hash-verified and append-only.</p>
      <label className="field"><span>Name</span><input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} /></label>
      <label className="field"><span>Task</span><select value={taskId} onChange={(event) => selectTask(event.target.value)}>
        {schedule.tasks.filter((task) => task.task_type !== "summary").map((task) => <option key={task.id} value={task.id}>{task.wbs} {task.title}</option>)}
      </select></label>
      <div className="planning-form-grid">
        <label className="field"><span>Preview start</span><input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label>
        <label className="field"><span>Preview end</span><input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></label>
      </div>
      <div className="planning-action-row">
        <CommandButton
          icon={FlaskConical}
          loading={busy === "what-if"}
          disabled={readOnly || !canAnalyze || !selected || !name.trim() || !start || !end}
          onClick={() => void create()}
        >
          Capture preview
        </CommandButton>
        <CommandButton icon={RefreshCw} loading={loading} onClick={() => void refresh()}>Refresh snapshots</CommandButton>
      </div>
      {!canAnalyze ? <span className="planning-muted">Server analysis capability is required to create snapshots.</span> : null}
      <div className="planning-list" aria-label="What-if snapshots">
        {rows.map((row) => (
          <button key={row.id} type="button" className="planning-list-button" onClick={() => void load(row.id)}>
            <strong>{row.name}</strong>
            <span>revision {row.source_revision} · {row.integrity.status}</span>
          </button>
        ))}
        {!rows.length && !loading ? <span className="planning-muted">No what-if snapshots</span> : null}
      </div>
      {detail ? (
        <div className="planning-validation" aria-label="What-if preview result">
          <strong>{detail.name}</strong>
          <span>{detail.snapshot.proposal.task_changes.length} temporary change(s) · source revision {detail.source_revision}</span>
          <span>{detail.snapshot.preview.validation.ok ? "Preview constraints valid" : "Preview has constraint findings"}</span>
          <span>Checksum {detail.integrity.verified ? "verified" : "failed"}: {detail.checksum.slice(0, 12)}…</span>
        </div>
      ) : null}
    </section>
  );

  async function create() {
    if (!selected) return;
    await onCreate({ name: name.trim(), task_changes: [{ task_id: selected.id, start, end }] });
    await refresh();
  }

  async function refresh() {
    setLoading(true);
    try {
      const next = await listPlanningWhatIfSnapshots(token, schedule.project.id);
      setRows(next);
      if (next[0]) await load(next[0].id);
      else setDetail(null);
    } finally {
      setLoading(false);
    }
  }

  async function load(snapshotId: string) {
    setDetail(await loadPlanningWhatIfSnapshot(token, schedule.project.id, snapshotId));
  }

  function selectTask(nextId: string) {
    const task = schedule.tasks.find((row) => row.id === nextId);
    setTaskId(nextId);
    setStart(task?.start || "");
    setEnd(task?.end || "");
  }
}

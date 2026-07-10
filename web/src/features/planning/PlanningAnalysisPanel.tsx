import { FlaskConical, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { CommandButton } from "../../shared/primitives";
import type { PlanningOptimizationCreateRequest, PlanningRecommendation, PlanningRiskCreateRequest, PlanningRiskMetadata, PlanningWhatIfCreateRequest, PlanningWhatIfDetail, PlanningWhatIfMetadata } from "./analysisTypes";
import { listPlanningRecommendations, listPlanningRiskAnalyses, listPlanningWhatIfSnapshots, loadPlanningWhatIfSnapshot } from "./planningAnalysisApi";
import type { PlanningSchedule } from "./types";

export function PlanningAnalysisPanel({
  token,
  schedule,
  busy,
  readOnly,
  canAnalyze,
  onCreate,
  onRunRisk,
  onRunOptimization,
  onDecideRecommendation,
  onApplyRecommendation,
  onRollbackRecommendation,
  canApprove,
}: {
  token: string;
  schedule: PlanningSchedule;
  busy: string;
  readOnly: boolean;
  canAnalyze: boolean;
  onCreate: (payload: PlanningWhatIfCreateRequest) => Promise<void>;
  onRunRisk: (payload: PlanningRiskCreateRequest) => Promise<void>;
  onRunOptimization: (payload: PlanningOptimizationCreateRequest) => Promise<void>;
  onDecideRecommendation: (recommendationId: string, decision: "approve" | "reject", reason: string) => Promise<void>;
  onApplyRecommendation: (recommendationId: string) => Promise<void>;
  onRollbackRecommendation: (recommendationId: string) => Promise<void>;
  canApprove: boolean;
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
  const [seed, setSeed] = useState(42);
  const [iterations, setIterations] = useState(500);
  const [riskRows, setRiskRows] = useState<PlanningRiskMetadata[]>([]);
  const [recommendations, setRecommendations] = useState<PlanningRecommendation[]>([]);
  const [decisionReason, setDecisionReason] = useState("Reviewed with the delivery owner");

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
      <h3>Reproducible schedule risk</h3>
      <p className="planning-muted">Run bounded Monte Carlo analysis from the selected verified snapshot. Seed, distributions, correlation assumptions, engine, limits, and percentiles are retained.</p>
      <div className="planning-form-grid">
        <label className="field"><span>Random seed</span><input type="number" min={0} value={seed} onChange={(event) => setSeed(Number(event.target.value))} /></label>
        <label className="field"><span>Iterations</span><input type="number" min={100} max={5000} value={iterations} onChange={(event) => setIterations(Number(event.target.value))} /></label>
      </div>
      <CommandButton icon={FlaskConical} loading={busy === "risk"} disabled={readOnly || !canAnalyze || !detail || !selected || iterations < 100 || iterations > 5000 || seed < 0} onClick={() => void runRisk()}>
        Run risk analysis
      </CommandButton>
      <div className="planning-list" aria-label="Risk analyses">
        {riskRows.map((row) => <div key={row.id} className="planning-list-row">
          <strong>P80 {row.result_summary.finish_percentiles.p80}</strong>
          <span>{Math.round(row.result_summary.probability_on_or_before_target * 100)}% on/before target · seed {row.seed} · {row.integrity.status}</span>
        </div>)}
      </div>
      <h3>Bounded recommendations</h3>
      <p className="planning-muted">The advisory optimizer searches a bounded candidate set, explains objective impact and side effects, previews hard constraints, and never applies without separate approval.</p>
      <CommandButton icon={FlaskConical} loading={busy === "optimize"} disabled={readOnly || !canAnalyze || !detail} onClick={() => void optimize()}>
        Analyze and recommend
      </CommandButton>
      <label className="field"><span>Decision reason</span><input value={decisionReason} maxLength={500} onChange={(event) => setDecisionReason(event.target.value)} /></label>
      <div className="planning-list" aria-label="Optimization recommendations">
        {recommendations.map((row) => <div key={row.id} className="planning-list-row">
          <strong>#{row.rank} {row.title}</strong>
          <span>{row.explanation.impact} · {row.status}</span>
          <small>{row.explanation.side_effects.join(" ")}</small>
          <div className="planning-action-row">
            {row.status === "proposed" ? <>
              <CommandButton icon={FlaskConical} disabled={readOnly || !canApprove || !decisionReason.trim()} loading={busy === "recommendation-decision"} onClick={() => void decide(row.id, "approve")}>Approve</CommandButton>
              <CommandButton icon={FlaskConical} disabled={readOnly || !canApprove || !decisionReason.trim()} loading={busy === "recommendation-decision"} onClick={() => void decide(row.id, "reject")}>Reject</CommandButton>
            </> : null}
            {row.status === "approved" ? <CommandButton icon={FlaskConical} disabled={readOnly} loading={busy === "recommendation-apply"} onClick={() => void apply(row.id)}>Apply</CommandButton> : null}
            {row.status === "applied" ? <CommandButton icon={RefreshCw} disabled={readOnly} loading={busy === "recommendation-rollback"} onClick={() => void rollback(row.id)}>Rollback</CommandButton> : null}
          </div>
        </div>)}
      </div>
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
      setRiskRows(await listPlanningRiskAnalyses(token, schedule.project.id));
      setRecommendations(await listPlanningRecommendations(token, schedule.project.id));
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

  async function runRisk() {
    if (!detail || !selected) return;
    const likely = Math.max(1, selected.duration_days);
    await onRunRisk({
      snapshot_id: detail.id,
      seed,
      iterations,
      task_risks: [{
        task_id: selected.id,
        distribution: "triangular",
        minimum_days: Math.max(1, likely - 1),
        most_likely_days: likely,
        maximum_days: likely + 2,
      }],
      correlations: [],
    });
    setRiskRows(await listPlanningRiskAnalyses(token, schedule.project.id));
  }

  async function optimize() {
    if (!detail) return;
    await onRunOptimization({ snapshot_id: detail.id, objective: "minimize_project_finish", timeout_ms: 500, max_candidates: 50 });
    setRecommendations(await listPlanningRecommendations(token, schedule.project.id));
  }

  async function decide(recommendationId: string, decision: "approve" | "reject") {
    await onDecideRecommendation(recommendationId, decision, decisionReason.trim());
    setRecommendations(await listPlanningRecommendations(token, schedule.project.id));
  }

  async function apply(recommendationId: string) {
    await onApplyRecommendation(recommendationId);
    setRecommendations(await listPlanningRecommendations(token, schedule.project.id));
  }

  async function rollback(recommendationId: string) {
    await onRollbackRecommendation(recommendationId);
    setRecommendations(await listPlanningRecommendations(token, schedule.project.id));
  }
}

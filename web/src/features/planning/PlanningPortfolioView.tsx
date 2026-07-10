import { FolderOpen, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { useUokLocalization } from "../../shared/localization";
import { CommandButton } from "../../shared/primitives";
import { loadPlanningPortfolio } from "./planningPortfolioApi";
import type { PlanningPortfolioHealth, PlanningPortfolioProject, PlanningPortfolioResponse } from "./portfolioTypes";
import type { PlanningProjectStatus } from "./types";

export function PlanningPortfolioView({ token, onOpenProject }: { token: string; onOpenProject: (projectId: string) => void }) {
  const { formatNumber, t } = useUokLocalization();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<PlanningProjectStatus | "">("");
  const [applied, setApplied] = useState<{ query: string; status: PlanningProjectStatus | "" }>({ query: "", status: "" });
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState<PlanningPortfolioResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setData(await loadPlanningPortfolio(token, { ...applied, limit: 50 }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("planning.portfolio.error", "Portfolio could not be loaded."));
    } finally {
      setBusy(false);
    }
  }, [applied, t, token]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    setApplied({ query: query.trim(), status });
  }

  return (
    <div className="planning-portfolio" aria-label={t("planning.portfolio", "Planning portfolio")}>
      <header className="planning-portfolio-header">
        <div>
          <span className="workflow-eyebrow">{t("planning.portfolio.eyebrow", "Planning")}</span>
          <h2>{t("planning.portfolio", "Portfolio")}</h2>
          <p>{t("planning.portfolio.summary", "Monitor delivery, risk, gates, and schedule windows across projects.")}</p>
        </div>
        <CommandButton icon={RefreshCw} onClick={() => setRefreshKey((value) => value + 1)} loading={busy}>
          {t("account.refresh", "Refresh")}
        </CommandButton>
      </header>

      <form className="planning-portfolio-filters" onSubmit={applyFilters}>
        <label>
          <span>{t("planning.portfolio.search", "Search projects")}</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" />
        </label>
        <label>
          <span>{t("planning.portfolio.status", "Project status")}</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as PlanningProjectStatus | "")}>
            <option value="">{t("planning.portfolio.allStatuses", "All statuses")}</option>
            <option value="draft">{t("planning.portfolio.draft", "Draft")}</option>
            <option value="active">{t("planning.portfolio.active", "Active")}</option>
            <option value="on_hold">{t("planning.portfolio.onHold", "On hold")}</option>
            <option value="completed">{t("planning.portfolio.completed", "Completed")}</option>
            <option value="archived">{t("planning.portfolio.archived", "Archived")}</option>
          </select>
        </label>
        <CommandButton icon={Search} type="submit" primary>{t("planning.portfolio.apply", "Apply filters")}</CommandButton>
      </form>

      {error ? <p className="planning-portfolio-error" role="alert">{error}</p> : null}
      {!data && busy ? <p role="status">{t("planning.portfolio.loading", "Loading portfolio")}</p> : null}
      {data ? (
        <>
          <section className="planning-portfolio-metrics" aria-label={t("planning.portfolio.metrics", "Portfolio metrics")}>
            <Metric label={t("planning.portfolio.projects", "Projects")} value={formatNumber(data.summary.total_project_count)} />
            <Metric label={t("planning.portfolio.tasks", "Tasks")} value={formatNumber(data.summary.task_count)} />
            <Metric label={t("planning.portfolio.atRisk", "At risk")} value={formatNumber(data.summary.at_risk_project_count)} />
            <Metric label={t("planning.portfolio.overdue", "Overdue tasks")} value={formatNumber(data.summary.overdue_task_count)} />
            <Metric label={t("planning.portfolio.gates", "Gate blockers")} value={formatNumber(data.summary.gate_blocker_count)} />
          </section>
          {data.projects.length ? (
            <PortfolioTable projects={data.projects} rangeStart={data.summary.range_start} rangeEnd={data.summary.range_end} onOpenProject={onOpenProject} />
          ) : <p className="planning-portfolio-empty">{t("planning.portfolio.empty", "No projects match these filters.")}</p>}
          <p className="planning-portfolio-diagnostics">
            {t("planning.portfolio.diagnostics", "Bounded aggregate")}: {formatNumber(data.diagnostics.query_count)} {t("planning.portfolio.queries", "queries")}, {formatNumber(data.diagnostics.elapsed_ms)} ms
          </p>
        </>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="planning-portfolio-metric"><span>{label}</span><strong>{value}</strong></div>;
}

function PortfolioTable({ projects, rangeStart, rangeEnd, onOpenProject }: {
  projects: PlanningPortfolioProject[];
  rangeStart: string | null;
  rangeEnd: string | null;
  onOpenProject: (projectId: string) => void;
}) {
  const { formatDate, formatNumber, t } = useUokLocalization();
  return (
    <div className="planning-portfolio-table-wrap">
      <table className="planning-portfolio-table">
        <caption className="sr-only">{t("planning.portfolio.table", "Multi-project delivery portfolio")}</caption>
        <thead><tr>
          <th scope="col">{t("planning.portfolio.project", "Project")}</th>
          <th scope="col">{t("planning.portfolio.health", "Health")}</th>
          <th scope="col">{t("planning.column.progress", "Progress")}</th>
          <th scope="col">{t("planning.portfolio.issues", "Issues")}</th>
          <th scope="col">{t("planning.timeline", "Timeline")}</th>
          <th scope="col"><span className="sr-only">{t("planning.portfolio.actions", "Actions")}</span></th>
        </tr></thead>
        <tbody>{projects.map((project) => {
          const position = timelinePosition(project, rangeStart, rangeEnd);
          const dates = portfolioProjectDates(project);
          const compatibilityHorizon = t("planning.portfolio.compatibilityHorizon", "Compatibility horizon");
          const targetFinish = t("planning.portfolio.targetFinish", "Target finish");
          const calculatedFinish = t("planning.portfolio.calculatedFinish", "Calculated finish");
          const latestTaskFinish = t("planning.portfolio.latestTaskFinish", "Latest task finish");
          const scheduleHorizon = t("planning.portfolio.scheduleHorizon", "Schedule horizon");
          const projectStart = t("planning.gantt.projectStart", "Project start");
          const visibleDates = [
            dates.start && dates.rangeEnd ? `${formatDate(dates.start)} – ${formatDate(dates.rangeEnd)}` : null,
            dates.compatibilityHorizon ? `${compatibilityHorizon} ${formatDate(dates.compatibilityHorizon)}` : null,
            dates.targetFinish ? `${targetFinish} ${formatDate(dates.targetFinish)}` : null,
            dates.calculatedFinish ? `${calculatedFinish} ${formatDate(dates.calculatedFinish)}` : null,
            dates.latestTaskFinish ? `${latestTaskFinish} ${formatDate(dates.latestTaskFinish)}` : null,
          ].filter((value): value is string => Boolean(value));
          const timelineDates = [
            dates.start ? `${projectStart} ${dates.start}` : null,
            dates.scheduleHorizon ? `${scheduleHorizon} ${dates.scheduleHorizon}` : null,
            dates.compatibilityHorizon ? `${compatibilityHorizon} ${dates.compatibilityHorizon}` : null,
            dates.targetFinish ? `${targetFinish} ${dates.targetFinish}` : null,
            dates.calculatedFinish ? `${calculatedFinish} ${dates.calculatedFinish}` : null,
            dates.latestTaskFinish ? `${latestTaskFinish} ${dates.latestTaskFinish}` : null,
          ].filter((value): value is string => Boolean(value));
          const timelineLabel = `${project.name}: ${timelineDates.join("; ")}`;
          return <tr key={project.id}>
            <th scope="row"><strong>{project.name}</strong>{visibleDates.length ? <span>{visibleDates.join(" · ")}</span> : null}</th>
            <td><Health value={project.attention.health} /></td>
            <td>{formatNumber(project.metrics.completion_percent)}%</td>
            <td>{formatNumber(project.attention.issue_count)}</td>
            <td>
              <div className="planning-portfolio-timeline" role="img" aria-label={timelineLabel}>
                <span style={{ insetInlineStart: `${position.start}%`, inlineSize: `${position.width}%` }} />
              </div>
            </td>
            <td><button className="planning-portfolio-open" type="button" onClick={() => onOpenProject(project.id)} aria-label={`${t("planning.portfolio.open", "Open project")} ${project.name}`}><FolderOpen size={16} aria-hidden="true" />{t("planning.portfolio.open", "Open")}</button></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  );
}

function Health({ value }: { value: PlanningPortfolioHealth }) {
  const { t } = useUokLocalization();
  const label = value === "on_track" ? t("planning.portfolio.onTrack", "On track") : value === "attention" ? t("planning.portfolio.attention", "Attention") : t("planning.portfolio.blocked", "Blocked");
  return <span className={`planning-portfolio-health ${value}`}>{label}</span>;
}

function timelinePosition(project: PlanningPortfolioProject, rangeStart: string | null, rangeEnd: string | null) {
  const projectStartTime = portfolioDateTime(project.start);
  const horizonTime = portfolioDateTime(project.schedule_horizon) ?? portfolioDateTime(project.end);
  if (projectStartTime === null || horizonTime === null) return { start: 0, width: 2 };
  const rangeStartTime = portfolioDateTime(rangeStart) ?? projectStartTime;
  const rangeEndTime = portfolioDateTime(rangeEnd) ?? horizonTime;
  const span = Math.max(1, rangeEndTime - rangeStartTime);
  const start = Math.max(0, Math.min(100, ((projectStartTime - rangeStartTime) / span) * 100));
  const end = Math.max(start, Math.min(100, ((horizonTime - rangeStartTime) / span) * 100));
  return { start, width: Math.max(2, end - start) };
}

function portfolioProjectDates(project: PlanningPortfolioProject) {
  const start = portfolioDate(project.start);
  const compatibilityHorizon = portfolioDate(project.end);
  const scheduleHorizon = portfolioDate(project.schedule_horizon);
  return {
    start,
    compatibilityHorizon,
    scheduleHorizon,
    rangeEnd: scheduleHorizon ?? compatibilityHorizon,
    targetFinish: portfolioDate(project.target_finish),
    calculatedFinish: portfolioDate(project.calculated_finish),
    latestTaskFinish: portfolioDate(project.latest_task_finish),
  };
}

function portfolioDate(value: string | null | undefined) {
  return portfolioDateTime(value) === null ? null : value || null;
}

function portfolioDateTime(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

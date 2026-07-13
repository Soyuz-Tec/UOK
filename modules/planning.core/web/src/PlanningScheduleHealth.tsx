import { Activity } from "lucide-react";

import { ExpandableControlPanel } from "@uok/shared/forms";
import { useUokLocalization } from "@uok/shared/localization";
import type { PlanningSchedule } from "./types";

type HealthTone = "attention" | "invalid" | "partial" | "ready";

export function PlanningScheduleHealth({
  reviewMode,
  reviewModeLocked,
  schedule,
}: {
  reviewMode: boolean;
  reviewModeLocked: boolean;
  schedule: PlanningSchedule;
}) {
  const { formatDate, formatNumber, t } = useUokLocalization();
  const facts = scheduleHealthFacts(schedule, reviewMode, reviewModeLocked);
  const healthLabel = t(`planning.health.state.${facts.tone}`, healthStateFallback(facts.tone));

  return (
    <ExpandableControlPanel
      className="planning-schedule-health"
      label={t("planning.health.title", "Schedule health")}
      panelClassName="planning-schedule-health-panel"
      triggerIcon={Activity}
      triggerLabel={`${t("planning.health.open", "Open schedule health")}: ${healthLabel}`}
      triggerSummary={<><span>{t("planning.health.title", "Schedule health")}</span><strong data-tone={facts.tone}>{healthLabel}</strong></>}
    >
      {({ close }) => (
        <>
          <header className="planning-health-header">
            <div>
              <strong>{t("planning.health.title", "Schedule health")}</strong>
              <span>{t("planning.health.source", "Validated schedule read-model facts")}</span>
            </div>
            <span className="planning-health-state" data-tone={facts.tone}>{healthLabel}</span>
          </header>
          <dl className="planning-health-metrics">
            <HealthMetric
              label={t("planning.health.finish", "Calculated / target finish")}
              value={`${formatDate(facts.calculatedFinish)} / ${formatDate(facts.targetFinish)}`}
              detail={facts.targetVarianceDays === null
                ? t("planning.health.notCalculated", "Variance not calculated")
                : targetVarianceLabel(facts.targetVarianceDays, formatNumber, t)}
            />
            <HealthMetric
              label={t("planning.health.critical", "Critical path")}
              value={countLabel(facts.criticalCount, formatNumber, t, "planning.health.criticalTask", "critical task", "critical tasks")}
              detail={t("planning.health.criticalDetail", "Server-calculated task flags")}
            />
            <HealthMetric
              label={t("planning.health.readiness", "Readiness")}
              value={facts.readinessBlockers === null
                ? t("planning.health.notReported", "Not reported")
                : countLabel(facts.readinessBlockers, formatNumber, t, "planning.health.blocker", "blocker", "blockers")}
              detail={facts.readinessTasks === null
                ? t("planning.health.readinessUnavailable", "No readiness rollup")
                : countLabel(facts.readinessTasks, formatNumber, t, "planning.health.taskNotReady", "task not ready", "tasks not ready")}
            />
            <HealthMetric
              label={t("planning.health.capacity", "Resource capacity")}
              value={capacityLabel(facts.overallocatedCount, schedule.resources.length, formatNumber, t)}
              detail={facts.overallocatedCount === null && schedule.resources.length
                ? t("planning.health.capacityUnavailable", "Validated capacity result unavailable")
                : t("planning.health.capacityDetail", "Validated resource-day overloads")}
            />
            <HealthMetric
              label={t("planning.health.baseline", "Baseline variance")}
              value={baselineVarianceLabel(facts, formatNumber, t)}
              detail={facts.baselineCount
                ? countLabel(facts.baselineCount, formatNumber, t, "planning.health.baselineCaptured", "baseline captured", "baselines captured")
                : t("planning.health.noBaseline", "No baseline captured")}
            />
            <HealthMetric
              label={t("planning.health.workingState", "Working state")}
              value={t(`planning.health.working.${facts.workingState}`, workingStateFallback(facts.workingState))}
              detail={schedule.project.updated_at
                ? `${t("planning.health.updated", "Updated")} ${formatDate(schedule.project.updated_at)}`
                : `${t("planning.health.revision", "Revision")} ${formatNumber(schedule.project.revision)}`}
            />
          </dl>
          <footer className="planning-health-actions">
            <span>{t("planning.health.authority", "Python remains scheduling authority; this popup does not recalculate the plan.")}</span>
            <button type="button" className="planning-toolbar-toggle" onClick={close}>{t("command.done", "Done")}</button>
          </footer>
        </>
      )}
    </ExpandableControlPanel>
  );
}

function HealthMetric({ detail, label, value }: { detail: string; label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd><small>{detail}</small></div>;
}

function scheduleHealthFacts(schedule: PlanningSchedule, reviewMode: boolean, reviewModeLocked: boolean) {
  const calculation = schedule.calculation;
  const baselineVariances = schedule.tasks.flatMap((task) => typeof task.end_variance_days === "number" ? [task.end_variance_days] : []);
  const readinessBlockers = schedule.readiness?.blocking_count ?? null;
  const overallocatedCount = calculation?.resource_capacity?.overallocated_count ?? null;
  const invalid = !schedule.validation.ok;
  const attention = (calculation?.target_variance_days ?? 0) > 0
    || (readinessBlockers ?? 0) > 0
    || (overallocatedCount ?? 0) > 0
    || baselineVariances.some((value) => value > 0);
  const partial = !calculation || readinessBlockers === null || (schedule.resources.length > 0 && overallocatedCount === null);
  const tone: HealthTone = invalid ? "invalid" : attention ? "attention" : partial ? "partial" : "ready";
  const serverReviewOnly = reviewModeLocked || schedule.capabilities?.review_only === true || schedule.capabilities?.edit === false || schedule.project.status === "archived";
  const workingState: "edit" | "review" | "serverReviewOnly" = serverReviewOnly ? "serverReviewOnly" : reviewMode ? "review" : "edit";
  return {
    baselineAligned: baselineVariances.filter((value) => value === 0).length,
    baselineCount: schedule.baselines.length,
    baselineEarly: baselineVariances.filter((value) => value < 0).length,
    baselineLate: baselineVariances.filter((value) => value > 0).length,
    calculatedFinish: calculation?.calculated_finish || schedule.project.calculated_finish,
    criticalCount: schedule.tasks.filter((task) => task.task_type !== "summary" && task.critical).length,
    overallocatedCount,
    readinessBlockers,
    readinessTasks: schedule.readiness?.task_blocker_count ?? null,
    targetFinish: calculation?.target_finish || schedule.project.target_finish,
    targetVarianceDays: calculation?.target_variance_days ?? null,
    tone,
    workingState,
  };
}

function targetVarianceLabel(value: number, formatNumber: (value: number) => string, t: Translate) {
  if (value === 0) return t("planning.health.onTarget", "On target");
  const direction = value > 0 ? t("planning.health.late", "late") : t("planning.health.early", "early");
  return `${formatNumber(Math.abs(value))} ${t("planning.health.days", "days")} ${direction}`;
}

function capacityLabel(value: number | null, resourceCount: number, formatNumber: (value: number) => string, t: Translate) {
  if (value !== null) return countLabel(value, formatNumber, t, "planning.health.overloadedPoint", "overloaded point", "overloaded points");
  return resourceCount ? t("planning.health.notCalculatedShort", "Not calculated") : t("planning.health.noResources", "No resources");
}

function baselineVarianceLabel(facts: ReturnType<typeof scheduleHealthFacts>, formatNumber: (value: number) => string, t: Translate) {
  if (!facts.baselineCount) return t("planning.health.noBaselineShort", "No baseline");
  if (!facts.baselineLate && !facts.baselineEarly && !facts.baselineAligned) return t("planning.health.notReported", "Not reported");
  return `${formatNumber(facts.baselineLate)} ${t("planning.health.late", "late")} · ${formatNumber(facts.baselineEarly)} ${t("planning.health.early", "early")} · ${formatNumber(facts.baselineAligned)} ${t("planning.health.aligned", "aligned")}`;
}

type Translate = (key: string, fallback?: string) => string;

function countLabel(count: number, formatNumber: (value: number) => string, t: Translate, key: string, singular: string, plural: string) {
  return `${formatNumber(count)} ${t(`${key}.${count === 1 ? "one" : "many"}`, count === 1 ? singular : plural)}`;
}

function healthStateFallback(tone: HealthTone) {
  if (tone === "invalid") return "Invalid";
  if (tone === "attention") return "Needs attention";
  if (tone === "partial") return "Partial evidence";
  return "On track";
}

function workingStateFallback(state: "edit" | "review" | "serverReviewOnly") {
  if (state === "serverReviewOnly") return "Server review-only";
  if (state === "review") return "Review mode";
  return "Edit mode";
}

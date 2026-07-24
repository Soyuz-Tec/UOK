import { CalendarClock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { CommandButton } from "@uok/shared/primitives";
import type { PlanningTaskDateUpdateRequest } from "./planningContracts";
import type { PlanningTask } from "./types";

type DateField = "forecast_start" | "forecast_end" | "actual_start" | "actual_end" | "deadline";
const dateFields: Array<[DateField, string]> = [
  ["forecast_start", "Forecast start"],
  ["forecast_end", "Forecast end"],
  ["actual_start", "Actual start"],
  ["actual_end", "Actual end"],
  ["deadline", "Deadline"],
];

export function PlanningTaskDateFields({ task, timezone, busy, onSave }: {
  task: PlanningTask;
  timezone: string;
  busy: boolean;
  onSave: (payload: PlanningTaskDateUpdateRequest) => Promise<void>;
}) {
  const [dates, setDates] = useState(dateForm(task));
  const [reason, setReason] = useState("");
  useEffect(() => {
    setDates(dateForm(task));
    setReason("");
  }, [task]);
  const changed = useMemo(() => dateFields.filter(([field]) => dates[field] !== (task[field] || "")).map(([field]) => field), [dates, task]);
  const actualChanged = changed.some((field) => field.startsWith("actual_"));

  return (
    <section className="planning-date-semantics" aria-label="Task execution dates">
      <h4>Execution dates</h4>
      <span className="planning-muted">Calendar dates in {timezone}. Planned dates are scheduler-owned; hour and minute zoom are visual only.</span>
      <div className="planning-form-grid">
        {dateFields.map(([field, label]) => (
          <label className="field" key={field}>
            <span>{label}</span>
            <input type="date" value={dates[field]} onChange={(event) => setDates({ ...dates, [field]: event.target.value })} />
          </label>
        ))}
        <label className="field">
          <span>Actual-date reason</span>
          <input value={reason} maxLength={500} required={actualChanged} onChange={(event) => setReason(event.target.value)} placeholder="Required for observed facts or corrections" />
        </label>
      </div>
      <span className="planning-muted" role="status">{varianceSummary(task)}</span>
      <CommandButton
        icon={CalendarClock}
        loading={busy}
        disabled={!changed.length || (actualChanged && !reason.trim())}
        onClick={() => onSave({
          ...Object.fromEntries(dateFields.map(([field]) => [field, dates[field] || null])),
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        })}
      >
        Save execution dates
      </CommandButton>
    </section>
  );
}

function dateForm(task: PlanningTask): Record<DateField, string> {
  return Object.fromEntries(dateFields.map(([field]) => [field, task[field] || ""])) as Record<DateField, string>;
}

function varianceSummary(task: PlanningTask) {
  return [
    variance("Forecast start", task.forecast_start_variance_days),
    variance("Forecast finish", task.forecast_end_variance_days),
    variance("Actual start", task.actual_start_variance_days),
    variance("Actual finish", task.actual_end_variance_days),
    variance("Deadline", task.deadline_variance_days),
  ].join("; ");
}

function variance(label: string, value?: number | null) {
  if (value == null) return `${label}: not set`;
  return `${label}: ${value > 0 ? "+" : ""}${value}d`;
}

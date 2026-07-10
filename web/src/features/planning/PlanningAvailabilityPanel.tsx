import { CalendarClock } from "lucide-react";

import type { PlanningAvailability } from "./types";

export function PlanningAvailabilityPanel({ availability }: { availability?: PlanningAvailability }) {
  const busy = availability?.busy || [];
  const events = availability?.events || [];
  const warnings = availability?.warnings || [];
  return (
    <section className="planning-availability" aria-label="Calendar availability">
      <h4><CalendarClock size={16} aria-hidden="true" /> calendar.core availability</h4>
      <span className="planning-muted">
        {availability?.status === "ready"
          ? `${busy.length} party-linked busy windows, ${events.length} visible events`
          : `Unavailable${availability?.reason ? `: ${availability.reason}` : ""}`}
      </span>
      {busy.slice(0, 3).map((row) => (
        <span key={`${row.event_id}-${row.start}`} className="planning-availability-row">
          {row.title}: {formatDateTime(row.start)} to {formatDateTime(row.end)}{row.task_ids?.length ? ` · ${row.task_ids.length} linked task(s)` : ""}
        </span>
      ))}
      {warnings.slice(0, 3).map((warning) => <span key={warning} className="planning-availability-row">{warning}</span>)}
    </section>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

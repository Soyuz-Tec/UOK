import type { CalendarDraft, CalendarEventRecord } from "./calendarTypes";
import { resolveZonedInput } from "./calendarZonedDateTime";
import type { ZonedInputIssue } from "./calendarZonedDateTime";

export type CalendarDraftTiming = {
  startsAt: Date;
  endsAt: Date;
  recurrenceUntil: Date | null;
};

export type CalendarDraftTimingResult =
  | { ok: true; timing: CalendarDraftTiming }
  | { ok: false; error: string };

export function resolveCalendarDraftTiming(draft: CalendarDraft, existing?: CalendarEventRecord): CalendarDraftTimingResult {
  const timeZone = draft.timezone.trim();
  const start = resolveField("Start", draft.startsAt, timeZone, existing?.starts_at, existing?.timezone, !draft.startsAtDirty);
  if (!start.ok) return start;
  const end = resolveField("End", draft.endsAt, timeZone, existing?.ends_at, existing?.timezone, !draft.endsAtDirty);
  if (!end.ok) return end;
  if (end.date <= start.date) return { ok: false, error: "End time must be after start time." };

  let recurrenceUntil: Date | null = null;
  if (draft.recurrenceUntil) {
    const repeat = resolveField("Repeat-until", draft.recurrenceUntil, timeZone, existing?.recurrence_until, existing?.timezone, !draft.recurrenceUntilDirty);
    if (!repeat.ok) return repeat;
    recurrenceUntil = repeat.date;
  }
  return { ok: true, timing: { startsAt: start.date, endsAt: end.date, recurrenceUntil } };
}

function resolveField(
  label: string,
  value: string,
  timeZone: string,
  canonical?: string | null,
  canonicalTimeZone?: string | null,
  preserveCanonical = false,
): { ok: true; date: Date } | { ok: false; error: string } {
  const result = resolveZonedInput(value, timeZone, canonical, preserveCanonical ? timeZone : canonicalTimeZone);
  if (result.ok) return result;
  return { ok: false, error: issueMessage(result.issue, label, value, timeZone) };
}

function issueMessage(issue: ZonedInputIssue, label: string, value: string, timeZone: string) {
  if (issue === "invalid_timezone") return `“${timeZone || "(blank)"}” is not a valid IANA time zone.`;
  if (issue === "invalid_input") return `${label} must be a valid local date and time.`;
  if (issue === "nonexistent") return `${label} ${value} does not exist in ${timeZone} because the clock changes. Choose another local time.`;
  return `${label} ${value} occurs twice in ${timeZone} because the clock changes. UOK cannot safely infer which occurrence you mean; choose another local time.`;
}

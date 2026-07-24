import { resolveCalendarDraftTiming } from "./calendarDraftTiming";
import type { CalendarDraft, CalendarEventRecord, CalendarParticipant, CalendarReminder } from "./calendarTypes";
import { isValidIanaTimeZone, zonedInputValue } from "./calendarZonedDateTime";

export function emptyDraft(date = new Date(), hour = 9, calendarId = "", timezone = "UTC"): CalendarDraft {
  const start = selectedWallDate(date, hour);
  const end = new Date(start);
  end.setUTCHours(start.getUTCHours() + 1);
  return {
    calendarId,
    title: "",
    description: "",
    location: "",
    startsAt: utcWallInputValue(start),
    endsAt: utcWallInputValue(end),
    allDay: false,
    transparency: "busy",
    recurrence: "",
    recurrenceRule: "",
    recurrenceUntil: "",
    timezone,
    reminderMinutes: "",
    participantName: "",
    participantEmail: "",
  };
}

export function draftWithTimezone(draft: CalendarDraft, timezone: string, existing?: CalendarEventRecord): CalendarDraft {
  const resolvedTimezone = timezone.trim();
  if (!existing || !isValidIanaTimeZone(resolvedTimezone)) return { ...draft, timezone };
  return {
    ...draft,
    timezone,
    startsAt: draft.startsAtDirty ? draft.startsAt : zonedInputValue(existing.starts_at || existing.occurrence_start, resolvedTimezone),
    endsAt: draft.endsAtDirty ? draft.endsAt : zonedInputValue(existing.ends_at || existing.occurrence_end, resolvedTimezone),
    recurrenceUntil: draft.recurrenceUntilDirty || !existing.recurrence_until
      ? draft.recurrenceUntil
      : zonedInputValue(existing.recurrence_until, resolvedTimezone),
  };
}

export function draftFromEvent(event: CalendarEventRecord): CalendarDraft {
  const timezone = event.timezone || "UTC";
  return {
    id: event.id,
    calendarId: event.calendar_id,
    title: event.title,
    description: event.description || "",
    location: event.location || "",
    // The editor updates the complete series. Prefer canonical event timing over
    // the clicked occurrence so opening a later instance cannot move the series.
    startsAt: zonedInputValue(event.starts_at || event.occurrence_start || "", timezone),
    endsAt: zonedInputValue(event.ends_at || event.occurrence_end || "", timezone),
    allDay: Boolean(event.all_day),
    transparency: event.transparency === "free" ? "free" : "busy",
    recurrence: event.recurrence_rule?.includes("FREQ=") ? event.recurrence_rule.split("FREQ=")[1]?.split(";")[0] as CalendarDraft["recurrence"] : "",
    recurrenceRule: event.recurrence_rule || "",
    recurrenceUntil: event.recurrence_until ? zonedInputValue(event.recurrence_until, timezone) : "",
    timezone,
    reminderMinutes: event.reminders?.[0]?.trigger_minutes_before != null ? String(event.reminders[0].trigger_minutes_before) : "",
    participantName: event.participants?.[0]?.display_name || "",
    participantEmail: event.participants?.[0]?.email || "",
  };
}

export function eventPayload(draft: CalendarDraft, timezone: string, existingEvent?: CalendarEventRecord) {
  const zonedDraft = { ...draft, timezone: (draft.timezone || timezone).trim() };
  const timing = resolveCalendarDraftTiming(zonedDraft, existingEvent);
  if (!timing.ok) throw new Error(timing.error);
  const originalFrequency = recurrenceFrequency(draft.recurrenceRule);
  const recurrenceRule = draft.recurrence === ""
    ? null
    : draft.recurrenceRule && originalFrequency === draft.recurrence
      ? draft.recurrenceRule
      : `FREQ=${draft.recurrence}`;
  return {
    calendar_id: draft.calendarId,
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    location: draft.location.trim() || null,
    starts_at: timing.timing.startsAt.toISOString(),
    ends_at: timing.timing.endsAt.toISOString(),
    timezone: zonedDraft.timezone,
    all_day: draft.allDay,
    transparency: draft.transparency,
    recurrence_rule: recurrenceRule,
    recurrence_until: timing.timing.recurrenceUntil?.toISOString() || null,
    participants: participantPayload(draft, existingEvent?.participants || []),
    reminders: reminderPayload(draft, existingEvent?.reminders || []),
  };
}

function recurrenceFrequency(rule: string): CalendarDraft["recurrence"] {
  const value = rule.match(/(?:^|;)FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(?:;|$)/)?.[1];
  return (value || "") as CalendarDraft["recurrence"];
}

function participantPayload(draft: CalendarDraft, existing: CalendarParticipant[]) {
  const first = existing[0];
  const tail = existing.slice(1).map(writeParticipant).filter(hasParticipantIdentity);
  const email = draft.participantEmail.trim();
  if (!email && !first?.participant_id) return tail;
  const participant = writeParticipant({
    ...first,
    participant_type: first?.participant_type || (first?.participant_id ? "party" : "person"),
    email: email || first?.email || null,
    display_name: draft.participantName.trim() || email || first?.display_name || null,
  });
  return hasParticipantIdentity(participant) ? [participant, ...tail] : tail;
}

function writeParticipant(participant: CalendarParticipant) {
  return {
    participant_type: participant.participant_type || (participant.participant_id ? "party" : "person"),
    participant_id: participant.participant_id || null,
    email: participant.email || null,
    display_name: participant.display_name || participant.email || null,
    role: participant.role || "required",
    response_status: participant.response_status || "needs_action",
  };
}

function hasParticipantIdentity(participant: ReturnType<typeof writeParticipant>) {
  return Boolean(participant.participant_id || participant.email);
}

function reminderPayload(draft: CalendarDraft, existing: CalendarReminder[]) {
  const tail = existing.slice(1).map((reminder) => ({
    reminder_type: reminder.reminder_type,
    trigger_minutes_before: reminder.trigger_minutes_before,
  }));
  if (draft.reminderMinutes === "") return tail;
  return [{
    reminder_type: existing[0]?.reminder_type || "in_app",
    trigger_minutes_before: Number(draft.reminderMinutes),
  }, ...tail];
}

function selectedWallDate(date: Date, hour: number) {
  const wall = new Date(0);
  wall.setUTCFullYear(date.getFullYear(), date.getMonth(), date.getDate());
  wall.setUTCHours(hour, 0, 0, 0);
  return wall;
}

function utcWallInputValue(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}T${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

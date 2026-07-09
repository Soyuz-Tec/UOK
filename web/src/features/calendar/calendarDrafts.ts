import { localInputValue } from "./calendarDates";
import type { CalendarDraft, CalendarEventRecord } from "./calendarTypes";

export function emptyDraft(date = new Date(), hour = 9): CalendarDraft {
  const start = new Date(date);
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start);
  end.setHours(start.getHours() + 1);
  return {
    title: "",
    description: "",
    location: "",
    startsAt: localInputValue(start),
    endsAt: localInputValue(end),
    allDay: false,
    transparency: "busy",
    recurrence: "",
    recurrenceUntil: "",
    reminderMinutes: "",
    participantName: "",
    participantEmail: "",
  };
}

export function draftFromEvent(event: CalendarEventRecord): CalendarDraft {
  return {
    id: event.id,
    title: event.title,
    description: event.description || "",
    location: event.location || "",
    startsAt: localInputValue(new Date(event.occurrence_start || event.starts_at || "")),
    endsAt: localInputValue(new Date(event.occurrence_end || event.ends_at || "")),
    allDay: Boolean(event.all_day),
    transparency: event.transparency === "free" ? "free" : "busy",
    recurrence: event.recurrence_rule?.includes("FREQ=") ? event.recurrence_rule.split("FREQ=")[1]?.split(";")[0] as CalendarDraft["recurrence"] : "",
    recurrenceUntil: event.recurrence_until ? localInputValue(new Date(event.recurrence_until)) : "",
    reminderMinutes: event.reminders?.[0]?.trigger_minutes_before != null ? String(event.reminders[0].trigger_minutes_before) : "",
    participantName: event.participants?.[0]?.display_name || "",
    participantEmail: event.participants?.[0]?.email || "",
  };
}

export function eventPayload(draft: CalendarDraft, calendarId: string, timezone: string) {
  return {
    calendar_id: calendarId,
    title: draft.title.trim(),
    description: draft.description || undefined,
    location: draft.location || undefined,
    starts_at: new Date(draft.startsAt).toISOString(),
    ends_at: new Date(draft.endsAt).toISOString(),
    timezone,
    all_day: draft.allDay,
    transparency: draft.transparency,
    recurrence_rule: draft.recurrence ? `FREQ=${draft.recurrence}` : "",
    recurrence_until: draft.recurrenceUntil ? new Date(draft.recurrenceUntil).toISOString() : undefined,
    participants: draft.participantEmail ? [{
      participant_type: "person",
      email: draft.participantEmail,
      display_name: draft.participantName || draft.participantEmail,
      role: "required",
      response_status: "needs_action",
    }] : [],
  };
}
